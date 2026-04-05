# June's Blog (Hugo + PaperMod)

由 Jekyll 迁移而来，使用 [Hugo](https://gohugo.io/) + [PaperMod](https://github.com/adityatelange/hugo-PaperMod) 主题。

## 本地运行

仓库根目录的 `hugo.toml` 里 `baseURL` 指向 **线上 GitHub Pages**，用于正式构建；若直接用 `hugo server` 且未覆盖 baseURL，部分主题会用绝对链接跳到公网。

推荐任选其一：

- 运行 **`run_server.bat`**（已设置 `HUGO_BASEURL` 与 `--baseURL http://localhost:1313/`），或
- 手动：`hugo server -D --buildFuture --baseURL "http://localhost:1313/" --appendPort=false`

浏览器打开 http://localhost:1313

站内导航、列表、侧栏等已改为以 **根路径相对链接**（`relLangURL` / `RelPermalink`）为主，即使未传 `--baseURL`，一般也会留在本机域名下；顶栏菜单与页脚已单独覆盖主题模板以保证本地一致。

## 构建

```bash
hugo
```

输出在 `public/`，可部署到 GitHub Pages（仓库名 `June6699.github.io` 时，发布 `public` 到 `main` 分支或使用 GitHub Actions）。

### Gitalk 评论（环境变量）

`clientID` / `clientSecret` **不要**写入 `hugo.toml` 或提交到仓库。构建前请设置：

- **PowerShell**：`$env:GITALK_CLIENT_ID="..."`；`$env:GITALK_CLIENT_SECRET="..."`
- **cmd**：`set GITALK_CLIENT_ID=...` 与 `set GITALK_CLIENT_SECRET=...`

GitHub Actions 已在工作流中读取仓库 **Secrets**：`GITALK_CLIENT_ID`、`GITALK_CLIENT_SECRET`。若未配置，线上构建仍会成功，但评论区不会加载。

若密钥曾出现在历史提交中，请在 [GitHub OAuth App](https://github.com/settings/developers) 中**轮换 Client secrets**。长期更稳妥可考虑改用 Giscus 等方案。

变量名示例见仓库根目录 `.env.example`。

## 写文章（扁平结构）

- 文章：`content/posts/卜算子·自嘲.md`（保留可见文件名，不用 index.md）
- **正文里图片路径**：`./images/卜算子·自嘲/xxx.png`（相对路径，和文件名一致）
- 图片存两处（**只用一个 static 目录**，不重复）：
  - `content/posts/images/卜算子·自嘲/` → Typora 打开 md 时 `./images/` 即指向这里，**本地能看图**
  - 运行 `scripts/sync_images.py` 同步到 `static/images/卜算子·自嘲/` → 正文里 `./images/` 会输出为 `/images/卜算子·自嘲/xxx`，**网页能看图**
- 全站图片统一在 `static/images/`（含 `header_img/` 与各文章子目录），不再使用 `static/posts/images/`。

## 迁移脚本

文章与图片由 `migrate_to_hugo.py`（在 Jekyll 项目根目录）生成，如需重新迁移可再运行该脚本。
