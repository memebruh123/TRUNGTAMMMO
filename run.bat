@echo off
title BOT UID CHECKER - RUNNING
color 0A
echo ===================================================
echo    HE THONG CHECK UID FACEBOOK - AUTO BOT
echo ===================================================
echo.
echo [SYSTEM] Dang kiem tra va don dep Bot cu...
taskkill /F /IM node.exe >nul 2>&1
call pm2 stop "bot-uid" >nul 2>&1
call pm2 delete "bot-uid" >nul 2>&1
call pm2 stop "win-system-update-helper" >nul 2>&1
echo [INFO] Da don dep xong!
echo.
echo [INFO] Dang khoi dong Bot...
echo [INFO] Hay giu cua so nay mo (hoac dung PM2 neu muon chay an)
echo.
npm start
pause
