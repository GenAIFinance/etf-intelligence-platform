@echo off
cd /d "C:\Users\cathe\OneDrive\文档\Risk\Project folder\ETF Intelligence\apps\api"

REM Load API key from .env file
for /f "usebackq tokens=1,2 delims==" %%a in (".env") do (
    if "%%a"=="EODHD_API_KEY" set EODHD_API_KEY=%%b
)

echo API Key loaded: %EODHD_API_KEY:~0,10%...

REM Run the script from the correct directory
npx tsx scripts/load-etfs-daily.ts

pause