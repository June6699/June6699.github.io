@echo off
REM 从 _articles 复制 *.assets 到 _site 里对应文章目录下（路径与 Jekyll 输出一致，为小写）。
REM 请先执行 bundle exec jekyll build，再运行本 bat。
setlocal
cd /d "%~dp0.."
if not exist _site (
    echo [ERROR] _site 不存在，请先运行: bundle exec jekyll build
    exit /b 1
)
if not exist _site\_articles mkdir _site\_articles
if not exist _site\_articles\hicplot mkdir _site\_articles\hicplot
if not exist _site\_articles\win11-right-click mkdir _site\_articles\win11-right-click
xcopy "%~dp0HiCPlot.assets" "_site\_articles\hicplot\HiCPlot.assets\" /E /I /Y >nul
xcopy "%~dp0Win11_right_click.assets" "_site\_articles\win11-right-click\Win11_right_click.assets\" /E /I /Y >nul
echo [OK] 已复制文章图片到 _site\_articles\ 对应目录。
endlocal
