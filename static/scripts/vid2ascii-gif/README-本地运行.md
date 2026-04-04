# ASCII 字符视频引擎 · 本地运行说明

本目录依赖 **FFmpeg WASM** 与 **COI Service Worker**，浏览器安全策略要求页面必须通过 **HTTP/HTTPS** 提供，**不能**用资源管理器双击 `index.html`（`file://` 协议）。

## Windows：一键启动（推荐）

1. 确认已安装 Python 3，且可在终端执行 `python`。
2. 在本目录双击 **`run_vidascii-git.bat`**。
3. 在浏览器打开：**http://localhost:8000/index.html**

关闭黑窗口即停止服务。

## 手动启动 HTTP 服务

在本目录执行：

```bat
python -m http.server 8000
```

然后访问 `http://localhost:8000/index.html`。

## 放在本博客（Hugo）里预览

在博客仓库根目录：

```bat
hugo server
```

浏览器访问：**http://localhost:1313/scripts/vid2ascii-gif/**（或你配置的端口）。

线上 GitHub Pages 为 HTTPS，一般可直接打开对应路径，无需再开 Python 服务。

## 同目录必备文件（除 `history` 示例外）

| 文件 | 说明 |
|------|------|
| `index.html` | 页面 |
| `coi-serviceworker.js` | 跨域隔离 / SharedArrayBuffer |
| `ffmpeg.min.js` | FFmpeg 封装 |
| `ffmpeg-core.js` / `ffmpeg-core.wasm` | 核心 |
| `814.ffmpeg.js` | UMD 分包，部分环境下加载需要 |
| `background.jpg` | 背景图 |
| `run_vidascii-git.bat` | 本地 `http.server` |

若初始化失败，请打开开发者工具 (F12) → **Network**，确认上述文件均为 **200**（无 404）。

## 重新下载依赖（可选）

见同目录 **`download-ffmpeg-assets.md`**（PowerShell 下载脚本示例）。
