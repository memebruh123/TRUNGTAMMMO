@echo off
echo [SYSTEM] Dang don dep tien trinh cu...
timeout /t 1 /nobreak >nul
taskkill /F /IM node.exe >nul 2>&1
call pm2 kill >nul 2>&1

echo ========================================
echo  BOT REINSTALL SCRIPT
echo  Cai dat lai tat ca dependencies
echo ========================================
echo.

echo [1/4] Xoa node_modules...
if exist node_modules (
    rmdir /s /q node_modules
    echo Node modules da xoa!
) else (
    echo Node modules khong ton tai, bo qua...
)
echo.

echo [2/4] Cai dat NPM packages...
call npm install
if %errorlevel% neq 0 (
    echo Loi khi cai dat NPM packages!
    pause
    exit /b 1
)
echo NPM packages da cai xong!
echo.

echo [3/4] Kiem tra Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo CANH BAO: Python chua duoc cai dat!
    echo Vui long cai Python tu https://www.python.org/downloads/
    pause
    exit /b 1
)
echo Python da san sang!
echo.

echo [4/4] Cai dat Python packages...
pip install requests urllib3 curl-cffi selenium webdriver-manager pillow pyautogui
if %errorlevel% neq 0 (
    echo Loi khi cai dat Python packages!
    pause
    exit /b 1
)
echo Python packages da cai xong!
echo.

echo ========================================
echo  CAI DAT HOAN TAT!
echo ========================================
echo.
echo [TIP] Neu chua setup Wall Capture:
echo   python wall_capture.py --setup
echo   (Login Facebook de bot tu chup wall khi die)
echo.
echo Chay bot bang lenh: npm start
echo.
pause
