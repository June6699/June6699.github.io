@echo off
chcp 65001 >nul
cd /d "%~dp0"

REM Keep this file ASCII-only: cmd.exe parses .bat as system ANSI; UTF-8 Chinese breaks lines.
set "PYTHON_EXE=C:\softwares\python311\python.exe"
if not exist "%PYTHON_EXE%" (
  where python >nul 2>&1
  if errorlevel 1 (
    echo [ERROR] python.exe not found in PATH or C:\softwares\python311.
    echo Install Python, or add its folder to User PATH, then run this script again.
    pause
    exit /b 1
  ) else (
    set "PYTHON_EXE=python"
  )
)

set "HUGO_EXE=%LOCALAPPDATA%\Microsoft\WinGet\Links\hugo.exe"
if not exist "%HUGO_EXE%" (
  if exist "C:\softwares\hugo\hugo.exe" (
    set "HUGO_EXE=C:\softwares\hugo\hugo.exe"
  ) else (
    where hugo >nul 2>&1
    if errorlevel 1 (
      echo [ERROR] hugo.exe not found in PATH or known fallback locations.
      echo Install Hugo, or add its folder to User PATH, then run this script again.
      pause
      exit /b 1
    ) else (
      set "HUGO_EXE=hugo"
    )
  )
)

REM Only apply .env lines with a non-empty value; empty "KEY=" would otherwise clear User/system env (e.g. HUGO_MOMENTS_PASSWORD_HASH).
if exist ".env" (
  for /f "usebackq eol=# tokens=1,* delims==" %%A in (".env") do (
    if not "%%A"=="" if not "%%B"=="" set "%%A=%%B"
  )
)

if not "%~1"=="" (
  for /f "usebackq delims=" %%H in (`powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\hash_plain_for_batch.ps1" "%~1"`) do set "HUGO_MOMENTS_PASSWORD_HASH=%%H"
  if not defined HUGO_MOMENTS_PASSWORD_HASH (
    echo [ERROR] Could not compute HUGO_MOMENTS_PASSWORD_HASH from argument. Try: powershell -File scripts\hash_plain_for_batch.ps1 "your-password"
    pause
    exit /b 1
  )
)

echo Syncing images: content/posts/images + content/moments -^> static/images ...
"%PYTHON_EXE%" -X utf8 scripts\normalize_markdown_image_paths.py
if errorlevel 1 (
  echo [ERROR] normalize_markdown_image_paths.py failed.
  pause
  exit /b 1
)

"%PYTHON_EXE%" -X utf8 scripts\sync_images.py
if errorlevel 1 (
  echo [ERROR] sync_images.py failed. Check Python and paths above.
  pause
  exit /b 1
)

echo Syncing my_icons -^> static (favicons^) ...
"%PYTHON_EXE%" -X utf8 scripts\sync_icons.py
if errorlevel 1 (
  echo [ERROR] sync_icons.py failed.
  pause
  exit /b 1
)

echo Stopping any existing Hugo server instances...
taskkill /F /IM hugo.exe >nul 2>&1

set "HUGO_SERVER_PORT=1313"
call :can_bind_port %HUGO_SERVER_PORT%
if errorlevel 1 (
  echo [WARN] Port 1313 is unavailable on this system. Trying fallback ports...
  for %%P in (4210 1314 4321 8080) do (
    call :can_bind_port %%P
    if not errorlevel 1 (
      set "HUGO_SERVER_PORT=%%P"
      goto :port_ready
    )
  )
  echo [ERROR] Could not find an available localhost port for Hugo.
  pause
  exit /b 1
)

:port_ready
if defined HUGO_MOMENTS_PASSWORD_HASH (
  echo Moments gate hash loaded.
) else (
  echo [WARN] HUGO_MOMENTS_PASSWORD_HASH not set. Moments page will stay locked.
)

set "HUGO_BASEURL=http://localhost:%HUGO_SERVER_PORT%/"
echo.
echo   Hugo server starting on:
echo   %HUGO_BASEURL%
echo.
echo Press Ctrl+C to stop the server.
start "" cmd /c "timeout /t 2 /nobreak >nul && start "" "%HUGO_BASEURL%""
echo Watching Markdown image paths; newly pasted images are normalized automatically after saving.
"%PYTHON_EXE%" -X utf8 scripts\normalize_markdown_image_paths.py --watch --interval 0.5 -- "%HUGO_EXE%" server -D --buildFuture --baseURL "%HUGO_BASEURL%" --appendPort=false --disableFastRender --port %HUGO_SERVER_PORT%
if errorlevel 1 (
  echo [ERROR] Markdown watcher or Hugo failed. See messages above.
  pause
  exit /b 1
)

goto :eof

:can_bind_port
powershell -NoProfile -Command "try { $listener=[System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, %~1); $listener.Start(); $listener.Stop(); exit 0 } catch { exit 1 }" >nul 2>&1
exit /b %errorlevel%
