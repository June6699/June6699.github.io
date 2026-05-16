---
cover:
  image: /images/header_img/snow-4936687.jpg
title: FitHiC2 猪 Hi-C 数据处理记录：validPairs 到显著互作
date: 2026-05-16
author: June
tags:
    - 技术
    - 技术/生信
    - 技术/生信/分析
---

## 一、这条流程在解决什么问题

这次要处理的是三批猪 Hi-C 数据：`6month`、`70day`、`9year`。手头已经有去重后的 `validPairs`，目标是把它们整理成 FitHiC2 能吃的 `10 kb` 输入，再跑出显著互作。

中间最容易踩坑的地方不是 FitHiC2 命令本身，而是输入文件。FitHiC2 至少要看三类东西：

- `contactCounts`：每一对 bin 之间观测到多少次接触。
- `fragments`：每个 bin 的坐标、边际接触数、是否可比对。
- `bias`：每个 bin 的归一化偏差权重，用于校正测序深度、可比对性、GC、片段可捕获性等系统误差。

我主要改了两个地方。第一，原始 `createFitHiCFragments-fixedsize.py` 会把 fragments 第 4 列和第 5 列都写成 `1`，能跑，但太粗糙：第 4 列应该尽量是真实的 `marginalized contact count`，第 5 列应该反映 bin 的 `mappability`。第二，官方 `validPairs2FitHiC-fixedSize.sh` 里有一处低距离过滤的括号写错了，下面会单独拎出来说。这里给的是修过后的版本。

## 二、FitHiC2 原理

### 2.1 Hi-C 接触矩阵的距离衰减

Hi-C 数据最明显的规律是：同一条染色体上，两个位点之间的基因组距离越近，接触频率通常越高；距离越远，接触频率越低。这不是某一个 loop 的特异信号，而是聚合物折叠和实验捕获共同造成的背景规律。

因此，判断一对 bin 是否“显著互作”，不能只看 `contactCount` 高不高。一个 10 kb 相邻 bin 的 `count=100` 可能很普通，但相隔 2 Mb 的两个 bin 如果也有 `count=100`，就可能非常异常。FitHiC2 做的事情，就是在给定距离背景下判断某个接触数是否显著高于期望。

### 2.2 FitHiC2 的统计建模思路

只看和这次流程有关的部分，FitHiC2 大致是在做这几件事：

1. 把基因组切成固定大小的 bin，例如 `10 kb`。
2. 对每个 bin pair 计算观测接触数，同时记录这对 bin 的基因组距离。
3. 用所有中距离接触拟合一条“距离-接触概率”背景曲线，通常通过 equal-occupancy binning 和 spline 完成。
4. 对每个 bin pair 计算观测值偏离背景期望的显著性，得到 `p-value`，再通过 Benjamini-Hochberg 方法得到 `q-value`。

FitHiC2 输出的主结果不是“有没有接触”，而是“这个接触在同距离背景下是否比期望更富集”。所以解释结果时应优先看 `q-value` 和 `observed / expected`，而不是只看原始 `contactCount`。

### 2.3 fragments 文件为什么重要

FitHiC2 的 fragments 文件每行代表一个可分析的 genomic bin。官方格式是 5 列：

```text
chr  extraField  fragmentMid  marginalizedContactCount  mappable
```

在固定 bin 流程里，第二列可以写 bin 起点，第三列必须是 bin 中点。第四列是这个 bin 参与的总接触量，第五列通常写成 `0/1` 表示是否可比对。FitHiC2 会用这些信息决定哪些 bin 可以进入背景模型，也会结合 bias 文件进行显著性估计。

如果第 4 列全部写成 `1`，低覆盖 bin 和高覆盖 bin 会被粗暴看成同类。若第 5 列全部写成 `1`，低 mappability 区域也会进入模型。这两类问题都可能让背景估计变脏，最终影响显著互作的可靠性。

### 2.4 bias 文件为什么重要

Hi-C 矩阵的每个 bin 都有自己的捕获偏好。某些区域因为 GC 含量、重复序列、酶切片段、可比对性或局部测序深度，天然比其他区域更容易产生 contact。HiCKRy 使用 Knight-Ruiz 矩阵平衡算法为每个 bin 估计一个 bias 值。

