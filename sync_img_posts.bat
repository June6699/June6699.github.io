@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo  ================================
echo    Post 与图片文件夹同步工具
echo  ================================
echo.
echo  请选择要执行的功能（输入数字后回车）：
echo.
echo    [1] 根据 img-prefix 重命名 img 文件夹
echo        （修改 md 里 img-prefix 后，把对应 img 子文件夹改成新名字并更新正文路径）
echo.
echo    [2] 将 assets 移到 img 并更新 md 内图片路径
echo        （把 _posts/assets 移到 img/^<img-prefix^>，并改 md 里的图片链接）
echo.
echo    [3] 将 _posts 下 *.assets 复制到 img（供 HTML 显示）
echo        （md 仍用同级 .assets，Typora 可见；构建前运行 3 即可）
echo.
set /p choice=  输入 1、2 或 3：
if "%choice%"=="1" goto run1
if "%choice%"=="2" goto run2
if "%choice%"=="3" goto run3
echo 无效输入，请运行后重新选择 1、2 或 3。
pause
exit /b 1
:run1
python "%~dp0sync_img_posts.py" 1
goto end
:run2
python "%~dp0sync_img_posts.py" 2
goto end
:run3
python "%~dp0sync_img_posts.py" 3
goto end
:end
echo.
pause
