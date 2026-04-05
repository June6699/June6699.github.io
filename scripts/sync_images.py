# -*- coding: utf-8 -*-
"""
唯一图片源（勿在 static/images 手改后依赖提交）：
  1) content/posts/images/   → static/images/<子目录>/  （文章 ./images/xxx 与站点 /images/xxx）
  2) content/moments/ 下图片 → static/images/moments/<相对路径>  （动态相对路径或正文 ./foo.jpg）

运行 hugo / hugo server / CI 构建前执行一次。本地可用 run_server.bat。
"""
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
POSTS_IMG = ROOT / "content" / "posts" / "images"
MOMENTS = ROOT / "content" / "moments"
DST = ROOT / "static" / "images"
MOMENTS_DST = DST / "moments"

IMG_SUFFIX = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".avif"}


def sync_posts_images() -> int:
    if not POSTS_IMG.is_dir():
        print("[sync_images] 无 content/posts/images，跳过文章图同步")
        return 0
    DST.mkdir(parents=True, exist_ok=True)
    count = 0
    for child in POSTS_IMG.iterdir():
        if child.name.startswith(".") or child.name == "_index.md":
            continue
        if child.is_dir():
            dst_sub = DST / child.name
            if dst_sub.exists():
                shutil.rmtree(dst_sub)
            shutil.copytree(child, dst_sub)
            count += len([p for p in dst_sub.rglob("*") if p.is_file()])
    print(f"[sync_images] content/posts/images -> static/images （{count} 个文件）")
    return count


def sync_moments_images() -> int:
    if not MOMENTS.is_dir():
        print("[sync_images] 无 content/moments，跳过动态图同步")
        return 0
    DST.mkdir(parents=True, exist_ok=True)
    if MOMENTS_DST.exists():
        shutil.rmtree(MOMENTS_DST)
    MOMENTS_DST.mkdir(parents=True, exist_ok=True)
    count = 0
    for path in sorted(MOMENTS.rglob("*")):
        if not path.is_file():
            continue
        if path.suffix.lower() not in IMG_SUFFIX:
            continue
        rel = path.relative_to(MOMENTS)
        out = MOMENTS_DST / rel
        out.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, out)
        count += 1
    print(f"[sync_images] content/moments/*.(图) -> static/images/moments （{count} 个文件）")
    return count


def main():
    sync_posts_images()
    sync_moments_images()
    return 0


if __name__ == "__main__":
    sys.exit(main())
