@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\start-app.ps1"
if errorlevel 1 (
  echo.
  echo Startup failed.
  pause
  exit /b 1
)
echo.
echo Startup command sent. Keep the backend and frontend windows open.
pause
