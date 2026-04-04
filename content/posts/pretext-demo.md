---
title: Pretext 实时重排互动实验
date: 2026-04-03
tags:
  - 有趣的
draft: false
comments: false
---

这个页面不再只是“换背景色”，而是做成真正可交互的 [pretext](https://github.com/chenglou/pretext) 实验：你可以拖动滑块，实时改变文本容器宽度，观察行数和高度的动态变化。

### Pretext Demo 扩展展示

#### Shrinkwrap Showdown（紧凑宽度）
##### 演示效果
<div class="pretext-demo">
<section class="pretext-page">
<div class="pretext-card">
<p class="pretext-intro">左侧是普通块级文本，右侧启用 pretext 的气泡收紧，行数尽量保持一致但宽度更紧凑。</p>
<div class="pretext-grid pretext-compare-grid">
<div class="pretext-card">
<h2>普通文本块</h2>
<p>
在普通布局里，文本块会倾向占满父容器宽度。虽然可读性不差，但很多时候会显得版面“松散”。
</p>
</div>
<div class="pretext-card">
<h2>Pretext 收紧块</h2>
<p data-pretext-bubble="1">
在 pretext 收紧模式里，文本会在不明显增加行数的前提下，自动寻找更合适的紧凑宽度，让信息密度和视觉重心更平衡。
</p>
</div>
</div>
</div>
</section>
</div>

##### 源码（HTML）
```html
<div class="pretext-card">
  <h2>Pretext 收紧块</h2>
  <p data-pretext-bubble="1">
    在 pretext 收紧模式里，文本会自动寻找更合适的紧凑宽度...
  </p>
</div>
```

#### Justification Compared（对齐对比）
##### 演示效果
<div class="pretext-demo pretext-just-demo">
<section class="pretext-page">
<div class="pretext-card pretext-control-card">
<label class="pretext-control-label" for="pretext-just-width-slider">列宽（Justification 对比）</label>
<input id="pretext-just-width-slider" class="pretext-width-slider" type="range" min="240" max="520" value="364" step="2" data-pretext-just-slider="1" />
<div class="pretext-metrics">
<span>列宽：<strong data-pretext-just-width>364px</strong></span>
<span>CSS 行数：<strong data-pretext-just-lines-css>--</strong></span>
<span>Pretext 行数：<strong data-pretext-just-lines-pretext>--</strong></span>
</div>
</div>
<div class="pretext-just-grid">
<div class="pretext-card pretext-justify-box" data-pretext-just-col="1">
<h2>CSS / Greedy</h2>
<p class="pretext-justify-text" data-pretext-just-css="1">
Typography rivers happen when spacing is stretched unevenly. Native greedy justification resolves line by line, which is fast but often produces local artifacts. When the column width changes quickly, visual rhythm can jump between lines.
</p>
</div>
<div class="pretext-card pretext-justify-box" data-pretext-just-col="1">
<h2>Pretext (Hyphenation)</h2>
<p class="pretext-justify-text" data-pretext-height="1" data-pretext-just-pretext="1">
Pretext first measures text arithmetically, then writes stable dimensions back to the DOM. With controlled width and deterministic reflow, transitions are smoother, and spacing variance is lower during interaction.
</p>
</div>
<div class="pretext-card pretext-justify-box" data-pretext-just-col="1">
<h2>Pretext (Knuth-Plass)</h2>
<p class="pretext-justify-text" data-pretext-height="1" data-pretext-just-pretext="1">
Global line breaking chooses a better overall set of breaks instead of committing greedily at each line. That tends to reduce harsh rivers and keeps the paragraph color more even across dynamic width changes.
</p>
</div>
</div>
</section>
</div>

##### 源码（HTML）
```html
<input data-pretext-just-slider="1" type="range" min="240" max="520" value="364" step="2" />
<div class="pretext-just-grid">
  <div class="pretext-card pretext-justify-box" data-pretext-just-col="1">
    <p class="pretext-justify-text" data-pretext-just-css="1">...</p>
  </div>
  <div class="pretext-card pretext-justify-box" data-pretext-just-col="1">
    <p class="pretext-justify-text" data-pretext-height="1" data-pretext-just-pretext="1">...</p>
  </div>
  <div class="pretext-card pretext-justify-box" data-pretext-just-col="1">
    <p class="pretext-justify-text" data-pretext-height="1" data-pretext-just-pretext="1">...</p>
  </div>
</div>
```

#### Editorial Engine（实时重排）
##### 演示效果
<div class="pretext-demo pretext-reflow-demo">
<section class="pretext-page pretext-reflow-scroll">
<div class="pretext-eyebrow">有趣的</div>
<h2 class="pretext-title">Pretext Reflow Lab</h2>
<p class="pretext-intro">
拖动下面滑块，文本会实时重排。右侧指标会同步更新当前宽度、行数与高度。
</p>
<div class="pretext-card pretext-control-card">
<label class="pretext-control-label" for="pretext-width-slider">容器宽度</label>
<input
id="pretext-width-slider"
class="pretext-width-slider"
type="range"
min="220"
max="900"
value="520"
step="2"
data-pretext-slider="1"
/>
<div class="pretext-metrics">
<span>宽度：<strong data-pretext-width-value>520px</strong></span>
<span>行数：<strong data-pretext-line-count>--</strong></span>
<span>高度：<strong data-pretext-height-value>--</strong></span>
</div>
</div>
<div class="pretext-card pretext-reflow-card">
<div class="pretext-reflow-stage" data-pretext-stage="1">
<div class="pretext-reflow-content" data-pretext-height="1" data-pretext-target="1" data-pretext-scroll="1">
你拖动宽度时，脚本会实时测量文本并更新高度与行数，避免传统布局抖动。这个 demo 只作用于“有趣的”这篇文章，其他文章不会被影响。它适合做交互写作、排版实验和阅读器组件。
</div>
</div>
</div>
</section>
</div>

##### 源码（HTML）
```html
<input data-pretext-slider="1" type="range" min="220" max="900" value="520" />
<div data-pretext-stage="1">
  <div data-pretext-height="1" data-pretext-target="1" data-pretext-scroll="1">
    你拖动宽度时，脚本会实时测量文本并更新高度与行数...
  </div>
</div>
```

##### 源码（JS 片段）
```javascript
const slider = demoRoot.querySelector('[data-pretext-slider="1"]');
const target = demoRoot.querySelector('[data-pretext-target="1"]');
slider.addEventListener("input", () => run());
async function run() {
  target.style.width = `${slider.value}px`;
  await applyHeight(pretext, target);
}
```

#### Dragon Flight（巨龙飞行风格）
##### 演示效果
<div class="pretext-demo pretext-dragon-demo">
<section class="pretext-page">
<div class="pretext-card pretext-control-card">
<label class="pretext-control-label" for="pretext-dragon-speed">飞行速度</label>
<input id="pretext-dragon-speed" class="pretext-width-slider" type="range" min="4" max="14" value="8" step="1" data-pretext-dragon-speed="1" />
</div>
<div class="pretext-card pretext-dragon-scene" data-pretext-dragon-scene="1">
<div class="pretext-dragon-flyer" data-pretext-dragon-flyer="1">🐉</div>
<div class="pretext-dragon-body" data-pretext-dragon-body="1">
<p data-pretext-height="1" class="pretext-dragon-text" data-pretext-dragon-text="1">
夜色里，龙翼掠过手抄页的边缘，墨迹像被风掀起的波纹。随着巨龙在页面中飞行，正文块会同步偏移，形成“飞行轨迹影响排版”的动态效果。这个变化不是单纯动画贴图，而是把排版位移与文本高度回写联动起来：龙靠近时，正文左侧留白增大；龙远离时，正文回归中轴。这样在保持可读性的同时，页面会呈现更明显的活体叙事感。
</p>
</div>
</div>
</section>
</div>

##### 源码（HTML）
```html
<input data-pretext-dragon-speed="1" type="range" min="4" max="14" value="8" step="1" />
<div class="pretext-card pretext-dragon-scene" data-pretext-dragon-scene="1">
  <div class="pretext-dragon-flyer" data-pretext-dragon-flyer="1">🐉</div>
  <div class="pretext-dragon-body" data-pretext-dragon-body="1">
    <p data-pretext-height="1" class="pretext-dragon-text" data-pretext-dragon-text="1">...</p>
  </div>
</div>
```

##### 源码（JS 片段）
```javascript
const scene = root.querySelector('[data-pretext-dragon-scene="1"]');
const flyer = root.querySelector('[data-pretext-dragon-flyer="1"]');
const body = root.querySelector('[data-pretext-dragon-body="1"]');
const speedCtl = root.querySelector('[data-pretext-dragon-speed="1"]');

function tick(ts) {
  const dt = ts / 1000;
  const speed = Number(speedCtl?.value || 8);
  const width = Math.max(320, scene.clientWidth || 700);
  const x = ((dt * (40 + speed * 8)) % (width + 160)) - 90;
  flyer.style.transform = `translate(${x}px, 10px)`;
  body.style.setProperty("--dragon-shift", `${Math.sin((x / width) * Math.PI) * 46}px`);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
```

### 原理与复用

#### 项目原理
##### 核心机制
- pretext 先根据字体、文本、容器宽度做纯计算，得到行数和高度。
- 页面侧只接收计算结果并写回 `style.height/width`，避免频繁读写布局。
- 在本项目里，运行时入口是 `static/js/pretext-runtime.js`，通过 `data-pretext-*` 标记按需启用。

##### 运行流程
- 扫描标记：`data-pretext-height="1"` / `data-pretext-bubble="1"`。
- 首次计算：`prepare + layout` 得到高度、行数。
- 变化重算：滑块事件、窗口 resize、`ResizeObserver` 触发增量重算。

#### 为什么能做到丝滑
##### 关键点
- 计算与渲染分离：先算后写，减少布局抖动（layout thrashing）。
- `requestAnimationFrame`：把尺寸写回安排到浏览器绘制节奏里。
- CSS 过渡：`height/width` 使用 `transition`，视觉上连续。
- 约束保护：宽度上限跟随容器变化，避免超出显示范围导致跳变。

#### 其他地方怎么用
##### 最小用法
```html
<div data-pretext-height="1">你的多行文本...</div>
<div data-pretext-bubble="1">你的气泡文本...</div>
```

##### 交互用法
```html
<input data-pretext-slider="1" type="range" min="220" max="900" value="520" />
<div data-pretext-stage="1">
  <div data-pretext-height="1" data-pretext-target="1" data-pretext-scroll="1">
    交互文本...
  </div>
</div>
```

相关参考：
- [Pretext Demos](https://somnai-dreams.github.io/pretext-demos/)
- [chenglou/pretext](https://github.com/chenglou/pretext)