FitHiC2 的 bias 文件格式是：

```text
chr  midpoint  bias
```

平均值通常接近 `1`。bias 高的 bin 表示原始接触量整体偏高，bias 低的 bin 表示原始接触量整体偏低。FitHiC2 在计算期望接触数时会纳入这两个端点的 bias，从而减少系统偏差造成的假阳性。

## 三、全局配置与路径写法

代码里不要直接写个人目录或服务器用户名。建议所有路径集中放在一个配置文件里，后续脚本只引用变量。下面的 `/path/to/pig_hic_project` 是占位路径，实际运行时替换成自己的项目根目录即可。

```bash
#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="/path/to/pig_hic_project"
RAW_DIR="${PROJECT_ROOT}/01.data"
SCRIPT_DIR="${PROJECT_ROOT}/scripts"
OUT_DIR="${PROJECT_ROOT}/fithic2_10kb"

CHROMSIZES="${PROJECT_ROOT}/chrom_sus11.sizes"
MAPPABILITY_TAB="${OUT_DIR}/mappability_10kb.tab"
MAPPABILITY_NOCHR="${OUT_DIR}/mappability_10kb.nochr.tab"
HICKRY="${SCRIPT_DIR}/HiCKRy.py"

RESOLUTION=10000
MIN_CIS_DIST=$((RESOLUTION * 2))
MAP_THRES=0.2
SAMPLES=(6month 9year 70day)

mkdir -p "${OUT_DIR}"
```

后面的 awk 里会用到绝对距离。为了避免再写出 `sqrt(($3-$7)^2 > t)` 这种括号事故，本文都用一个明确的 awk 函数：

```awk
function abs(x) { return x < 0 ? -x : x }
```

这份配置假设：

- `RAW_DIR` 下有 `${sample}_shortFormat.sort.txt` 或对应的 gzip 文件。
- `CHROMSIZES` 是猪基因组 chromosome size 文件。
- `SCRIPT_DIR` 下放 `validPairs2FitHiC-fixedSize.sh`、`createFitHiCFragments-fixedsize.withmap.py`、`HiCKRy.py`。
- `OUT_DIR` 是所有中间结果和最终结果的输出目录。

## 四、输入文件解释

### 4.1 validPairs 文件

`validPairs` 是 Hi-C 比对、过滤、去重后得到的有效 read pair 文件。不同软件输出列顺序可能不同，本流程假设至少满足下面这几列：

```text
col2  chr1
col3  pos1
col6  chr2
col7  pos2
```

也就是说，脚本里使用 `$2/$3` 作为第一个端点，使用 `$6/$7` 作为第二个端点。如果你的 validPairs 格式不是这样，必须先改 awk 里的列号。

典型输入行可以理解为：

```text
readID  chr1  pos1  ...  ...  chr2  pos2  ...
```

这里的 `pos1` 和 `pos2` 是 read 端点在基因组上的坐标。后续会把坐标按 `10 kb` 分箱，例如 `pos=123456` 会落入 `120000-130000` 这个 bin，中点坐标是 `125000`。

### 4.2 chromosome sizes 文件

`chrom_sus11.sizes` 用来告诉 `bedtools makewindows` 和 fragments 脚本每条染色体的长度，格式为两列：

```text
chrom  length
1      274330532
2      151935994
...
```

染色体命名要和 validPairs 保持一致。若 validPairs 是 `1, 2, 3`，chrom sizes 也应使用 `1, 2, 3`；若 validPairs 是 `chr1, chr2, chr3`，chrom sizes 也应使用 `chr1, chr2, chr3`。命名不一致会导致交集统计和 FitHiC2 匹配失败。

### 4.3 mappability_10kb.tab 文件

`mappability_10kb.tab` 表示每个 `10 kb` bin 的平均可比对性。这里的思路是先用 GenMap 计算 75-mer mappability，再转成 bigWig，最后用 `multiBigwigSummary` 或类似工具按 `10 kb` bin 求均值。

本流程要求 mappability 表至少有 4 列：

