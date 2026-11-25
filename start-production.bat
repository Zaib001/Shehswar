@echo off
TITLE Shehswar ONE360 - Production Server
COLOR 0A

echo =======================================================
echo        SHEHSWAR ONE360 - PRODUCTION LAUNCHER
echo =======================================================
echo.

cd /d "%~dp0"

echo [1/3] Checking Node.js installation...
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed or not in PATH!
    echo Please install Node.js 20+ from https://nodejs.org
    pause
    exit /b 1
)

echo [2/3] Checking PM2 process manager...
where pm2 >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo PM2 not found globally. Installing PM2...
    call npm install -g pm2
)

echo [3/3] Starting Shehswar API and Web via PM2...
call pm2 start ecosystem.config.js
call pm2 save

echo.
echo =======================================================
echo  SHEHSWAR ONE360 IS RUNNING!
echo  - Frontend Web: http://localhost:3000
echo  - Backend API:  http://localhost:4000
echo  - Swagger Docs: http://localhost:4000/api/docs
echo =======================================================
echo.
call pm2 status
echo.
echo To monitor logs, run: pm2 logs
echo To stop services, run: pm2 stop all
echo.
pause
