# June's Blog (Hugo + PaperMod)

由 Jekyll 迁移而来，使用 [Hugo](https://gohugo.io/) + [PaperMod](https://github.com/adityatelange/hugo-PaperMod) 主题。

## 本地运行

仓库根目录的 `hugo.toml` 里 `baseURL` 指向 **线上 top 域名**，用于正式构建；若直接用 `hugo server` 且未覆盖 baseURL，部分主题会用绝对链接跳到公网。

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

## GitHub Actions 发布开关

当前工作流会在 `main` 推送后：

- 用同一份源码构建一次
- 发布到 GitHub Pages（`june6699.github.io`）
- 是否再把同一份 `public/` 通过 SSH 同步到 `june-server`，由 `.github/server-deploy.env` 控制

当前配置：

```bash
DEPLOY_SERVER=false
```

这表示现在只发布 GitHub Pages，不连接服务器，也不执行 `rsync`。需要恢复服务器同步时，把 `.github/server-deploy.env` 改为：

```bash
DEPLOY_SERVER=true
```

GitHub Actions 里需要配置的 Secrets：

- `GITALK_CLIENT_ID`
- `GITALK_CLIENT_SECRET`
- `HUGO_MOMENTS_PASSWORD_HASH`
- `HUGO_MOMENTS_RECOVERY_EMAIL`
- `SERVER_SSH_HOST`
- `SERVER_SSH_PORT`（可选，默认 `22`）
- `SERVER_SSH_USER`
- `SERVER_DEPLOY_PATH`（例如 `/projects/June6699.github.io/public`）
- `SERVER_SSH_PRIVATE_KEY`
- `SERVER_SSH_KNOWN_HOSTS`（可选，建议填）

注意：`ssh june-server` 只是你 Windows 本机的别名，GitHub Actions 里不会认识它，必须填真实主机名或 IP。

本地建议用 `.env` 或 `local-secrets.md` 记一份对照，不要提交真实值。对应关系一般是：

- `SERVER_SSH_HOST=47.109.206.0`
- `SERVER_SSH_PORT=22`
- `SERVER_SSH_USER=root`
- `SERVER_DEPLOY_PATH=/projects/June6699.github.io/public`
- `SERVER_SSH_PRIVATE_KEY` 放 `C:\Users\June\.ssh\june_server_ed25519` 的私钥内容
- `SERVER_SSH_KNOWN_HOSTS` 放 `ssh-keygen -F 47.109.206.0 -f C:\Users\June\.ssh\known_hosts` 的输出

`npm run build` 会同步图片和图标，并用 `https://june6699.top/` 作为 Hugo `baseURL` 构建。视频转 ASCII 页面只在进入该工具页时从 `unpkg` 下载 ffmpeg wasm，不会在进入博客其它页面时加载，也不再提交本地 `ffmpeg-core.wasm`。

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
- **图片只提交在 `content` 里**（`static/images/` 由脚本生成，已 `.gitignore`，避免仓库双份）：
  - 文章：`content/posts/images/<与 md 对应的子目录>/` → 本地打开 `content/posts/某文.md` 时写 `./images/子目录/xxx.png` **能看图**
  - 动态：`content/moments/` 下放图，`photos` 写 `图名.png` 或 `./图名.png`
  - 构建前运行 **`python scripts/sync_images.py`**（`run_server.bat` 会自动跑）→ 复制到 `static/images/`，网页用 `/images/...` **能看图**
- 全站共用图（头图、侧栏等）放在 **`content/posts/images/header_img/`** 等子目录即可，勿再单独维护一套 `static/images` 进 Git。

## 迁移脚本

文章与图片由 `migrate_to_hugo.py`（在 Jekyll 项目根目录）生成，如需重新迁移可再运行该脚本。

