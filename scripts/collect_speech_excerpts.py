# -*- coding: utf-8 -*-
"""Collect source metadata and short verified speech excerpts.

The collector intentionally stores only very short excerpts. It does not
download or persist full transcripts.
"""

from __future__ import annotations

import datetime as dt
import html
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlparse

import requests


ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "speech_excerpts.json"

MAX_EXCERPT_WORDS = 25

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/126.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.7,zh;q=0.6",
}


PEOPLE: list[dict[str, Any]] = [
    {
        "id": "lisa-su",
        "person": "Lisa Su",
        "occasion": "MIT Commencement 2026",
        "sources": [
            {
                "label": "MIT News",
                "url": "https://news.mit.edu/2026/commencement-address-lisa-su-0528",
            }
        ],
        "candidates": [
            {
                "en": "Bet your future on the hardest problems.",
                "zh": "把未来押在最难的问题上。",
            },
            {
                "en": "Technology itself does not decide what the future looks like.",
                "zh": "技术本身不会决定未来的样子。",
            }
        ],
    },
    {
        "id": "jensen-huang",
        "person": "Jensen Huang",
        "occasion": "Carnegie Mellon Commencement 2026",
        "sources": [
            {
                "label": "CMU News",
                "url": "https://www.cmu.edu/news/stories/archives/2026/may/nvidia-founder-ceo-jensen-huang-to-carnegie-mellon-university-graduates-shape-what-comes-next",
            },
            {
                "label": "NVIDIA Blog",
                "url": "https://blogs.nvidia.com/blog/nvidia-ceo-carnegie-mellon-commencement-address/",
            },
        ],
        "candidates": [
            {
                "en": "Don't walk into the future. Run.",
                "zh": "不要慢慢走向未来，要跑过去。",
            },
            {
                "en": "The answer is not to fear the future.",
                "zh": "答案不是害怕未来。",
            },
            {
                "en": "Shape what comes next.",
                "zh": "塑造接下来会发生的事。",
            }
        ],
    },
    {
        "id": "elon-musk",
        "person": "Elon Musk",
        "occasion": "Caltech Commencement 2012",
        "sources": [
            {
                "label": "C-SPAN",
                "url": "https://www.c-span.org/video/?306109-1/california-institute-technology-commencement-address",
            }
        ],
        "candidates": [
            {
                "en": "I think it is possible for ordinary people to choose to be extraordinary.",
                "zh": "普通人也可以选择成为不普通的人。",
            }
        ],
    },
    {
        "id": "mark-zuckerberg",
        "person": "Mark Zuckerberg",
        "occasion": "Harvard Commencement 2017",
        "sources": [
            {
                "label": "Harvard Gazette",
                "url": "https://news.harvard.edu/gazette/story/2017/05/mark-zuckerbergs-speech-as-written-for-harvards-class-of-2017/",
            }
        ],
        "candidates": [
            {
                "en": "Ideas don't come out fully formed.",
                "zh": "想法不会一开始就完整成形。",
            }
        ],
    },
    {
        "id": "park-bo-young",
        "person": "Park Bo-young",
        "occasion": "Baeksang Arts Awards 2026",
        "sources": [
            {
                "label": "MK English",
                "url": "https://www.mk.co.kr/en/entertain/12044203",
            }
        ],
        "candidates": [
            {
                "en": "I hate competition, but I don't want to lose to yesterday's self.",
                "zh": "我讨厌竞争，但不想输给昨天的自己。",
            }
        ],
    },
    {
        "id": "steve-jobs",
        "person": "Steve Jobs",
        "occasion": "Stanford Commencement 2005",
        "sources": [
            {
                "label": "Stanford Report",
                "url": "https://news.stanford.edu/stories/2005/06/youve-got-find-love-jobs-says",
            }
        ],
        "candidates": [
            {
                "en": "You've got to find what you love.",
                "zh": "你必须找到自己热爱的东西。",
            }
        ],
    },
    {
        "id": "jeff-bezos",
        "person": "Jeff Bezos",
        "occasion": "Princeton Baccalaureate 2010",
        "sources": [
            {
                "label": "Princeton",
                "url": "https://www.princeton.edu/news/2010/05/30/2010-baccalaureate-remarks",
            }
        ],
        "candidates": [
            {
                "en": "Cleverness is a gift, kindness is a choice.",
                "zh": "聪明是礼物，善良是选择。",
            }
        ],
    },
    {
        "id": "bill-gates",
        "person": "Bill Gates",
        "occasion": "NAU Commencement 2023",
        "sources": [
            {
                "label": "GatesNotes",
                "url": "https://www.gatesnotes.com/NAU-Commencement-Speech",
            }
        ],
        "candidates": [
            {
                "en": "You are not a slacker if you cut yourself some slack.",
                "zh": "给自己一点余地，并不等于你在偷懒。",
            }
        ],
    },
    {
        "id": "tim-cook",
        "person": "Tim Cook",
        "occasion": "Stanford Commencement 2019",
        "sources": [
            {
                "label": "Stanford Report",
                "url": "https://news.stanford.edu/2019/06/16/remarks-tim-cook-2019-stanford-commencement/",
            }
        ],
        "candidates": [
            {
                "en": "If you want to take credit, first learn to take responsibility.",
                "zh": "如果想收获赞誉，先学会承担责任。",
            }
        ],
    },
    {
        "id": "sheryl-sandberg",
        "person": "Sheryl Sandberg",
        "occasion": "UC Berkeley Commencement 2016",
        "sources": [
            {
                "label": "Los Angeles Times",
                "url": "https://www.latimes.com/local/california/la-sheryl-sandberg-commencement-address-transcript-20160514-story.html",
            }
        ],
        "candidates": [
            {
                "en": "I learned about the depths of sadness and the brutality of loss.",
                "zh": "我理解了悲伤的深度，也理解了失去的残酷。",
            }
        ],
    },
    {
        "id": "sundar-pichai",
        "person": "Sundar Pichai",
        "occasion": "Dear Class of 2020",
        "sources": [
            {
                "label": "Google Blog",
                "url": "https://blog.google/products/youtube/sundar-pichai-message-class-2020/",
            }
        ],
        "candidates": [
            {
                "en": "Be impatient. It will create the progress the world needs.",
                "zh": "保持不耐烦，它会创造世界需要的进步。",
            }
        ],
    },
    {
        "id": "jk-rowling",
        "person": "J.K. Rowling",
        "occasion": "Harvard Commencement 2008",
        "sources": [
            {
                "label": "Harvard Gazette",
                "url": "https://news.harvard.edu/gazette/story/2008/06/text-of-j-k-rowling-speech/",
            }
        ],
        "candidates": [
            {
                "en": "Failure meant a stripping away of the inessential.",
                "zh": "失败意味着剥离掉那些不必要的东西。",
            }
        ],
    },
]


class PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.title_parts: list[str] = []
        self.meta: dict[str, str] = {}
        self.canonical = ""
        self.text_parts: list[str] = []
        self._tag_stack: list[str] = []
        self._in_title = False
        self._skip_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_dict = {k.lower(): v or "" for k, v in attrs}
        tag = tag.lower()
        self._tag_stack.append(tag)
        if tag in {"script", "style", "noscript", "svg"}:
            self._skip_depth += 1
        if tag == "title":
            self._in_title = True
        if tag == "meta":
            key = attrs_dict.get("property") or attrs_dict.get("name")
            value = attrs_dict.get("content", "").strip()
            if key and value:
                self.meta[key.lower()] = html.unescape(value)
        if tag == "link" and "canonical" in attrs_dict.get("rel", "").lower():
            self.canonical = attrs_dict.get("href", "").strip()
        if tag in {"p", "div", "li", "br", "section", "article", "h1", "h2", "h3"}:
            self.text_parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag == "title":
            self._in_title = False
        if tag in {"script", "style", "noscript", "svg"} and self._skip_depth:
            self._skip_depth -= 1
        if self._tag_stack:
            self._tag_stack.pop()
        if tag in {"p", "div", "li", "section", "article", "h1", "h2", "h3"}:
            self.text_parts.append("\n")

    def handle_data(self, data: str) -> None:
        if self._skip_depth:
            return
        text = data.strip()
        if not text:
            return
        if self._in_title:
            self.title_parts.append(text)
        self.text_parts.append(text)
        self.text_parts.append(" ")

    @property
    def visible_text(self) -> str:
        lines = []
        for line in "".join(self.text_parts).splitlines():
            clean = re.sub(r"\s+", " ", line).strip()
            if clean:
                lines.append(clean)
        return "\n".join(lines)

    @property
    def title(self) -> str:
        return re.sub(r"\s+", " ", " ".join(self.title_parts)).strip()


