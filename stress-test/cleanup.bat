@echo off
chcp 65001 >nul
title 🧹 Cleanup Stress Test Data

cd /d "%~dp0"

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║               CLEANUP STRESS TEST DATA                       ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

echo ⚠️  This will delete all test auctions and bot users from the database!
echo.

set /p confirm="Are you sure? (y/n): "
if /i not "%confirm%"=="y" (
    echo Cancelled.
    pause
    exit
)

echo.
echo 🧹 Cleaning up...

curl -X DELETE http://localhost:3000/api/stress-test/auctions
echo.
curl -X DELETE http://localhost:3000/api/stress-test/bots
echo.

echo.
echo ✅ Cleanup complete!
pause