```text
chrom  start  end  mean_mappability
1      0      10000  0.98
1      10000  20000 0.12
...
```

后续 fragments 生成脚本会读取第 1 列、第 2 列和第 4 列。如果 `mean_mappability >= 0.2`，该 bin 的 fragments 第 5 列写 `1`；否则写 `0`。

### 4.4 contactCounts 文件

`contactCounts` 是 FitHiC2 的互作输入文件，只保留非零 contact 的 bin pair，格式为 5 列：

```text
chr1  mid1  chr2  mid2  contactCount
```

示例：

```text
10  5000      10  11985000   1
10  5000      13  108135000  1
1   5000      1   5000       115
10  10005000  10  10015000   119
```

字段含义如下：

| 列 | 含义 |
| --- | --- |
| `chr1` | 第一个 bin 的染色体 |
| `mid1` | 第一个 bin 的中点坐标 |
| `chr2` | 第二个 bin 的染色体 |
| `mid2` | 第二个 bin 的中点坐标 |
| `contactCount` | 两个 bin 之间观测到的 contact 数 |

需要注意几种常见情况：

- `1 5000 1 5000 115` 表示同一个 bin 的自接触，通常 count 很高，不应直接解释为远距离 loop。
- `10 10005000 10 10015000 119` 表示相邻 bin 接触，count 高符合 Hi-C 近距离接触更强的规律。
- `10 5000 13 108135000 1` 表示跨染色体接触。FitHiC2 默认多用于 `intraOnly`，若要分析跨染色体互作，需要显式设置并承担更重的多重检验压力。

### 4.5 fragments 文件

本流程生成的 fragments 文件格式为：

```text
chr  start  mid  marginalizedContactCount  mappable
```

示例：

```text
1  0      5000   342  1
1  10000  15000  0    0
```

字段含义如下：

| 列 | 含义 |
| --- | --- |
| `chr` | bin 所在染色体 |
| `start` | bin 起点；对 FitHiC2 来说是 extra field，但保留起点方便检查 |
| `mid` | bin 中点，必须和 contactCounts 中的 midpoint 一致 |
| `marginalizedContactCount` | 该 bin 参与的总接触量，本流程由 validPairs 两端点投影到 bin 后统计 |
| `mappable` | 是否可比对，`1` 表示通过 mappability 阈值，`0` 表示不通过 |

在这个流程中，边际接触数来自通过距离过滤后的 validPairs 端点计数。每个有效 pair 会贡献两个端点；如果两个端点落在同一个 bin，该 bin 会被计两次。这和 Hi-C 矩阵行和的直觉一致：它衡量的是该 bin 总体参与了多少可用 contact。

## 五、流程总览

```text
00_config.sh
    ↓
01_make_marginal_counts.sh
    生成 genome_10kb_bins.bed 和 ${sample}_bins_with_counts.bed
    ↓
02_make_contact_counts.sh
    生成 10k_res_${sample}_fithic.contactCounts.gz
    ↓
03_make_fragments.sh
    合并 mappability 与 marginal counts，生成 ${sample}_fragments_fixed_10k.gz
    ↓
04_run_hickry_and_fithic.sh
    生成 bias 文件和 FitHiC2 显著互作结果
```

其中 `01_make_marginal_counts.sh` 和 `02_make_contact_counts.sh` 互不依赖，可以同时跑。`03_make_fragments.sh` 必须等 mappability 表和 `${sample}_bins_with_counts.bed` 都准备好后再跑。`04_run_hickry_and_fithic.sh` 必须等 contactCounts 和 fragments 都生成后再跑。

## 六、脚本 1：生成每个 bin 的边际接触数

### 6.1 原理

FitHiC2 的 fragments 第 4 列需要每个 bin 的总接触量。这里不直接从 contactCounts 反推，而是从 validPairs 出发，把每对 reads 拆成两个单端 BED 记录，再用 `bedtools intersect -c` 统计每个 `10 kb` bin 中落入多少 read 端点。

这一步先做三个过滤：

- 只保留常规染色体命名长度较短的记录，避免未组装 contig 造成干扰。
- 去掉线粒体 `MT`。
- 去掉同染色体距离不超过 `2 × resolution` 的极短距离 pairs，减少 self-ligation 和近距离技术噪音。

