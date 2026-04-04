---
title: "本地化动态 ASCII 字符视频渲染系统"
date: 2026-04-03
author: June
tags:
  - 记录
draft: false
---

## 本地化动态字符视频渲染系统：开发与迭代实录

本文档完整记录了“本地化动态 ASCII 字符视频渲染系统”从最初的构想、踩坑、架构推翻到最终实现纯前端视频压制、字幕解析完全体的全过程。

---

## 项目起源与初探：基于 Pretext 的构想

在项目初期，我们的核心诉求是将视频的每一帧转化为 ASCII 字符并在浏览器中高帧率播放。前端渲染大量长文本换行时，极易触发 DOM 回流（Reflow），导致页面卡顿甚至崩溃。

因此，最初的架构设计引入了 `@chenglou/pretext` —— 一个纯算术排版引擎，试图在内存中瞬间计算文本边界以规避 DOM 性能瓶颈。

### 踩坑 1：ESM 模块加载与依赖缺失
在最初编写了 `index.html` 并使用 Live Server 启动后，系统一直卡在“系统环境挂载中，请稍候...”。
**Bug 分析：** 代码中使用了 `<script type="module">` 导入 `layout.js`。而 ES Module 要求严格的依赖解析，由于本地缺失了 `pretext` 引擎的底层依赖（如 `bidi.js`, `analysis.js` 等），导致浏览器抛出 404 错误并直接中断了整段脚本的执行。
**修复方案：** 严格按照包版本（`@0.0.3`），使用 PowerShell 补齐了所有的前置依赖文件：
```powershell
Invoke-WebRequest -Uri "https://cdn.jsdelivr.net/npm/@chenglou/pretext@0.0.3/dist/analysis.js" -OutFile "analysis.js"
# ... 同理补齐 measurement.js, bidi.js, line-break.js
```

### 踩坑 2：FFmpeg (v0.12) 的隐藏 Worker 线程
依赖补齐后，Pretext 引擎成功启动，但 `ffmpegInstance.load()` 陷入了无限期的死等（Promise 既不 Resolve 也不 Reject）。
**Bug 分析：** 版本兼容性问题。`@ffmpeg/ffmpeg@0.12.x` 的 UMD 打包版本在底层会默认拉起一个名为 `814.ffmpeg.js` 的 Web Worker 子线程。本地缺少该文件导致 Worker 启动失败，主线程死锁。
**修复方案：** 单独下载补齐该 Worker 文件，系统环境终于成功挂载。

---

## 核心引擎点亮：从假数据到真像素提取

### 修复 1：File API 读取陷阱
在选中视频准备解析时，触发了 `currentVideoFile.arrayBuffer is not a function` 的报错。
**Bug 分析：** `videoInput.files` 返回的是一个 `FileList` 对象，而非单个 `File` 对象。
**代码修正：**
```javascript
// 错误代码
currentVideoFile = videoInput.files; 
// 正确代码：获取数组第一个元素
currentVideoFile = videoInput.files[0]; 
```

### 进化 1：灰度算法与字符映射引擎
初版代码中，系统只是在死循环里打印 `动态文本渲染中...` 的假数据。为了真正将视频变成字符，我们引入了离屏 Canvas （Offscreen Canvas）进行像素级验血。
```javascript
// 核心像素提取与转译代码
const offscreenCanvas = document.createElement('canvas');
const offCtx = offscreenCanvas.getContext('2d', { willReadFrequently: true });
const chars = " .:-=+*#%@"; // 引入10级留白灰度表增强对比度

offCtx.drawImage(img, 0, 0);
const imageData = offCtx.getImageData(0, 0, img.width, img.height).data;

let asciiFrame = "";
for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
        const offset = (y * img.width + x) * 4;
        const r = imageData[offset], g = imageData[offset + 1], b = imageData[offset + 2];
        // 经典心理学灰度公式
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        const charIndex = Math.floor((gray / 255) * (chars.length - 1));
        asciiFrame += chars[charIndex];
    }
    asciiFrame += "\n";
}
```

---

## 破除封印与架构重构：全片解析与内存溢出

### 解决 1：30 帧鬼畜与 NaN 进度条
初期硬编码了 `-vframes 30` 导致无论视频多长只渲染前 30 帧（疯狂鬼畜）。
**改版优化：** 将参数改为 `-r 15`（设置采样率），并采用 `while(true)` 动态读取，直到 FFmpeg 抛出找不到文件的异常才停止。同时修复了 FFmpeg v0.12 中进度变量名变更导致的 `NaN%` Bug：
```javascript
// FFmpeg v0.12 版本进度监听
ffmpegInstance.on('progress', ({ progress }) => { // 变量名从 ratio 变为了 progress
    if (progress !== undefined && !isNaN(progress)) {
        const percent = Math.max(0, Math.min(100, Math.round(progress * 100)));
        progressText.innerText = `视频解帧进度: ${percent}%`;
    }
});
```

### 架构顿悟：Pretext 的退役
随着开发的深入，我们发现字符视频实际上是一个**绝对完美的矩形矩阵**。
如果我们强制使用等宽字体（`monospace`），画面的物理宽高就可以通过极简的乘法直接算出：`宽度 = 列数 * 单字符宽`，根本不需要动态折行。
**历史性优化：** 彻底删除了重金求来的 `pretext` 引擎及那 5 个 `*.js` 依赖，改用 1:1 的网格强制映射，不仅彻底消灭了黑边，还将渲染性能提升到了极限。

