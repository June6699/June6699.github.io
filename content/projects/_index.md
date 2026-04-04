---
title: "我的项目"
description: "本地 Python 工具与浏览器内演示，互链说明见各子页。"
ShowToc: false
comments: false
disableAnchoredHeadings: true
---

<style>
.projects-hub { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.25rem; margin: 1.5rem 0 2rem; }
.projects-hub a.project-card {
  display: block; padding: 1.25rem 1.35rem; border-radius: 12px; text-decoration: none;
  border: 1px solid var(--border); background: var(--entry);
  transition: border-color 0.2s, box-shadow 0.2s;
}
.projects-hub a.project-card:hover {
  border-color: var(--tertiary, #00aeff); box-shadow: 0 4px 24px rgba(13, 110, 253, 0.12);
}
:root[data-theme="dark"] .projects-hub a.project-card:hover {
  box-shadow: 0 4px 24px rgba(0, 230, 118, 0.08);
}
.project-card h2 { margin: 0 0 0.5rem 0; font-size: 1.15rem; color: var(--primary); }
.project-card p { margin: 0; font-size: 0.92rem; line-height: 1.55; color: var(--secondary); }
.project-card .tag { display: inline-block; margin-top: 0.75rem; font-size: 0.75rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--tertiary, #6ea8fe); }
</style>

本站托管两个小项目：**Python 本地转换**（含部署说明与可下载脚本）与**纯前端**（FFmpeg WASM，无需后端）。

<div class="projects-hub">

<a class="project-card" href="/scripts/ascii-generator/guide.html" target="_blank" rel="noopener noreferrer">
  <h2>ASCII Generator（Python）</h2>
  <p>图片/视频转 ASCII，依赖 OpenCV 与 Pillow。含环境配置、命令示例与脚本下载路径。</p>
  <span class="tag">打开说明页 →</span>
</a>

<a class="project-card" href="/scripts/vid2ascii-gif/index.html" target="_blank" rel="noopener noreferrer">
  <h2>ASCII 字符视频引擎（浏览器）</h2>
  <p>本地选视频即可解析、播放、存档与导出 MP4。若克隆仓库到本地，勿双击打开 HTML：请运行 <code>static/scripts/vid2ascii-gif/run_vidascii-git.bat</code> 或阅读同目录 <code>README-本地运行.md</code>。</p>
  <span class="tag">打开演示页 →</span>
</a>

</div>

脚本与静态资源位于仓库 `static/scripts/` 下：`ascii-generator/` 与 `vid2ascii-gif/` 分目录存放，避免混用路径。