### 6.2 代码

```bash
#!/usr/bin/env bash
set -euo pipefail

source ./00_config.sh

bedtools makewindows \
    -g "${CHROMSIZES}" \
    -w "${RESOLUTION}" \
    > "${OUT_DIR}/genome_10kb_bins.bed"

for sample in "${SAMPLES[@]}"
do
    echo "=== making marginal counts for ${sample} ==="

    validPairs="${RAW_DIR}/${sample}_shortFormat.sort.txt"
    singleBed="${OUT_DIR}/${sample}_validPairs_singleBED.bed"
    countsBed="${OUT_DIR}/${sample}_bins_with_counts.bed"

    zcat -f "${validPairs}" |
    awk -v minDist="${MIN_CIS_DIST}" '
        BEGIN{OFS="\t"}
        function abs(x) { return x < 0 ? -x : x }
        length($2) <= 5 && length($6) <= 5 && $2 != "MT" && $6 != "MT" {
            if ($2 != $6 || abs($3 - $7) > minDist) {
                print $2, $3 - 1, $3
                print $6, $7 - 1, $7
            }
        }' \
    > "${singleBed}"

    bedtools intersect \
        -a "${OUT_DIR}/genome_10kb_bins.bed" \
        -b "${singleBed}" \
        -c -nonamecheck \
        > "${countsBed}"

    echo "=== ${sample} marginal counts done ==="
done
```

### 6.3 输入文件

| 输入 | 作用 |
| --- | --- |
| `${CHROMSIZES}` | 提供每条染色体长度，用于切 `10 kb` bin |
| `${RAW_DIR}/${sample}_shortFormat.sort.txt` | 当前样本的 validPairs 文件 |

### 6.4 输出文件

`genome_10kb_bins.bed` 是全基因组 bin 列表：

```text
chr  start  end
1    0      10000
1    10000  20000
...
```

`${sample}_validPairs_singleBED.bed` 是中间文件，每个 valid pair 被拆成两条单端 BED：

```text
chr  start  end
1    123455  123456
1    987654  987655
```

`${sample}_bins_with_counts.bed` 是 fragments 第 4 列的来源：

```text
chr  start  end    count
1    0      10000  342
1    10000  20000  289
```

## 七、脚本 2：生成 FitHiC2 contactCounts

### 7.1 原理

这一步把 validPairs 的两个端点分别换算成 `10 kb` bin 起点，再转成 bin 中点，最后对相同 bin pair 计数。FitHiC2 要求每个互作只出现一次，所以脚本会把 bin pair 统一成固定顺序：染色体编号较小的端点在前；同染色体时，起点坐标较小的端点在前。

官方 `validPairs2FitHiC-fixedSize.sh` 里这一行要改：

```bash
awk -v t=$lowDistThres '{if($2!=$5||($2==$5 && (sqrt(($3-$6)^2>t)))) {print $0}}'
```

这里的 `$2/$3` 和 `$5/$6` 是官方脚本默认的 validPairs 列号。本文前面那份 shortFormat 文件用的是 `$2/$3` 和 `$6/$7`，所以后面的完整脚本会按本地列号写；括号问题和修法是同一个问题。

问题出在括号位置。awk 会先算 `($3-$6)^2 > t`，这个表达式的结果只有 `0` 或 `1`，再丢给 `sqrt()`。也就是说它算的不是两个端点之间的距离，而是在对一个真假值开方：真就是 `sqrt(1)=1`，假就是 `sqrt(0)=0`。

这会把低距离过滤改坏。原本应当保留“同染色体且距离大于阈值”的 pair；错误写法实际只是在判断 `($3-$6)^2 > t` 是否为真。因为左边是平方、右边还是原始距离阈值，等价阈值变成了 `sqrt(t)`。如果 `t=20000`，最后实际只过滤掉约 `141 bp` 以内的 pair，而不是过滤掉 `20 kb` 以内的 pair。

最直接的修法是先取绝对距离，再和阈值比较：