def normalize_for_match(value: str) -> str:
    value = html.unescape(value)
    value = value.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def count_english_words(value: str) -> int:
    return len(re.findall(r"[A-Za-z]+(?:['-][A-Za-z]+)?", value))


def pick_meta(parser: PageParser, keys: list[str]) -> str:
    for key in keys:
        value = parser.meta.get(key.lower(), "").strip()
        if value:
            return value
    return ""


def fetch_source(source: dict[str, str], candidates: list[dict[str, str]]) -> dict[str, Any]:
    url = source["url"]
    result: dict[str, Any] = {
        "label": source["label"],
        "url": url,
        "status": "unfetched",
        "title": "",
        "site": "",
        "published": "",
        "canonical": url,
        "excerpt_en": "",
        "excerpt_zh": "",
        "excerpt_word_count": 0,
    }
    try:
        response = requests.get(url, headers=HEADERS, timeout=20, allow_redirects=True)
        result["status_code"] = response.status_code
        result["final_url"] = response.url
        if not response.ok:
            result["status"] = "http_error"
            return result
        parser = PageParser()
        parser.feed(decode_response(response))
        canonical = parser.canonical
        if canonical:
            canonical = urljoin(response.url, canonical)
        result["canonical"] = canonical or response.url or url
        result["title"] = (
            pick_meta(parser, ["og:title", "twitter:title", "title"])
            or parser.title
            or source["label"]
        )
        result["site"] = (
            pick_meta(parser, ["og:site_name", "application-name"])
            or urlparse(result["canonical"]).netloc
        )
        result["published"] = pick_meta(
            parser,
            [
                "article:published_time",
                "date",
                "dc.date",
                "dcterms.created",
                "pubdate",
                "publishdate",
            ],
        )
        text_norm = normalize_for_match(parser.visible_text)
        for candidate in candidates:
            excerpt = candidate["en"].strip()
            words = count_english_words(excerpt)
            if words > MAX_EXCERPT_WORDS:
                continue
            if normalize_for_match(excerpt) in text_norm:
                result["excerpt_en"] = excerpt
                result["excerpt_zh"] = candidate["zh"].strip()
                result["excerpt_word_count"] = words
                break
        result["status"] = "ok"
        return result
    except Exception as exc:  # noqa: BLE001 - collector should not block site generation.
        result["status"] = "fetch_error"
        result["error"] = str(exc)
        return result


def decode_response(response: requests.Response) -> str:
    try:
        text = response.content.decode("utf-8", errors="replace")
        replacement_ratio = text.count("\ufffd") / max(1, len(text))
        if replacement_ratio < 0.005:
            return text
    except Exception:
        pass
    encoding = response.encoding or response.apparent_encoding or "utf-8"
    return response.content.decode(encoding, errors="replace")


def build_payload() -> dict[str, Any]:
    items = []
    for person in PEOPLE:
        sources = [fetch_source(source, person["candidates"]) for source in person["sources"]]
        selected = next((source for source in sources if source.get("excerpt_en")), None)
        items.append(
            {
                "id": person["id"],
                "person": person["person"],
                "occasion": person["occasion"],
                "excerpt_en": selected.get("excerpt_en", "") if selected else "",
                "excerpt_zh": selected.get("excerpt_zh", "") if selected else "",
                "excerpt_source_label": selected.get("label", "") if selected else "",
                "excerpt_word_count": selected.get("excerpt_word_count", 0) if selected else 0,
                "sources": sources,
            }
        )
    return {
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "max_excerpt_words": MAX_EXCERPT_WORDS,
        "items": items,
    }


def main() -> int:
    payload = build_payload()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    verified = sum(1 for item in payload["items"] if item["excerpt_en"])
    print(f"Wrote {OUT.relative_to(ROOT)}")
    print(f"Verified short excerpts: {verified}/{len(payload['items'])}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
