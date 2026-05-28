# Article / Moments 写作流程

这份流程给 Codex、Claude Code 或其他写作助手读取，用来在本 Hugo / PaperMod 站点里新增文章和 moments。

## 1. 写到哪里

- article / 正式文章：写到 `content/posts/`。
- moments / 短记录：写到 `content/moments/`。
- 所有 Markdown 文件必须使用 UTF-8 保存，中文内容写完后要重新读取确认没有乱码。

## 2. 开写前先读什么

1. 先读同类型旧文，确认语气、长度、front matter 和 HTML 小组件用法。
2. 写 article 时优先参考 `content/posts/` 里的相近文章。
3. 写 moments 时优先参考 `content/moments/模版.md` 和最近几篇 moments。
4. 不确定主题归类时，先沿用旧文里已有 tags，不要随便发明太多新分类。

## 3. Article front matter 示例

```yaml
---
title:      文章标题
subtitle:   可选副标题
date:       2026-05-28
author:     June
tags:
    - 随笔
    - 词语
---
```

article 适合完整标题、subtitle、date、author: June、tags。文章可以更完整地展开背景、脉络、分节和总结。

文件命名建议：可直接使用中文标题，如 `近十年来，写给所有人的祝福词.md`；技术文也可以用英文或中英混合标题。

## 4. Moments front matter 示例

```yaml
---
title: "短记录标题"
date: 2026-05-28T20:00:00+08:00
comments: true
ShowToc: true
mood: "Daily Note"
place: "Lab"
photos:

tags:
  - 日常
---
```

moments 适合短记录、当天想法、工具折腾、学习札记。常用字段包括 comments、ShowToc、mood、place、photos、tags。

文件命名建议：`YYYY-MM-DD-主题.md`，例如 `2026-05-28-一次写作记录.md`。

## 5. 写作风格

- 中文为主，段落尽量短，读起来像博客随笔，不要写成报告腔。
- 先有一个清楚的引子，再分节展开，最后收束到一句有余味的总结。
- 可以使用现有文章里的 HTML 块来排版诗句、句子或解释：

```html
<div class="poem-content">
<p class="poem-lines">多喜乐，长安宁。</p>
<p class="poem-interp">愿欢喜多一点，安宁长一点。</p>
</div>
```

- 不确定来源的古风句、网络祝福语，不要硬说出处；可以写“近年常见”“网络祝福语里常见”“带有古典汉语的味道”。
- 需要引用资料时，优先说明来源脉络；若没有把握，不要编具体典故、年份或作者。

## 6. 完成后检查

- 文件路径是否正确：article 在 `content/posts/`，moments 在 `content/moments/`。
- front matter 是否被 `---` 正确包裹。
- 日期是否使用当前日期或用户指定日期。
- 中文是否 UTF-8 正常显示。
- 标题、tags、正文风格是否与站点旧文一致。
