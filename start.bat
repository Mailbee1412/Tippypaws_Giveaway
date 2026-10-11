@echo off
chcp 65001 >nul
cd /d "%~dp0"

if not exist node_modules (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo.
    echo npm install failed.
    pause
    exit /b 1
  )
)

echo Starting gift bot...
echo (Press Ctrl+C to stop)
echo.
node src/index.js
echo.
echo Bot stopped.
pause
