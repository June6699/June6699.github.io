#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Post 和图片文件夹同步脚本
功能：
1. 根据 md 中的 img-prefix 自动重命名 img 下对应文件夹（每个 md 对应单独 img 文件夹）
2. 将 _posts/assets 移动到 img/<img-prefix> 并更新 md 内图片路径
"""
import os
import re
import sys
import shutil
from pathlib import Path

POSTS_DIR = Path('_posts')
IMG_DIR = Path('img')


def read_front_matter(md_path):
    """读取 md 的 front matter，返回 (front_matter_dict, content_after)"""
    text = md_path.read_text(encoding='utf-8')
    match = re.match(r'^---\s*\n(.*?)\n---\s*\n', text, re.DOTALL)
    if not match:
        return {}, text
    fm = match.group(1)
    content = text[match.end():]
    d = {}
    for line in fm.split('\n'):
        if ':' in line:
            k, v = line.split(':', 1)
            d[k.strip()] = v.strip()
    return d, content


def get_img_prefix_folder(img_prefix_value):
    """从 img-prefix 值提取文件夹名，如 img/Win11_right_click/ -> Win11_right_click"""
    if not img_prefix_value:
        return None
    s = img_prefix_value.strip().rstrip('/')
    if '/' in s:
        return s.split('/')[-1]
    return s


def get_image_folders_from_content(content):
    """从正文中解析出引用的 img 子文件夹名（去重）"""
    patterns = [
        r'\]\(\s*\{\{\s*site\.baseurl\s*\}\}/img/([^/\)]+)',
        r'\]\(\s*/img/([^/\)]+)',
        r'/img/([^/\)\s]+)/',
        r'img/([^/\)\s]+)/',
    ]
    folders = set()
    for p in patterns:
        for m in re.finditer(p, content):
            if m.lastindex and m.group(1) and m.group(1) != 'assets':
                folders.add(m.group(1))
    return list(folders)


def cmd_rename_img_by_prefix():
    """
    功能1：根据 md 里当前的 img-prefix，把正文里正在用的那个 img 子文件夹重命名为 prefix 里的名字。
    通过正文里的图片路径推断「当前用的文件夹」，与 img-prefix 里的文件夹名对比，不一致则重命名并替换正文路径。
    """
    for md_file in sorted(POSTS_DIR.glob('*.md')):
        if not md_file.is_file():
            continue
        fm, content = read_front_matter(md_file)
        prefix_value = fm.get('img-prefix') or fm.get('img_prefix')
        new_folder_name = get_img_prefix_folder(prefix_value)
        if not new_folder_name:
            continue
        new_folder = IMG_DIR / new_folder_name
        old_folders = get_image_folders_from_content(content)
        if not old_folders:
            continue
        old_folder_name = old_folders[0]
        if old_folder_name == new_folder_name:
            continue
        old_folder = IMG_DIR / old_folder_name
        if not old_folder.is_dir():
            continue
        if new_folder.exists() and new_folder != old_folder:
            print(f"跳过 {md_file.name}: 目标已存在 {new_folder}")
            continue
        old_folder.rename(new_folder)
        print(f"重命名: {old_folder} -> {new_folder}")
        new_content = content.replace(f'/img/{old_folder_name}/', f'/img/{new_folder_name}/')
        new_content = new_content.replace(f'img/{old_folder_name}/', f'img/{new_folder_name}/')
        raw = md_file.read_text(encoding='utf-8')
        match = re.match(r'^---\s*\n.*?\n---\s*\n', raw, re.DOTALL)
        if match:
            full_new = raw[:match.end()] + new_content
        else:
            full_new = new_content
        md_file.write_text(full_new, encoding='utf-8')
        print(f"已更新 {md_file.name} 内图片路径")


def cmd_move_assets_and_update_md():
    """
    功能2：将 _posts/assets 下的文件移动到 img/<img-prefix>，并修改引用该 assets 的 md 里的图片路径。
    """
    assets_dir = POSTS_DIR / 'assets'
    if not assets_dir.is_dir():
        print("未找到 _posts/assets 文件夹")
        return
    files = [f for f in assets_dir.iterdir() if f.is_file()]
    if not files:
        print("_posts/assets 为空")
        return
    target_md = None
    target_prefix = None
    for md_file in sorted(POSTS_DIR.glob('*.md')):
        if not md_file.is_file():
            continue
        text = md_file.read_text(encoding='utf-8')
        if 'assets/' not in text and './assets/' not in text:
            continue
        fm, _ = read_front_matter(md_file)
        pv = fm.get('img-prefix') or fm.get('img_prefix')
        folder_name = get_img_prefix_folder(pv)
        if folder_name:
            target_md = md_file
            target_prefix = folder_name
            break
    if not target_md or not target_prefix:
        print("未找到包含 assets 引用且设置了 img-prefix 的 md 文件")
        return
    target_dir = IMG_DIR / target_prefix
    target_dir.mkdir(parents=True, exist_ok=True)
    for f in files:
        dest = target_dir / f.name
        if dest.exists():
            dest.unlink()
        shutil.move(str(f), str(dest))
        print(f"移动: {f.name} -> {target_dir}/")
    text = target_md.read_text(encoding='utf-8')
    base = f"{{{{ site.baseurl }}}}/img/{target_prefix}/"
    new_text = re.sub(
        r'!\[([^\]]*)\]\(\s*(\./)?assets/([^\)]+)\)',
        lambda m: f'![{m.group(1)}]({base}{m.group(3)})',
        text
    )
    if new_text != text:
        target_md.write_text(new_text, encoding='utf-8')
        print(f"已更新 {target_md.name} 内图片路径")
    try:
        assets_dir.rmdir()
    except OSError:
        pass
    else:
        print("已删除空文件夹 _posts/assets")


def main():
    if len(sys.argv) < 2:
        print("用法: sync_img_posts.py <1|2>")
        print("  1 = 根据 img-prefix 重命名 img 文件夹并更新 md 内路径")
        print("  2 = 将 assets 移到 img 对应 prefix 并更新 md 内图片路径")
        return
    cmd = sys.argv[1].strip()
    if cmd == '1':
        cmd_rename_img_by_prefix()
    elif cmd == '2':
        cmd_move_assets_and_update_md()
    else:
        print("请使用 1 或 2")
        sys.exit(1)


if __name__ == '__main__':
    main()
