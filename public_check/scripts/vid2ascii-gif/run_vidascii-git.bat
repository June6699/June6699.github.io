@echo off
:: 解决 Windows 终端中文乱码核心命令
chcp 65001 >nul
set PYTHONIOENCODING=utf-8

cls
echo ==============================================
echo  本地服务器已启动
echo  访问：http://localhost:8000
echo ==============================================
echo.

:: 进入当前目录
cd /d "%~dp0"

:: 启动 Python 服务器（不会乱码了）
python -m http.server 8000

pause