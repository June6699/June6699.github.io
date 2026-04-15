---
cover:
  image: /images/header_img/snow-4936687.jpg
title: SCENIC+中export_pseudobulk导出片段文件的神坑盘点
date: 2026-03-28
tags:
    - 技术
    - 技术/生信
    - 技术/生信/分析
author: June
---

### 一、问题背景

在使用 SCENIC+ (pycisTopic) 的 `export_pseudobulk()` 函数，按细胞类型拆分 ATAC fragment 文件并准备进行 consensus peak calling 时，常常遭遇一系列难以排查的“幽灵”错误。

主要表现为：明明输入的数据没有任何问题，程序却频繁提示临时文件不存在，或者在刚创建好临时文件准备写入时直接崩溃闪退。根本原因是底层的 `scatac_fragment_tools` 解析器对输入文件的格式、字典匹配以及 DataFrame 的索引有着极其严苛（且缺乏友好报错提示）的硬编码限制。

---

### 二、报错流程与解决方案

#### 1. split_pattern 与 DataFrame 索引的隐蔽冲突

**报错信息**

```python
ValueError: Fragment file /data/xujun/.../tmp/F32/F32_Cardiomyocyte.fragments.tsv.gz does not exist.
```

**原因**

`export_pseudobulk` 默认不读取你数据框里的某一列，而是死磕 `cell_data` 的**行索引 (index)** 去和 Fragment 文件里的 Barcode 进行比对。
在单细胞多样本合并时，为了防重叠，我们的 index 通常会带有样本前/后缀（如 `AAACGAACAAGCGCTG-1_F32`）。虽然官方提供了 `split_pattern` 参数用来切割前缀，但这玩意儿的底层逻辑有很大缺陷：
当设置 `split_pattern="_"` 时，底层 Rust 代码往往强制默认你的格式是 `样本_Barcode`，从而去提取下划线后面的部分。如果你的 index 是 `Barcode_样本`，它提取出来的其实是 `F32` 这个无用字符串，拿着 `F32` 去比对，自然匹配数为 0，最终导致生成空文件并报错。

**解决方案**

放弃让底层瞎猜，直接在 Python 层面用干净的 `barcode` 列替换掉 index，并彻底关闭 `split_pattern` 参数，实现 100% 精确匹配：

```python
# 1. 复制数据，用干净且不带样本前后缀的 barcode 列替换原始的 index
cell_data_for_pb = cell_data.copy()
cell_data_for_pb.index = cell_data_for_pb['barcode']

# 2. 运行导出时关闭 split_pattern
bw_paths, bed_paths = export_pseudobulk(
    input_data=cell_data_for_pb,
    # ... 其他常规参数 ...
    split_pattern=None  # 核心修改：改为None，拒绝底层切分逻辑
)
```

---

#### 2. chromsizes 字典与染色体命名格式不一致

**报错信息**

（同上，也是报 Fragment file does not exist）

**原因**

排除了 Barcode 匹配失败的情况后，最容易被忽视的元凶是**染色体命名格式**。
如果输入的 Fragment 文件中的染色体命名没有前缀（例如 `1`），而传入的 `chromsizes` 字典的键带有前缀（例如 `chr1`），底层的 Rust 解析器会直接**静默丢弃**所有在字典中找不到对应键的行。几千万行数据读取完被全部丢弃，未能生成任何有效文件，最终再次导致外层 Python 脚本抛出“文件不存在”。

**解决方案**

在将字典传入 `export_pseudobulk` 之前，通过 Python 字典推导式，将 `chromsizes` 的键统一去掉 `chr` 前缀，强制与 Fragment 文件对齐：

```python
# 将类似于 {'chr1': 248956422} 转换为 {'1': 248956422}
chromsizes_fixed = {str(k).replace('chr', ''): v for k, v in chromsizes.items()}
```

---

#### 3. 底层 Rust 崩溃：Invalid number of fields

**报错信息**

```text
thread '<unnamed>' panicked at src/aggregate_fragments.rs:80:18:
Invalid number of fields in fragment file!
pyo3_runtime.PanicException: Invalid number of fields in fragment file!
```

**原因**

经历了前两步，tmp 文件夹下终于成功创建了对应细胞类型的文件，但程序刚开始运行就崩溃了。
原因是部分非标准 10x 流程输出的 Fragment 文件包含了第 6 列（通常是正负链信息，如 `+` 或 `-`）。而 SCENIC+ 的底层解析器强制写死了列数检查，**仅允许严格的 5 列格式**（染色体、起点、终点、Barcode、read count）。只要读取到第 6 列，立马触发 PanicException 强制退出。

**解决方案**

回到 Linux 命令行，使用文本处理工具强行截断文件保留前 5 列，并重新压缩、建立 tabix 索引：

```bash
# 解压读取 -> 截取前 5 列 -> 重新用 bgzip 压缩成新文件
zcat /path/to/original/fragments.tsv.gz | cut -f 1-5 | bgzip > /path/to/fixed/fragments_5col.tsv.gz

# 为处理后的新文件建立 tabix 索引
tabix -p bed /path/to/fixed/fragments_5col.tsv.gz
```

最后，在 Python 脚本中更新 `path_to_fragments` 字典指向新的 `_5col.tsv.gz` 文件，即可顺利跑通整个流程。

---

### 三、排坑总结

> [!IMPORTANT]
> SCENIC+ 的 `scatac_fragment_tools` 模块为了追求极高的文本解析速度，大幅牺牲了容错率和报错的友好度。
> 1. **少用 split_pattern**：不要依赖底层的切分逻辑。永远在 Python 层把 index 处理成和 Fragment 文件里一模一样的纯 Barcode，然后设为 `None`。
> 2. **静默过滤陷阱**：遇到匹配不上的条目（染色体名称对不上 `chr1` vs `1`），底层逻辑通通是直接丢弃该行而不抛出 Warning。排查 `does not exist` 报错时，优先核对两端数据的格式是否做到字面意义上的完全一致。
> 3. **文件结构红线**：输入给流程的 Fragment 文件必须严格为 5 列，多一列都会导致底层直接 Panic 崩溃。遇到底层报错，直接查原文件的列数。