```bash
awk -v t=$lowDistThres 'function abs(x){return x < 0 ? -x : x}
    {if($2!=$5 || ($2==$5 && abs($3-$6)>t)) {print $0}}'
```

如果继续用平方也可以，但要把阈值一起平方：

```bash
($3 - $6)^2 > t^2
```

我更倾向于 `abs()`，一眼就能看出来是在做距离过滤，不容易再被括号坑。

### 7.2 validPairs2FitHiC-fixedSize.sh

```bash
#!/usr/bin/env bash
set -euo pipefail

w="$1"
libName="$2"
validPairsFile="$3"
outdir="$4"
lowDistThres=$((w * 2))

mkdir -p "${outdir}"

zcat -f "${validPairsFile}" |
awk -v r="${w}" -v minDist="${lowDistThres}" '
    BEGIN{OFS="\t"}
    function abs(x) { return x < 0 ? -x : x }
    length($2) <= 5 && length($6) <= 5 && $2 != "MT" && $6 != "MT" {
        if ($2 != $6 || abs($3 - $7) > minDist) {
            chr1 = $2
            start1 = int($3 / r) * r
            chr2 = $6
            start2 = int($7 / r) * r

            if (chr1 < chr2 || (chr1 == chr2 && start1 <= start2)) {
                print chr1, start1, chr2, start2
            } else {
                print chr2, start2, chr1, start1
            }
        }
    }' |
sort -k1,1 -k2,2n -k3,3 -k4,4n |
uniq -c |
awk -v r="${w}" 'BEGIN{OFS="\t"}
    {
        count = $1
        chr1 = $2
        mid1 = $3 + r / 2
        chr2 = $4
        mid2 = $5 + r / 2
        print chr1, mid1, chr2, mid2, count
    }' |
gzip > "${outdir}/${libName}_fithic.contactCounts.gz"
```

### 7.3 批量运行

```bash
#!/usr/bin/env bash
set -euo pipefail

source ./00_config.sh

for sample in "${SAMPLES[@]}"
do
    echo "=== making contactCounts for ${sample} ==="

    bash "${SCRIPT_DIR}/validPairs2FitHiC-fixedSize.sh" \
        "${RESOLUTION}" \
        "10k_res_${sample}" \
        "${RAW_DIR}/${sample}_shortFormat.sort.txt" \
        "${OUT_DIR}"

    echo "=== ${sample} contactCounts done ==="
done
```

### 7.4 输出文件解释

输出文件为：

```text
10k_res_${sample}_fithic.contactCounts.gz
```

检查方式：

```bash
zcat "${OUT_DIR}/10k_res_6month_fithic.contactCounts.gz" | head
```

若看到 5 列，且中点坐标均为 `5000, 15000, 25000...` 这种形式，说明分箱逻辑基本正确。

## 八、脚本 3：生成 corrected fragments

### 8.1 原理

这一步把三类信息合并成 FitHiC2 fragments 文件：

- `chrom sizes`：决定全基因组有哪些 bin。
- `${sample}_bins_with_counts.bed`：提供每个 bin 的边际接触数。
- `mappability_10kb.tab`：提供每个 bin 的平均 mappability，并转成 `0/1`。

如果 mappability 文件带有 `chr` 前缀，而 validPairs 和 chrom sizes 没有 `chr` 前缀，需要先去掉前缀。反过来也一样，总之所有输入必须使用同一套染色体命名。

### 8.2 mappability 文件准备

如果 mappability 文件在另一台服务器上，可以用占位变量表示远程来源：

```bash
#!/usr/bin/env bash
set -euo pipefail

source ./00_config.sh

REMOTE_MAP_SOURCE="user@remote-host:/path/to/mappability_10kb.tab"
scp "${REMOTE_MAP_SOURCE}" "${MAPPABILITY_TAB}"

sed 's/^chr//' "${MAPPABILITY_TAB}" > "${MAPPABILITY_NOCHR}"
```

如果本来就没有 `chr` 前缀，`sed` 后的文件和原文件内容会基本一致。

### 8.3 createFitHiCFragments-fixedsize.withmap.py

