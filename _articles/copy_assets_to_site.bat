@echo off
REM 从 _articles 复制 *.assets 到 _site 里对应文章目录下，这样 HTML 里的相对路径 ./xxx.assets/ 才能找到图。
REM 请先执行 bundle exec jekyll build，再运行本 bat（可双击或在项目根目录执行）。
setlocal
cd /d "%~dp0.."
if not exist _site (
    echo [ERROR] _site 不存在，请先运行: bundle exec jekyll build
    exit /b 1
)
if not exist _site\_articles mkdir _site\_articles
if not exist _site\_articles\HiCPlot mkdir _site\_articles\HiCPlot
if not exist _site\_articles\Win11-Right-Click mkdir _site\_articles\Win11-Right-Click
xcopy "%~dp0HiCPlot.assets" "_site\_articles\HiCPlot\HiCPlot.assets\" /E /I /Y >nul
xcopy "%~dp0Win11_right_click.assets" "_site\_articles\Win11-Right-Click\Win11_right_click.assets\" /E /I /Y >nul
echo [OK] 已复制文章图片到 _site\_articles\ 对应目录。
endlocal
