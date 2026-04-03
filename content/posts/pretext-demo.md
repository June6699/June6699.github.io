---
title: Pretext 实时重排互动实验
date: 2026-04-03
tags:
  - 有趣的
draft: false
comments: false
---

这个页面不再只是“换背景色”，而是做成真正可交互的 [pretext](https://github.com/chenglou/pretext) 实验：你可以拖动滑块，实时改变文本容器宽度，观察行数和高度的动态变化。

## 实时重排 Demo（拖动看变化）

<div class="pretext-demo pretext-reflow-demo">
<section class="pretext-page pretext-reflow-scroll">
<div class="pretext-eyebrow">有趣的</div>
<h1 class="pretext-title">Pretext Reflow Lab</h1>
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
清晨六点，城市还没有完全醒来，窗外的天光像一层被慢慢推开的纱。你把电脑放在桌角，热水壶轻轻响着，屏幕里是一段尚未定稿的文章。第一行写得很顺，第二行忽然拐进了回忆：去年这个时候，你也在同样的时间坐下，只是那时你写的是“计划”，今天写的是“结果”。文字有时候像水流，碰到窄处就急，到了宽处又缓，你拖动滑块时看到的行数变化，其实就是这种节奏的可视化。

再往下写，故事进入中段。你开始描述一次不算成功的尝试：为了追求完美排版，曾经把样式和逻辑缠在一起，结果每改一处都牵一片。后来你把测量逻辑抽离出来，让“内容是什么”和“如何摆放”分开，页面才慢慢变得可维护。这个过程并不戏剧化，没有突然的顿悟，更多是日复一日的小修正：删掉一段多余代码，补上一条边界限制，给一个变量换个更准确的名字。

午后阳光斜过来，段落越写越长。你在文里记录一个普通但重要的细节：真正让系统稳定的，往往不是最炫的特性，而是那些“用户不会注意到”的处理，比如宽度不要溢出、滚动不要卡顿、指标不要延迟。它们像舞台背后的钢索，不被看见，却决定整场演出是否安全。等你写到这里，滑块已经从 500px 推到 700px，三行变四行，四行又回到三行，像呼吸一样自然。

傍晚时分，文章接近结尾。你回顾这一天，发现最有价值的不是“做成了一个 demo”，而是把复杂问题拆成了几个可验证的小问题：先确认是否触发事件，再确认是否计算正确，最后确认是否符合视觉预期。每一步都能看到反馈，于是焦虑就被具体动作替代。你在最后一段写下：技术写作和程序设计很像，都是在有限空间里安排秩序；当结构清楚，内容就会自己发光。
</div>
</div>
</div>
</section>
</div>

## 以后复用

如果你在其他文章想直接复用“仅高度重算”能力，可以继续使用：

```html
<div data-pretext-height="1">你的多行文本...</div>
```