```python
#!/usr/bin/env python

import argparse
import gzip


def strip_chr(chrom):
    return chrom[3:] if chrom.startswith("chr") else chrom


def read_mappability(path, threshold):
    values = {}
    with open(path, "r", encoding="utf-8") as handle:
        for line in handle:
            if not line.strip() or line.startswith("#"):
                continue
            parts = line.rstrip().split()
            if len(parts) < 4:
                continue
            chrom = strip_chr(parts[0])
            start = int(parts[1])
            mean_mappability = float(parts[3])
            values[(chrom, start)] = 1 if mean_mappability >= threshold else 0
    return values


def read_counts(path):
    counts = {}
    with open(path, "r", encoding="utf-8") as handle:
        for line in handle:
            if not line.strip() or line.startswith("#"):
                continue
            parts = line.rstrip().split()
            if len(parts) < 4:
                continue
            chrom = strip_chr(parts[0])
            start = int(parts[1])
            count = int(parts[3])
            counts[(chrom, start)] = count
    return counts


def parse_args():
    parser = argparse.ArgumentParser(
        description="Create FitHiC2 fixed-size fragments with real marginal counts and mappability."
    )
    parser.add_argument("--chrLens", required=True)
    parser.add_argument("--resolution", type=int, required=True)
    parser.add_argument("--mappability", required=True)
    parser.add_argument("--counts", required=True)
    parser.add_argument("--outFile", required=True)
    parser.add_argument("--mapThres", type=float, default=0.2)
    return parser.parse_args()


def main():
    args = parse_args()
    mappability = read_mappability(args.mappability, args.mapThres)
    counts = read_counts(args.counts)

    with open(args.chrLens, "r", encoding="utf-8") as chrom_handle, gzip.open(args.outFile, "wt") as out:
        for line in chrom_handle:
            if not line.strip() or line.startswith("#"):
                continue

            chrom, size_text = line.rstrip().split()[:2]
            chrom = strip_chr(chrom)
            chrom_size = int(size_text)
            interval_end = ((chrom_size + args.resolution - 1) // args.resolution) * args.resolution

            for start in range(0, interval_end, args.resolution):
                mid = start + args.resolution // 2
                key = (chrom, start)
                marginal_count = counts.get(key, 0)
                is_mappable = mappability.get(key, 0)
                out.write(f"{chrom}\t{start}\t{mid}\t{marginal_count}\t{is_mappable}\n")


if __name__ == "__main__":
    main()
```

### 8.4 批量运行

```bash
#!/usr/bin/env bash
set -euo pipefail

source ./00_config.sh

for sample in "${SAMPLES[@]}"
do
    echo "=== making fragments for ${sample} ==="

    python "${SCRIPT_DIR}/createFitHiCFragments-fixedsize.withmap.py" \
        --chrLens "${CHROMSIZES}" \
        --resolution "${RESOLUTION}" \
        --mappability "${MAPPABILITY_NOCHR}" \
        --counts "${OUT_DIR}/${sample}_bins_with_counts.bed" \
        --outFile "${OUT_DIR}/${sample}_fragments_fixed_10k.gz" \
        --mapThres "${MAP_THRES}"

    echo "=== ${sample} fragments done ==="
done
```

### 8.5 输出文件解释

输出文件为：

```text
${sample}_fragments_fixed_10k.gz
```

检查方式：

```bash
zcat "${OUT_DIR}/6month_fragments_fixed_10k.gz" | head
```

理想情况下应满足：

- 每行 5 列。
- 第 3 列中点坐标能在 contactCounts 的第 2/4 列中找到。
- 第 4 列不是全 `1`，而是随 bin 覆盖度变化。
- 第 5 列只包含 `0` 和 `1`。

## 九、脚本 4：运行 HiCKRy 和 FitHiC2

### 9.1 原理

HiCKRy 先根据 contactCounts 和 fragments 估计每个 bin 的归一化 bias。FitHiC2 再利用 contactCounts、fragments 和 bias 文件拟合距离背景曲线，并计算每个互作的显著性。

建议在 FitHiC2 中显式设置：

