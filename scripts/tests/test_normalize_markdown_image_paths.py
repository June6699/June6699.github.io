from __future__ import annotations

import sys
import unittest
from pathlib import Path


SCRIPTS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS_DIR))

from normalize_markdown_image_paths import normalize_document  # noqa: E402


class NormalizeMarkdownImagePathsTest(unittest.TestCase):
    def test_wraps_chinese_path_with_spaces(self) -> None:
        source = "![photo](./images/中文 目录/photo.png)\n"
        expected = "![photo](<./images/中文 目录/photo.png>)\n"
        self.assertEqual(normalize_document(source), (expected, 1))

    def test_preserves_optional_title(self) -> None:
        source = '![photo](./images/a directory/photo.png "A title")\n'
        expected = '![photo](<./images/a directory/photo.png> "A title")\n'
        self.assertEqual(normalize_document(source), (expected, 1))

    def test_is_idempotent_for_angle_bracket_destination(self) -> None:
        source = "![photo](<./images/a directory/photo.png>)\n"
        self.assertEqual(normalize_document(source), (source, 0))

    def test_ignores_fenced_and_inline_code(self) -> None:
        source = (
            "```markdown\n"
            "![example](./images/a directory/photo.png)\n"
            "```\n"
            "`![inline](./images/a directory/photo.png)` "
            "![real](./images/a directory/photo.png)\n"
        )
        expected = source.replace(
            "![real](./images/a directory/photo.png)",
            "![real](<./images/a directory/photo.png>)",
        )
        self.assertEqual(normalize_document(source), (expected, 1))

    def test_supports_parentheses_and_multiple_images(self) -> None:
        source = "![a](./images/a directory/a(1).png) ![b](./images/b directory/b.png)\n"
        expected = "![a](<./images/a directory/a(1).png>) ![b](<./images/b directory/b.png>)\n"
        self.assertEqual(normalize_document(source), (expected, 2))

    def test_leaves_escaped_spaces_unchanged(self) -> None:
        source = r"![photo](./images/a\ directory/photo.png)" + "\n"
        self.assertEqual(normalize_document(source), (source, 0))

    def test_leaves_external_destination_unchanged(self) -> None:
        source = "![photo](https://example.com/a directory/photo.png)\n"
        self.assertEqual(normalize_document(source), (source, 0))


if __name__ == "__main__":
    unittest.main()
