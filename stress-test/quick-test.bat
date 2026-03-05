@echo off
chcp 65001 >nul
title 🚀 Quick Stress Test

cd /d "%~dp0"

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║   QUICK STRESS TEST - 5 bots, 3 auctions, 2 min duration     ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)

npx ts-node cli.ts --bots 5 --auctions 3 --duration 120

pause