- `-f`：fragments 文件。
- `-i`：contactCounts 文件。
- `-o`：输出目录。
- `-r`：固定 bin 分辨率。
- `--biases`：HiCKRy 生成的 bias 文件。
- `-l`：输出文件名前缀，避免多个样本都叫 `fithic`。
- `-x intraOnly`：默认只分析同染色体互作，适合大多数 loop 或 domain 相关分析。

### 9.2 代码

```bash
#!/usr/bin/env bash
set -euo pipefail

source ./00_config.sh

for sample in "${SAMPLES[@]}"
do
    echo "=== running HiCKRy and FitHiC2 for ${sample} ==="

    interactions="${OUT_DIR}/10k_res_${sample}_fithic.contactCounts.gz"
    fragments="${OUT_DIR}/${sample}_fragments_fixed_10k.gz"
    bias_txt="${OUT_DIR}/${sample}_bias_10k.txt"
    bias_gz="${OUT_DIR}/${sample}_bias_10k.txt.gz"
    sample_out="${OUT_DIR}/10k_res_${sample}_output"

    python "${HICKRY}" \
        -i "${interactions}" \
        -f "${fragments}" \
        -o "${bias_txt}"

    gzip -c "${bias_txt}" > "${bias_gz}"
    mkdir -p "${sample_out}"

    fithic \
        -f "${fragments}" \
        -i "${interactions}" \
        -o "${sample_out}" \
        -r "${RESOLUTION}" \
        --biases "${bias_gz}" \
        -l "10k_res_${sample}" \
        -L "${MIN_CIS_DIST}" \
        -x intraOnly

    echo "=== ${sample} FitHiC2 done ==="
done
```

如果本地安装的 FitHiC2 对 `--biases` 的 gzip 支持有差异，可以把 `bias_gz` 换成 `bias_txt` 测试；但从格式规范上讲，gzip 版本更稳。

## 十、最终输出文件解释

### 10.1 bias 文件

HiCKRy 输出：

```text
${sample}_bias_10k.txt
${sample}_bias_10k.txt.gz
```

格式为：

```text
chr  midpoint  bias
1    5000      0.932
1    15000     1.104
```

解释方式：

- `bias ≈ 1`：该 bin 的整体接触量接近平均水平。
- `bias > 1`：该 bin 原始接触量偏高，可能更容易被捕获。
- `bias < 1`：该 bin 原始接触量偏低。
- 极端 bias 值通常需要警惕，可能来自低覆盖、低 mappability 或异常重复区域。

### 10.2 spline 拟合文件

FitHiC2 输出：

```text
10k_res_${sample}.fithic_pass1.txt
```

这个文件记录 equal-occupancy binning 和 spline 拟合背景，常见字段为：

| 字段 | 含义 |
| --- | --- |
| `avgGenomicDist` | 当前距离分组的平均基因组距离 |
| `contactProb` | 拟合得到的背景接触概率 |
| `stdErr` | 该距离分组接触概率的标准误 |
| `numLocusPairs` | 当前距离分组包含的 bin pair 数 |
| `CCtotal` | 当前距离分组的总 contact count |

它不是最终 loop 表，而是用来检查背景模型是否合理。通常可以画 `avgGenomicDist` 对 `contactProb` 的曲线，正常情况下应呈现随距离增加而下降的趋势。

### 10.3 显著互作文件

FitHiC2 主结果为：

```text
10k_res_${sample}.spline_pass1.significances.txt.gz
```

它会在原始 contactCounts 的 5 列后追加显著性字段：

```text
chr1  mid1  chr2  mid2  contactCount  p-value  q-value  bias1  bias2  ExpCC
```

字段解释：

| 字段 | 含义 |
| --- | --- |
| `chr1/mid1` | 第一个互作端点 |
| `chr2/mid2` | 第二个互作端点 |
| `contactCount` | 观测接触数 |
| `p-value` | 在距离背景和 bias 校正后，该接触数的显著性 |
| `q-value` | BH 多重检验校正后的 FDR |
| `bias1/bias2` | 两个端点的归一化 bias |
| `ExpCC` | FitHiC2 根据距离背景和 bias 估计的期望接触数 |

常用筛选方式：

