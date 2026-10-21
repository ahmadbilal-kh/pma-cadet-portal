@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 24 LTS, then reopen this file.
  pause
  exit /b 1
)
if not exist node_modules\vite\bin\vite.js (
  call npm.cmd ci
  if errorlevel 1 (
    echo Dependency installation failed. Check the error above and your connection.
    pause
    exit /b 1
  )
)
call npm.cmd run dev
pause
