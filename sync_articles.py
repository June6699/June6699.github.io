#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从 _articles/ 同步：1) 图片到 img/（扁平，无子文件夹，文件名加 slug_ 前缀防冲突）
                   2) 生成 _posts/（正文路径改为 /img/slug_xxx）
运行：在项目根目录执行 python sync_articles.py 或双击 run_sync.bat
"""
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "_articles"   # 本地编辑用，md + 同级 .assets
IMG = ROOT / "img"
POSTS = ROOT / "_posts"

# img 下保留：整个 flowers 目录 + 这些根文件
KEEP_IMG_FILES = {"404-bg.jpg", "apple-touch-icon.png", "favicon.ico", "底特律·变包.png"}
KEEP_IMG_DIRS = {"flowers"}


def slug_from_name(name):
    """HiCPlot -> hicplot, Win11-Right-Click -> win11-right-click"""
    s = name.strip().lower().replace(" ", "-")
    return re.sub(r"-+", "-", s)


def clear_img_except_keep():
    """删除 img 下除 flowers 和 KEEP_IMG_FILES 以外的所有东西"""
    if not IMG.exists():
        return
    for p in IMG.iterdir():
        if p.name in KEEP_IMG_DIRS:
            continue
        if p.is_file() and p.name in KEEP_IMG_FILES:
            continue
        if p.is_dir():
            shutil.rmtree(p, ignore_errors=True)
        else:
            try:
                p.unlink()
            except Exception:
                pass


def get_assets_slug_map():
    """_articles 里 .md 对应的 assets 文件夹名 -> img 用的前缀 slug。优先 front matter 的 assets_folder。"""
    m = {}
    if not SRC.exists():
        return m
    for f in SRC.iterdir():
        if f.suffix != ".md":
            continue
        name = f.stem
        raw = f.read_text(encoding="utf-8")
        if not raw.startswith("---"):
            continue
        parts = re.split(r"\n---\n", raw, 2)
        if len(parts) < 2:
            continue
        front = parts[1]
        match = re.search(r"assets_folder:\s*(\S+)", front)
        folder = match.group(1).strip() if match else (name + ".assets")
        if not folder.endswith(".assets"):
            folder = folder + ".assets"
        adir = SRC / folder
        if adir.is_dir():
            base = folder[:-7].replace("_", "-")
            m[folder] = slug_from_name(base)
    return m


def copy_article_assets_to_img():
    """把 _articles/*.assets 里每个文件拷到 img/，命名为 slug_原文件名（扁平，无子文件夹）"""
    amap = get_assets_slug_map()
    for folder_name, slug in amap.items():
        src_dir = SRC / folder_name
        if not src_dir.is_dir():
            continue
        for f in src_dir.iterdir():
            if not f.is_file():
                continue
            dest_name = slug + "_" + f.name
            shutil.copy2(f, IMG / dest_name)
        print("  img/ <- {}/ (prefix {})".format(folder_name, slug + "_"))


def rewrite_content(content, assets_to_slug):
    """正文里 ./XXX.assets/文件名 换成 /img/slug_文件名"""
    for assets_name, slug in assets_to_slug.items():
        content = content.replace("./" + assets_name + "/", "/img/" + slug + "_")
        content = content.replace("](./" + assets_name + "/", "](/img/" + slug + "_")
        content = content.replace('src="./' + assets_name + "/", 'src="/img/' + slug + "_",)
        content = content.replace('src="./' + assets_name + '/"', 'src="/img/' + slug + '_"')
    return content


def parse_date_from_front_matter(text):
    """从 front matter 取 date，返回 YYYY-MM-DD"""
    match = re.search(r"^date:\s*(\d{4}-\d{2}-\d{2})", text, re.MULTILINE)
    if match:
        return match.group(1)
    return "2026-01-01"


def generate_posts(assets_to_slug):
    """从 _articles/*.md 生成 _posts/YYYY-MM-DD-slug.md"""
    POSTS.mkdir(parents=True, exist_ok=True)
    if not SRC.exists():
        return
    for f in sorted(SRC.iterdir()):
        if f.suffix != ".md":
            continue
        name = f.stem
        slug = slug_from_name(name.replace("_", "-"))
        raw = f.read_text(encoding="utf-8")
        if not raw.startswith("---"):
            continue
        parts = re.split(r"\n---\n", raw, 2)
        if len(parts) < 3:
            continue
        front, body = parts[1], parts[2]
        date = parse_date_from_front_matter(front)
        front = re.sub(r"\nassets_folder:.*", "", front)
        front = re.sub(r"\narticle:\s*true\s*", "\n", front)
        body = rewrite_content(body, assets_to_slug)
        out_path = POSTS / "{}-{}.md".format(date, slug)
        out_path.write_text("---\n" + front + "\n---\n" + body, encoding="utf-8")
        print("  _posts/{}".format(out_path.name))


def main():
    print("1. Clearing img (keep flowers + important files)...")
    clear_img_except_keep()
    amap = get_assets_slug_map()
    print("2. Copying _articles/*.assets to img/ (flat, slug_ prefix)...")
    copy_article_assets_to_img()
    print("3. Generating _posts from _articles/*.md...")
    generate_posts(amap)
    print("Done.")


if __name__ == "__main__":
    main()
