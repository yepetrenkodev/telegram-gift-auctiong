@echo off
chcp 65001 >nul

title Telegram Gift Auction

cd /d %~dp0

echo.
echo ================================================================
echo    TELEGRAM GIFT AUCTION - SETUP
echo ================================================================
echo.

echo [1/6] Checking Node.js...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo      ERROR: Node.js not found!
    echo      Download from: https://nodejs.org/
    pause
    exit /b 1
)
echo      OK

echo [2/6] Checking .env...
if not exist .env (
    if exist .env.example copy .env.example .env >nul
)
echo      OK

echo [3/6] Installing Backend...
if not exist node_modules call npm install
echo      OK

echo [4/6] Installing Frontend...
if exist client (
    if not exist client\node_modules (
        cd client
        call npm install
        cd ..
    )
)
echo      OK

echo [5/6] Installing concurrently + wait-on...
call npm list concurrently >nul 2>&1 || call npm install concurrently --save-dev >nul 2>&1
call npm list wait-on >nul 2>&1 || call npm install wait-on --save-dev >nul 2>&1
echo      OK

echo [6/6] Starting Docker...
docker start mongodb >nul 2>&1
docker start redis >nul 2>&1
echo      OK

echo.
echo ================================================================
echo    STARTING SERVERS (in one window)
echo ================================================================
echo    Backend:  http://localhost:3000
echo    Frontend: http://localhost:5173
echo ================================================================
echo    Frontend will start after Backend is ready...
echo.

npx concurrently -n "BACK,FRONT" -c "blue,green" "npm run dev" "npx wait-on http://localhost:3000/api/health && cd client && npm run dev"

pause