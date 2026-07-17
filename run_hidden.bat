@echo off
title Windows Update Service Helper
color 0F

echo [SYSTEM] Initializing service...

:: Check PM2
where pm2 >nul 2>nul
if %errorlevel% neq 0 (
    echo [SYSTEM] Installing PM2...
    call npm install -g pm2
)

:: Ensure PM2 daemon is alive
call pm2 resurrect >nul 2>&1

:: Stop & remove old process
echo [SYSTEM] Cleaning old service...
call pm2 stop win-system-update-helper >nul 2>&1
call pm2 delete win-system-update-helper >nul 2>&1

:: Start bot hidden
echo [SYSTEM] Starting background service...
call pm2 start bottt.js --name win-system-update-helper --time
call pm2 save --force

echo.
echo ============================================
echo  STATUS: SERVICE RUNNING (BACKGROUND MODE)
echo ============================================
echo Process name : win-system-update-helper
echo You can close this window safely.
echo.

pause
