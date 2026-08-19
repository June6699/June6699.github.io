#!/usr/bin/env python3
"""Normalize Markdown image destinations that contain unescaped whitespace.

CommonMark requires a destination containing spaces to be enclosed in angle
brackets. Typora and other editors can still generate the more readable form:

    ![alt](./images/a directory/image.png)

This build step rewrites it to:

    ![alt](<./images/a directory/image.png>)

Fenced code blocks and inline code spans are intentionally left untouched.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
CONTENT_DIR = ROOT / "content"
LOCAL_PATH_PREFIXES = ("./", "../", "/")
FENCE_RE = re.compile(r"^(?P<indent> {0,3})(?P<fence>`{3,}|~{3,})")
TITLE_RE = re.compile(
    r"^(?P<destination>.+)(?P<separator>[ \t]+)"
    r"(?P<title>\"(?:\\.|[^\"\\])*\"|'(?:\\.|[^'\\])*'|\((?:\\.|[^)\\])*\))$"
)


def _has_unescaped_whitespace(value: str) -> bool:
    escaped = False
    for char in value:
        if escaped:
            escaped = False
            continue
        if char == "\\":
            escaped = True
            continue
        if char.isspace():
            return True
    return False


def _normalize_destination(inner: str) -> tuple[str, bool]:
    leading_length = len(inner) - len(inner.lstrip(" \t"))
    trailing_length = len(inner) - len(inner.rstrip(" \t"))
    leading = inner[:leading_length]
    trailing = inner[len(inner) - trailing_length :] if trailing_length else ""
    body_end = len(inner) - trailing_length if trailing_length else len(inner)
    body = inner[leading_length:body_end]

    if not body or body.startswith("<"):
        return inner, False

    destination = body
    suffix = ""
    title_match = TITLE_RE.match(body)
    if title_match:
        destination = title_match.group("destination")
        suffix = title_match.group("separator") + title_match.group("title")

    if not destination.startswith(LOCAL_PATH_PREFIXES):
        return inner, False

    if not _has_unescaped_whitespace(destination):
        return inner, False

    return f"{leading}<{destination}>{suffix}{trailing}", True


def _find_closing_bracket(line: str, start: int) -> int | None:
    depth = 1
    index = start
    while index < len(line):
        char = line[index]
        if char == "\\":
            index += 2
            continue
        if char == "[":
            depth += 1
        elif char == "]":
            depth -= 1
            if depth == 0:
                return index
        index += 1
    return None


def _find_closing_parenthesis(line: str, start: int) -> int | None:
    depth = 1
    index = start
    quote: str | None = None
    while index < len(line):
        char = line[index]
        if char == "\\":
            index += 2
            continue
        if quote:
            if char == quote:
                quote = None
            index += 1
            continue
        if char in {'"', "'"}:
            quote = char
        elif char == "(":
            depth += 1
        elif char == ")":
            depth -= 1
            if depth == 0:
                return index
        index += 1
    return None


def _normalize_line(line: str) -> tuple[str, int]:
    output: list[str] = []
    changes = 0
    index = 0

    while index < len(line):
        if line[index] == "`":
            run_end = index
            while run_end < len(line) and line[run_end] == "`":
                run_end += 1
            delimiter = line[index:run_end]
            closing = line.find(delimiter, run_end)
            if closing == -1:
                output.append(line[index:])
                break
            closing += len(delimiter)
            output.append(line[index:closing])
            index = closing
            continue

        if line.startswith("![", index):
            bracket_end = _find_closing_bracket(line, index + 2)
            if bracket_end is not None and bracket_end + 1 < len(line) and line[bracket_end + 1] == "(":
                parenthesis_end = _find_closing_parenthesis(line, bracket_end + 2)
                if parenthesis_end is not None:
                    inner = line[bracket_end + 2 : parenthesis_end]
                    normalized, changed = _normalize_destination(inner)
                    output.append(line[index : bracket_end + 2])
                    output.append(normalized)
                    output.append(")")
                    changes += int(changed)
                    index = parenthesis_end + 1
                    continue

        output.append(line[index])
        index += 1

    return "".join(output), changes


def normalize_document(text: str) -> tuple[str, int]:
    output: list[str] = []
    changes = 0
    fence_character: str | None = None
    fence_length = 0

    for line in text.splitlines(keepends=True):
        fence_match = FENCE_RE.match(line)
        if fence_character:
            output.append(line)
            if fence_match:
                fence = fence_match.group("fence")
                remainder = line[fence_match.end() :].rstrip("\r\n")
                if fence[0] == fence_character and len(fence) >= fence_length and not remainder.strip(" \t"):
                    fence_character = None
                    fence_length = 0
            continue

        if fence_match:
            fence = fence_match.group("fence")
            fence_character = fence[0]
            fence_length = len(fence)
            output.append(line)
            continue

        normalized, line_changes = _normalize_line(line)
        output.append(normalized)
        changes += line_changes

    return "".join(output), changes


def normalize_file(path: Path, check_only: bool) -> int:
    with path.open("r", encoding="utf-8", errors="strict", newline="") as source:
        original = source.read()
    normalized, changes = normalize_document(original)
    if changes and not check_only:
        with path.open("w", encoding="utf-8", errors="strict", newline="") as target:
            target.write(normalized)
    return changes


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="Report files that need normalization without changing them.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    changed_files = 0
    changed_destinations = 0

    for path in sorted(CONTENT_DIR.rglob("*.md"), key=lambda item: item.as_posix()):
        changes = normalize_file(path, args.check)
        if not changes:
            continue
        changed_files += 1
        changed_destinations += changes
        action = "needs normalization" if args.check else "normalized"
        print(f"[markdown-images] {action}: {path.relative_to(ROOT)} ({changes})")

    if not changed_files:
        print("[markdown-images] all image destinations are valid")
        return 0

    print(
        f"[markdown-images] {'found' if args.check else 'updated'} "
        f"{changed_destinations} destination(s) in {changed_files} file(s)"
    )
    return 1 if args.check else 0


if __name__ == "__main__":
    sys.exit(main())