```javascript
// 大道至简的网格布局引擎
ctx.font = '12px monospace';
const charWidth = ctx.measureText('M').width;
const lineHeight = charWidth; // 强行设为 1:1 正方形，消除画面拉伸畸变

renderCanvas.width = cachedAsciiFrames[0].split('\n')[0].length * charWidth;
renderCanvas.height = cachedAsciiFrames[0].split('\n').length * lineHeight;
```

---

## 体验飞跃：绝对同步与交互系统

### 核心黑科技：音频时间戳驱动的音画同步
传统的 `requestAnimationFrame` 死循环无法保证音画同步（浏览器一卡顿就会声画分离）。
**最终方案：** 将提取出的原视频作为背景音频偷偷播放，**以音频的当前时间戳逆向推算当前应该渲染哪一帧**。
```javascript
let frameIndex = Math.floor(globalAudio.currentTime * cachedFps);
if (frameIndex >= cachedAsciiFrames.length) frameIndex = cachedAsciiFrames.length - 1;
// 画面永远跟着 globalAudio 走，哪怕拖动进度条也能瞬间对齐
```

### 沉浸式全屏与本地指纹点赞 (Q键)
* **安全沙盒绕过：** 浏览器无法获取绝对路径，因此使用 `${File.name}_${File.size}` 生成唯一数字指纹，以此作为 `localStorage` 记录点赞数的 Key。
* **全屏 API：** 挂载 `renderCanvas.requestFullscreen()` 实现 B 站级别的纯黑沉浸式观影。

---

## 极客狂欢：秒读存档、MP4硬编与外挂字幕

### 内存溢出 (OOM) 引发的“外挂音轨”架构
为了实现“渲染一次，下次秒看”，我们开发了导出 `.asciivid` 的功能。
**灾难发生：** 最初试图将几百兆的音频转为 Base64 塞进 JSON 一起导出，导致 V8 引擎字符串长度超限，浏览器瞬间崩溃，存档损坏。
**优雅降维：** 存档文件**只保存纯文本矩阵**。读取存档时，玩家可以手动传入原视频文件作为“外挂音轨”。若无音轨，则启用高精度时钟 `performance.now()` 进行纯视觉无声播放。

### 解析外挂 SRT 字幕
利用正则手搓了 SRT 时间轴解析器，并将字幕强行绘制在 Canvas 的最上层：
```javascript
function parseSrtTimecode(timeString) {
    const parts = timeString.replace(',', '.').split(':');
    return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
}
// 使用正则提取开始时间、结束时间和字幕文本
const regex = /(\d+)\r?\n(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})\r?\n([\s\S]*?)(?=(?:\r?\n\r?\n\d+|$))/g;
```

### 终极暴力美学：浏览器端压制 MP4
这是最挑战性能的一环。我们将几千帧 ASCII 字符串逆向画在离屏 Canvas 上，转成 JPEG 喂回 FFmpeg，最后混入 AAC 音轨，调用 `libx264` 导出真正的 MP4 视频（实现硬字幕烙印）。
```javascript
// 离屏渲染 JPEG 帧 (采用纯黑底色)
expCtx.fillStyle = "#000000";
expCtx.fillRect(0, 0, expCanvas.width, expCanvas.height);
// ... 绘制字符和字幕 ...
const imgData = await canvasToUint8Array(expCanvas);
await ffmpegInstance.writeFile(`out_${i.toString().padStart(5, '0')}.jpg`, imgData);

// 极速硬编指令 (preset ultrafast 缓解浏览器 CPU 压力)
await ffmpegInstance.exec([
    '-framerate', cachedFps.toString(), '-i', 'out_%05d.jpg', '-i', virtualAudioName,
    '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28', 
    '-pix_fmt', 'yuv420p', '-shortest', 'ascii_output.mp4'
]);
```

### 终结 UI 阻塞：纯 Canvas 重绘原生交互
**恶性 Bug：** 在全屏模式下，按 `Q` 连续点赞触发的原生 `confirm()` 弹窗会阻塞主线程，导致全屏状态锁死、页面卡死（但声音还在播）。
**极客修复：** 彻底抛弃 DOM 弹窗，采用游戏开发的思路，在 Canvas 的 `renderLoop` 中增加了一个 `isPromptingLike` 状态锁。当状态触发时，停止画面更新，直接在 Canvas 中心用 `fillRect` 和 `fillText` 绘制出一个黑客帝国风格的交互界面，通过监听 `Y / N` 键完成闭环，彻底告别阻塞。

---

## 开发与运行注意事项

#### 1. 跨域隔离 (COOP/COEP) 策略
FFmpeg.wasm 需要 `SharedArrayBuffer` 才能运行，这要求网页必须处于严苛的跨域隔离环境中。
* 项目必须依赖 `coi-serviceworker.js`。
* **注意：** 首次启动或强制刷新后，Service Worker 才会接管网络。如果在 VSCode 的 Live Server 中遇到死循环挂载，建议开启无痕模式或按下 `Ctrl + F5` 强制刷新。

#### 2. 内存管理与资源泄漏
* WebAssembly 虚拟文件系统 (MEMFS) 在浏览器中有内存上限（通常 2GB-4GB）。
* 在循环处理（如抽帧、渲染 JPEG）后，务必使用 `await ffmpegInstance.deleteFile(fileName)` 及时删除内存中的文件。
* 大量生成 Blob URL 后，务必调用 `URL.revokeObjectURL(url)` 释放显存，否则处理长视频必崩。

#### 3. 字幕与格式限制
* SRT 文件需确保为 UTF-8 编码，否则正则匹配中文字符时可能会出现乱码。
* 导出的 MP4 使用了 `yuv420p` 像素格式，以确保主流播放器（如 QuickTime, Windows 媒体播放器）的兼容性。