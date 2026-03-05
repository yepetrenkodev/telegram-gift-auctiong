@echo off
chcp 65001 >nul
title 🤖 Stress Test - Telegram Gift Auction

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║                                                              ║
echo ║   🤖 TELEGRAM GIFT AUCTION - STRESS TEST                     ║
echo ║                                                              ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

cd /d "%~dp0"

echo 📦 Checking dependencies...
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)

echo.
echo ⚠️  Make sure the backend server is running on port 3000!
echo    Run 'npm run dev' in the main project folder first.
echo.
echo 🚀 Starting Stress Test CLI...
echo.
echo Commands: start, stop, status, add N, cleanup, exit
echo.

call npx ts-node --transpile-only cli.ts %*

pause
