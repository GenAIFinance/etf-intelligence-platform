@echo off
echo === ETF Intelligence - Deploy to Railway ===
echo.

cd /d "C:\Users\cathe\OneDrive\文档\Risk\Project folder\ETF Intelligence"

echo [1/3] Pulling latest code from GitHub...
git pull origin main
if %errorlevel% neq 0 (
    echo ERROR: git pull failed
    pause
    exit /b 1
)
echo Done.
echo.

echo [2/3] Moving to API directory...
cd apps\api
echo.

echo [3/3] Deploying to Railway...
railway up
echo.

echo === Deploy complete ===
pause