```bash
zcat "${OUT_DIR}/10k_res_6month_output/10k_res_6month.spline_pass1.significances.txt.gz" |
awk 'BEGIN{OFS="\t"} $7 <= 0.01 {print $0}' \
> "${OUT_DIR}/10k_res_6month_output/10k_res_6month.q0.01.interactions.txt"
```

解释结果时建议同时看：

- `q-value` 是否足够低，例如 `<= 0.01` 或 `<= 0.05`。
- `contactCount` 是否不是孤立的极低计数。
- `ExpCC` 是否明显低于观测值。
- 两个端点是否都位于 mappable 且 coverage 不异常的区域。
- 是否落在重复序列、组装 gap 或染色体边界附近。

## 十一、质控检查

### 11.1 检查 contactCounts 是否为 5 列

```bash
zcat "${OUT_DIR}/10k_res_6month_fithic.contactCounts.gz" |
awk 'NF != 5 {print NR, $0; exit}'
```

没有输出通常表示列数正常。

### 11.2 检查 fragments 是否为 5 列

```bash
zcat "${OUT_DIR}/6month_fragments_fixed_10k.gz" |
awk 'NF != 5 {print NR, $0; exit}'
```

### 11.3 检查 midpoint 是否对齐

```bash
zcat "${OUT_DIR}/10k_res_6month_fithic.contactCounts.gz" |
awk -v r="${RESOLUTION}" '($2 % r != r / 2) || ($4 % r != r / 2) {print NR, $0; exit}'
```

如果没有输出，说明 contactCounts 中点坐标符合 `10 kb` 分辨率。

### 11.4 检查 mappability 是否只有 0/1

```bash
zcat "${OUT_DIR}/6month_fragments_fixed_10k.gz" |
awk '$5 != 0 && $5 != 1 {print NR, $0; exit}'
```

### 11.5 检查低 mappability 比例

```bash
zcat "${OUT_DIR}/6month_fragments_fixed_10k.gz" |
awk '{total += 1; low += ($5 == 0)} END{print low, total, low / total}'
```

如果 `low / total` 极高，通常说明 mappability 文件和 chrom sizes 的染色体命名或坐标没有对齐。

## 十二、常见问题

### 12.1 染色体命名不一致

这是最常见的问题。`chr1` 和 `1` 对程序来说是两个不同染色体。validPairs、chrom sizes、mappability、contactCounts、fragments 必须统一。猪基因组中线粒体如果写作 `MT`，就不要在脚本里写 `chrM`。

### 12.2 fragments 第 4 列不应全是 1

第 4 列代表边际接触量。如果全是 `1`，FitHiC2 仍可能运行，但模型会丢失覆盖度差异信息。更好的做法是像本文这样从 validPairs 统计每个 bin 的 endpoint count。

### 12.3 fragments 第 5 列不应无脑全是 1

第 5 列用于 mappability 过滤。低 mappability 区域容易产生假信号，应根据 mappability 均值转成 `0/1`。本文默认阈值是 `0.2`，可根据实际数据调整。

### 12.4 contactCounts 和 fragments 的 midpoint 必须一致

如果 contactCounts 使用 `5000, 15000, 25000...`，fragments 第 3 列也必须使用同样中点。一个常见错误是 contactCounts 用中点，fragments 却用起点，结果 FitHiC2 找不到对应 fragment。

### 12.5 跨染色体互作不要默认混入主分析

FitHiC2 可以分析 interchromosomal contacts，但跨染色体互作数量多、噪音高，多重检验负担也更重。除非研究问题明确需要，建议主分析先使用 `-x intraOnly`。

## 十三、参考资料

- FitHiC2 官方仓库与输入输出格式说明：https://github.com/ay-lab/fithic
- Kaul A, Bhattacharyya S, Ay F. Identifying statistically significant chromatin contacts from Hi-C data with FitHiC2. *Nature Protocols* 15, 991-1012 (2020). https://doi.org/10.1038/s41596-019-0273-0
- Ay F, Bailey TL, Noble WS. Statistical confidence estimation for Hi-C data reveals regulatory chromatin contacts. *Genome Research* 24, 999-1011 (2014). https://doi.org/10.1101/gr.160374.113
