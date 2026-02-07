@echo off
cd /d "%~dp0"
python sync_articles.py
REM 兜底：确保 Win11 资源拷到 img（与 sync 脚本命名一致）
copy "_articles\Win11_right_click.assets\Win11右键正在加载中.png" "img\win11-right-click_Win11右键正在加载中.png" 2>nul
copy "_articles\Win11_right_click.assets\Win11改用传统右键菜单.txt" "img\win11-right-click_Win11改用传统右键菜单.txt" 2>nul
pause
