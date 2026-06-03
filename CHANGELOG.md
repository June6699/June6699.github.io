# Changelog

本仓库变更记录；与 GitHub Release **v1.3.0** 对应。

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased] - 2026-06-03

### 维护

- 补充个人站点仓库维护记录，便于后续发布前追踪零散调整。

## [1.3.0] - 2026-04-05

### 新增

- `scripts/moments_password_hash.ps1`：在终端生成 `HUGO_MOMENTS_PASSWORD_HASH=<hex>`，便于写入 `.env` 或 GitHub Actions Secret。
- `scripts/hash_plain_for_batch.ps1`：仅供 `run_server.bat` 通过 `for /f` 读取标准输出，避免内联 PowerShell 在部分环境下解析失败。
- `CHANGELOG.md`：版本说明入口。
- `run_server.bat` 启动前检查 `python`、`hugo` 是否在 `PATH` 中，失败时给出明确提示（改善资源管理器双击场景）。
- 本地 `hugo server` 增加 `--disableFastRender`，减少环境变量变更后仍看到旧页面的缓存误判。

### 变更

- `run_server.bat`：正文保持 **ASCII-only**，避免 UTF-8 中文在 `cmd` 下按 ANSI 错断行；加载 `.env` 时 **仅当等号右侧非空** 才 `set`，避免 `HUGO_MOMENTS_PASSWORD_HASH=` 清空 Windows 用户环境变量中已配置的哈希；首参明文改由 `hash_plain_for_batch.ps1` 计算哈希。
- `layouts/moments/list.html` 与 `layouts/moments/single.html`：找回邮箱改为 `newScratch` 合并逻辑——默认 `site.Params.sidebarEmail`，非空的 `HUGO_MOMENTS_RECOVERY_EMAIL` 覆盖。
- `assets/css/extended/custom.css`：未解锁时 `[data-moments-gate-root]:not(.is-unlocked) [data-moments-feed]` 使用 `display: none !important`，与 HTML `hidden` 双保险。
- `static/js/moments-gate.js`：检测到整页 **reload** 时清除本会话的 `sessionStorage` 解锁标记，使「未勾选记住设备」时在刷新后需重新输入口令；同标签内列表与子页导航仍共享会话，无需重复输入。
- `.env.example`：补充说明空 `KEY=` 行不会清空用户环境变量。
- `项目结构.md`：同步 §1.2 目录树、§8.4/§8.5 启动与脚本说明、§12.3 哈希与找回邮箱实现细节。

### 修复

- 本地使用 `run_server.bat <口令>` 或用户级 `HUGO_MOMENTS_PASSWORD_HASH` 仍提示「未配置动态区口令哈希」：根因多为 `.env` 空值覆盖与内联哈希命令不稳定，已在本次版本中处理。
- `moments_password_hash.ps1` 在 Windows PowerShell 5.1 下因双引号内 `[...]` 被解析为类型表达式而报错：改为英文文案并用字符串拼接输出错误信息。
- 本地「忘记密码」无法回退到侧栏邮箱：因空字符串 `getenv` 与 `default` 管道行为，已改为 Scratch 显式合并。

### 说明（非代码缺陷）

- 动态区为静态站点前端门禁：正文仍在 HTML 中，RSS 等渠道可能含摘要；高敏感内容需配合私有仓库或后端鉴权。
- 「忘记密码」依赖系统默认邮件客户端；未安装或未配置邮件应用时 `mailto:` 可能无响应。

在 GitHub 上发布 **v1.3.0** 时，可先打 tag `v1.3.0` 再建 Release，描述中可直接粘贴本节「新增 / 变更 / 修复」要点。
