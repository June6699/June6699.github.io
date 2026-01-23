#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Post和图片文件夹同步脚本
功能：
1. 当md文件重命名时，自动同步重命名对应的img子文件夹
2. 当img子文件夹重命名时，自动同步重命名对应的md文件
3. 确保每个post都有对应的img子文件夹
"""
import os
import re
import sys
from pathlib import Path

# 定义目录路径
POSTS_DIR = Path('_posts')
IMG_DIR = Path('img')

def get_md_name_without_ext(md_path):
    """获取md文件名（不含扩展名）"""
    return md_path.stem

def get_img_folder_name(md_path):
    """根据md文件路径获取对应的img文件夹名"""
    return get_md_name_without_ext(md_path)

def sync_md_to_img():
    """
    同步md文件到img文件夹
    为每个md文件创建对应的img子文件夹
    """
    for md_file in POSTS_DIR.glob('*.md'):
        md_name = get_md_name_without_ext(md_file)
        img_folder = IMG_DIR / md_name
        
        if not img_folder.exists():
            img_folder.mkdir(parents=True, exist_ok=True)
            print(f"创建img文件夹: {img_folder}")

def sync_img_to_md():
    """
    检查img文件夹是否有对应的md文件
    如果img文件夹存在但没有对应的md文件，给出警告
    """
    for img_folder in IMG_DIR.iterdir():
        if img_folder.is_dir():
            md_file = POSTS_DIR / f"{img_folder.name}.md"
            if not md_file.exists():
                print(f"警告: img文件夹 {img_folder} 存在但没有对应的md文件")

def sync_rename(old_path, new_path, is_md=True):
    """
    同步重命名操作
    Args:
        old_path: 旧路径
        new_path: 新路径
        is_md: 是否为md文件重命名（True为md文件，False为img文件夹）
    """
    if is_md:
        # md文件重命名时，同步重命名img文件夹
        old_md = Path(old_path)
        new_md = Path(new_path)
        if old_md.exists() and old_md.suffix == '.md':
            old_name = old_md.stem
            new_name = new_md.stem
            old_img_folder = IMG_DIR / old_name
            new_img_folder = IMG_DIR / new_name
            
            if old_img_folder.exists():
                old_img_folder.rename(new_img_folder)
                print(f"重命名img文件夹: {old_img_folder} -> {new_img_folder}")
    else:
        # img文件夹重命名时，同步重命名md文件
        old_img_folder = Path(old_path)
        new_img_folder = Path(new_path)
        if old_img_folder.exists() and old_img_folder.is_dir():
            old_name = old_img_folder.name
            new_name = new_img_folder.name
            old_md = POSTS_DIR / f"{old_name}.md"
            new_md = POSTS_DIR / f"{new_name}.md"
            
            if old_md.exists():
                old_md.rename(new_md)
                print(f"重命名md文件: {old_md} -> {new_md}")

def update_img_prefix_in_md(md_file, new_prefix):
    """
    更新md文件中的img-prefix配置
    Args:
        md_file: md文件路径
        new_prefix: 新的img前缀路径
    """
    with open(md_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 匹配front matter部分
    front_matter_pattern = r'^---\s*\n(.*?)\n---\s*\n'
    match = re.match(front_matter_pattern, content, re.DOTALL)
    
    if match:
        front_matter = match.group(1)
        # 如果已存在img-prefix，则更新；否则添加
        if 'img-prefix:' in front_matter:
            front_matter = re.sub(r'img-prefix:\s*.*', f'img-prefix: {new_prefix}', front_matter)
        else:
            front_matter += f'\nimg-prefix: {new_prefix}'
        
        new_content = f'---\n{front_matter}\n---\n' + content[match.end():]
    else:
        # 如果没有front matter，则添加
        new_content = f'---\nimg-prefix: {new_prefix}\n---\n{content}'
    
    with open(md_file, 'w', encoding='utf-8') as f:
        f.write(new_content)

def main():
    """主函数，处理命令行参数"""
    if len(sys.argv) < 2:
        # 默认执行同步操作
        sync_md_to_img()
        return
    
    command = sys.argv[1]
    
    if command == 'sync':
        # 同步所有md文件和img文件夹
        sync_md_to_img()
        sync_img_to_md()
    elif command == 'rename-md':
        # 重命名md文件时同步重命名img文件夹
        if len(sys.argv) < 4:
            print("用法: sync_post_img.py rename-md <旧md路径> <新md路径>")
            return
        sync_rename(sys.argv[2], sys.argv[3], is_md=True)
    elif command == 'rename-img':
        # 重命名img文件夹时同步重命名md文件
        if len(sys.argv) < 4:
            print("用法: sync_post_img.py rename-img <旧img路径> <新img路径>")
            return
        sync_rename(sys.argv[2], sys.argv[3], is_md=False)
    elif command == 'update-prefix':
        # 更新md文件中的img-prefix配置
        if len(sys.argv) < 4:
            print("用法: sync_post_img.py update-prefix <md文件> <新前缀>")
            return
        update_img_prefix_in_md(Path(sys.argv[2]), sys.argv[3])

if __name__ == '__main__':
    main()