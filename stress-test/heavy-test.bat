@echo off
chcp 65001 >nul
title ⚡ Heavy Stress Test

cd /d "%~dp0"

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║   HEAVY STRESS TEST - 20 bots, 10 auctions, 5 min duration   ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)

npx ts-node cli.ts --bots 20 --auctions 10 --duration 300

pause
