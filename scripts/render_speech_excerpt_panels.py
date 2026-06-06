# -*- coding: utf-8 -*-
"""Render speech excerpt accordion panels into the graduation-card article."""

from __future__ import annotations

import html
import json
import re
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent.parent
ARTICLE = ROOT / "content" / "posts" / "2026毕业演讲朋友圈图卡.md"
DATA = ROOT / "data" / "speech_excerpts.json"

SECTION_HEADINGS = {
    "lisa-su": "## Lisa Su：把未来押在最难的问题上",
    "jensen-huang": "## Jensen Huang：不要走向未来，要跑过去",
    "elon-musk": "## Elon Musk：把不可能做成现实",
    "mark-zuckerberg": "## Mark Zuckerberg：先开始，想法才会长出来",
    "park-bo-young": "## Park Bo-young：不卷别人，也不输给昨天",
    "steve-jobs": "## Steve Jobs：不要活在别人的剧本里",
    "jeff-bezos": "## Jeff Bezos：聪明是礼物，善良是选择",
    "bill-gates": "## Bill Gates：人生不是单线程任务",
    "tim-cook": "## Tim Cook：建设者要承担后果",
    "sheryl-sandberg": "## Sheryl Sandberg：把 B 计划活成答案",
    "sundar-pichai": "## Sundar Pichai：保持不耐烦，也保持希望",
    "jk-rowling": "## J.K. Rowling：失败之后，想象力让人重新开始",
}


def esc(value: Any) -> str:
    return html.escape(str(value or ""), quote=True)


def normalize_date(value: str) -> str:
    value = (value or "").strip()
    if not value:
        return "发布时间未标注"
    match = re.match(r"(\d{4}-\d{2}-\d{2})", value)
    if match:
        return match.group(1)
    return value[:32]


def source_meta(source: dict[str, Any]) -> str:
    site = source.get("site") or source.get("label") or "Source"
    date = normalize_date(source.get("published", ""))
    return f"{site} · {date}"


def render_sources(sources: list[dict[str, Any]]) -> str:
    links = []
    for source in sources:
        title = source.get("title") or source.get("label") or "阅读全文"
        url = source.get("canonical") or source.get("url")
        meta = source_meta(source)
        links.append(
            "    <li class=\"speech-excerpt__source-item\">"
            f"<a class=\"speech-excerpt__source-link\" href=\"{esc(url)}\">{esc(source.get('label') or title)}</a>"
            f"<span class=\"speech-excerpt__source-meta\">{esc(meta)}</span>"
            f"<span class=\"speech-excerpt__source-title\">{esc(title)}</span>"
            "</li>"
        )
    return "\n".join(links)


def render_panel(item: dict[str, Any]) -> str:
    slug = item["id"]
    body_id = f"speech-panel-{slug}-body"
    toggle_id = f"speech-panel-{slug}-toggle"
    excerpt_en = item.get("excerpt_en") or "No verified short excerpt was collected. Please read the linked source for the full context."
    excerpt_zh = item.get("excerpt_zh") or "暂无可验证短摘录；请打开来源链接阅读完整语境。"
    excerpt_source = item.get("excerpt_source_label") or "来源页"
    source_links = render_sources(item.get("sources", []))

    return f"""<!-- speech-excerpt-panel:start:{slug} -->
<section class="speech-excerpt" data-speech-panel data-speech-id="{esc(slug)}" data-speech-lang="zh">
  <button class="speech-excerpt__toggle" id="{esc(toggle_id)}" type="button" aria-expanded="false" aria-controls="{esc(body_id)}" data-speech-toggle>
    <span class="speech-excerpt__toggle-copy">
      <span class="speech-excerpt__eyebrow">演讲内容</span>
      <strong class="speech-excerpt__title">{esc(item.get("person"))}</strong>
      <span class="speech-excerpt__meta">{esc(item.get("occasion"))}</span>
    </span>
    <span class="speech-excerpt__toggle-icon" aria-hidden="true">展开</span>
  </button>
  <div class="speech-excerpt__body" id="{esc(body_id)}" role="region" aria-labelledby="{esc(toggle_id)}" hidden>
    <div class="speech-excerpt__toolbar" role="group" aria-label="语言切换">
      <button class="speech-excerpt__lang is-active" type="button" data-speech-lang-button="zh" aria-pressed="true">中文</button>
      <button class="speech-excerpt__lang" type="button" data-speech-lang-button="en" aria-pressed="false">English</button>
    </div>
    <div class="speech-excerpt__content" data-speech-content="zh">
      <p class="speech-excerpt__label">中文短译</p>
      <blockquote class="speech-excerpt__quote">{esc(excerpt_zh)}</blockquote>
      <p class="speech-excerpt__note">短摘录来源：{esc(excerpt_source)}。完整语境请阅读下方来源链接。</p>
    </div>
    <div class="speech-excerpt__content" data-speech-content="en" lang="en" hidden aria-hidden="true">
      <p class="speech-excerpt__label">English excerpt</p>
      <blockquote class="speech-excerpt__quote">{esc(excerpt_en)}</blockquote>
      <p class="speech-excerpt__note">Short excerpt source: {esc(excerpt_source)}. Read the linked source for full context.</p>
    </div>
    <ul class="speech-excerpt__sources" aria-label="来源链接">
{source_links}
    </ul>
  </div>
</section>
<!-- speech-excerpt-panel:end:{slug} -->"""


def ensure_front_matter_flag(text: str) -> str:
    match = re.match(r"\A---\n(.*?)\n---\n", text, flags=re.S)
    if not match:
        raise RuntimeError("Article front matter not found.")
    front = match.group(1)
    if re.search(r"^(speechExcerptAccordion|speechexcerptaccordion):\s*true\s*$", front, flags=re.M):
        return text
    new_front = front.replace("author:     June", "author:     June\nspeechexcerptaccordion: true")
    if new_front == front:
        new_front = front + "\nspeechexcerptaccordion: true"
    return text[: match.start(1)] + new_front + text[match.end(1) :]


def strip_existing_panels(text: str) -> str:
    pattern = r"\n?<!-- speech-excerpt-panel:start:[\w-]+ -->.*?<!-- speech-excerpt-panel:end:[\w-]+ -->\n?"
    return re.sub(pattern, "\n", text, flags=re.S)


def insert_panel_after_source_line(text: str, slug: str, panel: str) -> str:
    heading = SECTION_HEADINGS[slug]
    start = text.find(heading)
    if start == -1:
        raise RuntimeError(f"Section heading not found for {slug}: {heading}")
    next_heading = text.find("\n## ", start + len(heading))
    end = len(text) if next_heading == -1 else next_heading
    section = text[start:end]
    source_match = list(re.finditer(r"^来源链接：.*$", section, flags=re.M))
    if not source_match:
        raise RuntimeError(f"Source line not found for {slug}.")
    insert_at = start + source_match[-1].end()
    return text[:insert_at] + "\n\n" + panel + text[insert_at:]


def main() -> int:
    payload = json.loads(DATA.read_text(encoding="utf-8"))
    text = ARTICLE.read_text(encoding="utf-8")
    text = ensure_front_matter_flag(text)
    text = strip_existing_panels(text)
    for item in payload["items"]:
        panel = render_panel(item)
        text = insert_panel_after_source_line(text, item["id"], panel)
    ARTICLE.write_text(text, encoding="utf-8")
    print(f"Updated {ARTICLE.relative_to(ROOT)}")
    print(f"Rendered panels: {len(payload['items'])}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
