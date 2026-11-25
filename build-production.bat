@echo off
TITLE Shehswar ONE360 - Production Build
COLOR 0B

echo =======================================================
echo        SHEHSWAR ONE360 - PRODUCTION BUILD
echo =======================================================
echo.

cd /d "%~dp0"

echo [1/4] Installing dependencies...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] npm install failed!
    pause
    exit /b 1
)

echo.
echo [2/4] Generating Prisma Database Client...
call npm run db:generate
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Prisma generate failed!
    pause
    exit /b 1
)

echo.
echo [3/4] Building NestJS Backend API & Next.js Frontend...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Build failed!
    pause
    exit /b 1
)

echo.
echo =======================================================
echo  BUILD COMPLETED SUCCESSFULLY!
echo  You can now run 'start-production.bat' to launch.
echo =======================================================
echo.
pause
