# June's Blog (Hugo + PaperMod)

由 Jekyll 迁移而来，使用 [Hugo](https://gohugo.io/) + [PaperMod](https://github.com/adityatelange/hugo-PaperMod) 主题。

## 本地运行

```bash
hugo server -D
```

浏览器打开 http://localhost:1313

## 构建

```bash
hugo
```

输出在 `public/`，可部署到 GitHub Pages（仓库名 `June6699.github.io` 时，发布 `public` 到 `main` 分支或使用 GitHub Actions）。

## 写文章（扁平结构）

- 文章：`content/posts/卜算子·自嘲.md`（保留可见文件名，不用 index.md）
- **正文里图片路径**：`./images/卜算子·自嘲/xxx.png`（相对路径，和文件名一致）
- 图片存**两处**（迁移脚本会双写）：
  - `content/posts/images/卜算子·自嘲/` → Typora 打开 md 时 `./images/` 即指向这里，**本地能看图**
  - `static/images/posts/卜算子·自嘲/` → Hugo 构建时正文里的 `./images/` 会替换成 `/images/posts/`，**网页能看图**
- 无需 junction、无需改 Typora 设置。

## 迁移脚本

文章与图片由 `migrate_to_hugo.py`（在 Jekyll 项目根目录）生成，如需重新迁移可再运行该脚本。
