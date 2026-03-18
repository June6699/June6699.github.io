---
title: "SnapATAC与Seurat版本兼容性问题"
date: 2026-03-18
tags:
  - 生信
  - 生信/分析
draft: false
---

### 一、问题背景

在使用 SnapATAC 的 `snapToSeurat()` 函数将 ATAC snap 对象转换为 Seurat 对象时，遭遇一系列版本兼容性问题。根本原因是当前环境安装的是 **Seurat v5**，而 SnapATAC 依赖 **Seurat v4** 的接口。

---

### 二、报错流程与解决方案

#### 1. snapToSeurat 报错：DimReduc global slot

**报错信息**

```sh
Error in validObject(.Object) : 
  类别为"DimReduc"的对象不对: 'global' must be a 1-length logical
```

**原因**

Seurat v5 对 `DimReduc` 对象的 `global` slot 验证更严格，SnapATAC 内部创建方式与 v5 不兼容。

**解决方案**

降级 Seurat 至 v4，新建 conda 环境隔离：

```bash
conda create -n seurat_v4 r-base=4.3
conda activate seurat_v4
```

---

#### 2. 安装 Seurat v4 时：SeuratObject 不可用

**报错信息**

```text
ERROR: dependency 'SeuratObject' is not available for package 'Seurat'
```

**解决方案**

从 GitHub 按顺序分别安装，先装 SeuratObject：

```r
remotes::install_github("mojaveazure/seurat-object@v4.1.4")
remotes::install_github("satijalab/seurat@v4.4.0")
```

---

#### 3. 安装 SeuratObject 时：Matrix 版本不满足

**报错信息**

```text
package 'Matrix' is not available for this version of R
```

**原因**

CRAN 最新 Matrix 要求 R >= 4.4，而当前 R 版本较低，需手动指定归档版本。

**解决方案**

从 CRAN 归档直接安装 Matrix 1.6.1：

```bash
conda install -c conda-forge r-matrix=1.6.1
```

或在 R 内：

```r
install.packages(
  "https://cran.r-project.org/src/contrib/Archive/Matrix/Matrix_1.6-1.tar.gz",
  repos = NULL,
  type  = "source"
)
```

---

#### 4. 安装 Seurat v4 时：sctransform 版本不满足

**报错信息**

```text
namespace 'sctransform' 0.3.4 is being loaded, but >= 0.4.0 is required
ERROR: lazy loading failed for package 'Seurat'
```

**解决方案**

先升级 sctransform，再重装 Seurat：

```r
remotes::install_github("ChristophH/sctransform@v0.4.1")
remotes::install_github("satijalab/seurat@v4.4.0")
```

---

#### 5. snapToSeurat 仍报错：rownames 无法设置

**报错信息**

```text
Error in `rownames<-`(x = `*tmp*`, value = paste0(obj@barcode, 1:ncell)) : 
  attempt to set 'rownames' on an object with no dimensions
```

**原因**

`eigs.dims` 参数写成了标量 `18`，应为向量 `1:18`。

**解决方案**

```r
pbmc.atac <- snapToSeurat(
    obj       = x.sp,
    eigs.dims = 1:18,   # ← 必须是向量
    norm      = TRUE,
    scale     = TRUE
)
```

---

### 三、最终成功环境

| 软件 | 版本 |
| --- | --- |
| R | 4.3.x |
| Seurat | 4.4.0 |
| SeuratObject | 4.1.4 |
| Matrix | 1.6.5 |
| SnapATAC | 1.0.0 |
| sctransform | >= 0.4.0 |

**核心教训**：SnapATAC 1.x 与 Seurat v5 不兼容，必须在独立 conda 环境中使用 Seurat v4，且各依赖包版本需严格对应。

