@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

title 🔧 Полная установка Telegram Gift Auction

echo.
echo ╔════════════════════════════════════════════════════════════════╗
echo ║                                                                ║
echo ║   🔧 Полная установка Telegram Gift Auction                   ║
echo ║                                                                ║
echo ║   Этот скрипт установит ВСЕ зависимости с нуля                ║
echo ║                                                                ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.

cd /d "%~dp0"

:: ===================== ПРОВЕРКИ =====================
echo ═══════════════════════════════════════════════════════════════
echo   ПРОВЕРКА СИСТЕМЫ
echo ═══════════════════════════════════════════════════════════════
echo.

:: Node.js
echo Проверка Node.js...
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js НЕ УСТАНОВЛЕН!
    echo.
    echo    Скачайте и установите Node.js LTS:
    echo    https://nodejs.org/
    echo.
    echo    После установки перезапустите этот скрипт.
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do echo ✅ Node.js: %%i

:: npm
where npm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ npm не найден!
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('npm -v') do echo ✅ npm: v%%i

:: Git
where git >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    for /f "tokens=*" %%i in ('git --version') do echo ✅ %%i
) else (
    echo ⚠️  Git не найден ^(опционально^)
)

:: Docker
where docker >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    docker info >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo ✅ Docker: работает
        set DOCKER_OK=1
    ) else (
        echo ⚠️  Docker: установлен, но не запущен
        set DOCKER_OK=0
    )
) else (
    echo ⚠️  Docker: не установлен
    set DOCKER_OK=0
)

echo.

:: ===================== ОЧИСТКА =====================
echo ═══════════════════════════════════════════════════════════════
echo   ОЧИСТКА СТАРЫХ ЗАВИСИМОСТЕЙ
echo ═══════════════════════════════════════════════════════════════
echo.

if exist "node_modules" (
    echo 🗑️  Удаляю node_modules...
    rmdir /s /q "node_modules"
    echo ✅ Backend node_modules удалён
)

if exist "client\node_modules" (
    echo 🗑️  Удаляю client/node_modules...
    rmdir /s /q "client\node_modules"
    echo ✅ Frontend node_modules удалён
)

if exist "package-lock.json" (
    del /q "package-lock.json"
    echo ✅ package-lock.json удалён
)

if exist "client\package-lock.json" (
    del /q "client\package-lock.json"
    echo ✅ client/package-lock.json удалён
)

echo.

:: ===================== КОНФИГУРАЦИЯ =====================
echo ═══════════════════════════════════════════════════════════════
echo   КОНФИГУРАЦИЯ
echo ═══════════════════════════════════════════════════════════════
echo.

if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo ✅ .env создан из .env.example
    ) else (
        echo 📝 Создаю .env с настройками по умолчанию...
        (
            echo # Server
            echo PORT=3000
            echo NODE_ENV=development
            echo.
            echo # MongoDB
            echo MONGODB_URI=mongodb://localhost:27017/telegram-auction
            echo.
            echo # Redis  
            echo REDIS_URL=redis://localhost:6379
            echo.
            echo # JWT
            echo JWT_SECRET=super-secret-jwt-key-change-me-in-production
            echo JWT_EXPIRES_IN=7d
            echo.
            echo # Telegram Bot ^(получите токен у @BotFather^)
            echo TELEGRAM_BOT_TOKEN=your-bot-token-here
            echo.
            echo # Auction Settings
            echo ANTI_SNIPE_THRESHOLD_SECONDS=30
            echo ANTI_SNIPE_EXTENSION_SECONDS=15
            echo MAX_ANTI_SNIPE_EXTENSIONS=5
            echo DEFAULT_ROUND_DURATION_MINUTES=5
        ) > .env
        echo ✅ .env создан
    )
) else (
    echo ✅ .env уже существует
)

echo.

:: ===================== УСТАНОВКА BACKEND =====================
echo ═══════════════════════════════════════════════════════════════
echo   УСТАНОВКА BACKEND ЗАВИСИМОСТЕЙ
echo ═══════════════════════════════════════════════════════════════
echo.

echo 📦 Запускаю npm install...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Ошибка установки Backend зависимостей!
    echo    Попробуйте: npm cache clean --force
    pause
    exit /b 1
)
echo ✅ Backend зависимости установлены
echo.

:: ===================== УСТАНОВКА FRONTEND =====================
if exist "client\package.json" (
    echo ═══════════════════════════════════════════════════════════════
    echo   УСТАНОВКА FRONTEND ЗАВИСИМОСТЕЙ
    echo ═══════════════════════════════════════════════════════════════
    echo.
    
    pushd client
    echo 📦 Запускаю npm install в client...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo ❌ Ошибка установки Frontend зависимостей!
        popd
        pause
        exit /b 1
    )
    popd
    echo ✅ Frontend зависимости установлены
    echo.
)

:: ===================== DOCKER КОНТЕЙНЕРЫ =====================
if "%DOCKER_OK%"=="1" (
    echo ═══════════════════════════════════════════════════════════════
    echo   НАСТРОЙКА DOCKER КОНТЕЙНЕРОВ
    echo ═══════════════════════════════════════════════════════════════
    echo.
    
    :: MongoDB
    docker ps -a --filter "name=^mongodb$" --format "{{.Names}}" | findstr /i "mongodb" >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo 🐳 Создаю контейнер MongoDB...
        docker run -d --name mongodb -p 27017:27017 -v mongodb_data:/data/db mongo:6
        echo ✅ MongoDB контейнер создан
    ) else (
        echo ✅ MongoDB контейнер уже существует
    )
    
    :: Redis
    docker ps -a --filter "name=^redis$" --format "{{.Names}}" | findstr /i "redis" >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo 🐳 Создаю контейнер Redis...
        docker run -d --name redis -p 6379:6379 redis:7-alpine
        echo ✅ Redis контейнер создан
    ) else (
        echo ✅ Redis контейнер уже существует
    )
    echo.
)

:: ===================== ГОТОВО =====================
echo.
echo ╔════════════════════════════════════════════════════════════════╗
echo ║                                                                ║
echo ║   ✅ УСТАНОВКА ЗАВЕРШЕНА!                                     ║
echo ║                                                                ║
echo ║   Следующие шаги:                                             ║
echo ║                                                                ║
echo ║   1. Отредактируйте .env файл:                                ║
echo ║      - Добавьте TELEGRAM_BOT_TOKEN от @BotFather              ║
echo ║                                                                ║
echo ║   2. Запустите приложение:                                    ║
echo ║      start.bat                                                ║
echo ║                                                                ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.

echo Хотите запустить приложение сейчас? (Y/N)
set /p LAUNCH="> "
if /i "%LAUNCH%"=="Y" (
    call start.bat
)

pause
