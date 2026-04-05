@echo off
chcp 65001 >nul
cd /d "%~dp0"

REM Keep this file ASCII-only: cmd.exe parses .bat as system ANSI; UTF-8 Chinese breaks lines.
where python >nul 2>&1
if errorlevel 1 (
  echo [ERROR] python.exe not found in PATH.
  echo Install Python with "Add to PATH", or add its folder to User PATH.
  echo If it works in IDE terminal but not when double-clicking this file, PATH differs; run from terminal.
  pause
  exit /b 1
)
where hugo >nul 2>&1
if errorlevel 1 (
  echo [ERROR] hugo.exe not found in PATH.
  echo Add Hugo to User PATH ^(e.g. WinGet Links folder^), then run this script from cmd/PowerShell.
  pause
  exit /b 1
)

if exist ".env" (
  for /f "usebackq eol=# tokens=1,* delims==" %%A in (".env") do (
    if not "%%A"=="" set "%%A=%%B"
  )
)

if not "%~1"=="" (
  set "MOMENTS_PASSWORD_PLAIN=%~1"
  for /f "usebackq delims=" %%H in (`powershell -NoProfile -Command "$s=$env:MOMENTS_PASSWORD_PLAIN; $bytes=[System.Text.Encoding]::UTF8.GetBytes($s); $hash=[System.Security.Cryptography.SHA256]::Create().ComputeHash($bytes); -join ($hash | ForEach-Object { $_.ToString('x2') })"`) do set "HUGO_MOMENTS_PASSWORD_HASH=%%H"
  set "MOMENTS_PASSWORD_PLAIN="
)

echo Syncing content/posts/images -^> static/images ...
python scripts\sync_images.py
if errorlevel 1 (
  echo [ERROR] sync_images.py failed. Check Python and paths above.
  pause
  exit /b 1
)

echo Syncing my_icons -^> static (favicons^) ...
python scripts\sync_icons.py
if errorlevel 1 (
  echo [ERROR] sync_icons.py failed.
  pause
  exit /b 1
)

echo Starting Hugo server (http://localhost:1313/) ...
echo Press Ctrl+C to stop the server.
REM Force local baseURL; change port here and in hugo server line if needed.
if defined HUGO_MOMENTS_PASSWORD_HASH (
  echo Moments gate hash loaded.
) else (
  echo [WARN] HUGO_MOMENTS_PASSWORD_HASH not set. Moments page will stay locked.
)
set "HUGO_BASEURL=http://localhost:1313/"
hugo server -D --buildFuture --baseURL "http://localhost:1313/" --appendPort=false
if errorlevel 1 (
  echo [ERROR] Hugo failed to start. See messages above.
  pause
  exit /b 1
)
