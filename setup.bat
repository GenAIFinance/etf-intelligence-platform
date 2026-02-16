@echo off
REM ETF Intelligence - Windows Setup Script (Command Prompt)
REM Run this script to automate the setup process

echo ========================================
echo ETF Intelligence - Local Setup
echo ========================================
echo.

REM Check Node.js installation
echo Checking prerequisites...
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [X] Node.js not found. Please install from https://nodejs.org/
    pause
    exit /b 1
)

node --version
echo [OK] Node.js found

where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [X] npm not found. Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

npm --version
echo [OK] npm found
echo.

REM Check for .env file
if exist ".env" (
    echo [OK] .env file found in root directory
) else (
    echo [X] .env file not found in root directory
    if exist ".env.example" (
        echo Creating .env from template...
        copy ".env.example" ".env"
        echo [OK] Created .env from .env.example
        echo [!] Please edit .env and add your EODHD_API_KEY
        echo.
    ) else (
        echo [X] .env.example not found. Please create .env manually.
        pause
        exit /b 1
    )
)

REM Check for apps/api/.env file
if exist "apps\api\.env" (
    echo [OK] .env file found in apps/api directory
) else (
    echo [X] .env file not found in apps/api directory
    if exist ".env" (
        echo Copying .env to apps/api/...
        copy ".env" "apps\api\.env"
        echo [OK] Created apps/api/.env
    ) else (
        echo [X] Root .env not found. Cannot copy to apps/api/
        pause
        exit /b 1
    )
)

echo.
echo ========================================
echo Step 1: Installing dependencies
echo ========================================
echo This may take several minutes...
echo.

call npm install
if %ERRORLEVEL% NEQ 0 (
    echo [X] npm install failed
    pause
    exit /b 1
)
echo [OK] Dependencies installed
echo.

echo ========================================
echo Step 2: Database setup
echo ========================================
echo.

echo Generating Prisma client...
call npm run db:generate -w apps/api
if %ERRORLEVEL% NEQ 0 (
    echo [X] Prisma client generation failed
    pause
    exit /b 1
)
echo [OK] Prisma client generated
echo.

echo Running database migrations...
call npm run db:migrate -w apps/api
if %ERRORLEVEL% NEQ 0 (
    echo [X] Database migrations failed
    pause
    exit /b 1
)
echo [OK] Database migrations completed
echo.

echo Seeding database with sample ETFs...
call npm run db:seed -w apps/api
if %ERRORLEVEL% NEQ 0 (
    echo [X] Database seeding failed
    pause
    exit /b 1
)
echo [OK] Database seeded
echo.

echo ========================================
echo Setup Complete! 🚀
echo ========================================
echo.
echo To start the application:
echo   npm run dev
echo.
echo Then open your browser to:
echo   http://localhost:3000
echo.
echo API will be available at:
echo   http://localhost:3001
echo.
echo Additional commands:
echo   npm run db:studio -w apps/api  # View database in browser
echo   npm run dev:api               # Start API only
echo   npm run dev:web               # Start web only
echo.
echo For troubleshooting, see LOCAL_DEPLOYMENT_GUIDE.md
echo.

set /p start="Start the application now? (y/n): "
if /i "%start%"=="y" (
    echo.
    echo Starting ETF Intelligence...
    echo Press Ctrl+C to stop
    echo.
    npm run dev
)

pause
