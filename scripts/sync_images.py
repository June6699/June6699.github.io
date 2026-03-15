# -*- coding: utf-8 -*-
"""将 content/posts/images/ 同步到 static/posts/images/，保证 Hugo 能输出 /posts/images/。运行 hugo server 前执行一次即可。"""
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "content" / "posts" / "images"
DST = ROOT / "static" / "posts" / "images"

def main():
    if not SRC.is_dir():
        print("[sync_images] 源目录不存在，跳过:", SRC)
        return 0
    DST.mkdir(parents=True, exist_ok=True)
    count = 0
    for child in SRC.iterdir():
        if child.name.startswith(".") or child.name == "_index.md":
            continue
        if child.is_dir():
            dst_sub = DST / child.name
            if dst_sub.exists():
                shutil.rmtree(dst_sub)
            shutil.copytree(child, dst_sub)
            count += len(list(dst_sub.rglob("*")))
    print(f"[sync_images] 已同步 content/posts/images -> static/posts/images （{count} 个文件）")
    return 0

if __name__ == "__main__":
    sys.exit(main())
