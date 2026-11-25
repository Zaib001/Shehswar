@echo off
TITLE Shehswar ONE360 - Database Backup
COLOR 0A

:: Format timestamp YYYY-MM-DD_HH-MM
for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set mydate=%%c-%%a-%%b)
for /f "tokens=1-2 delims=/:" %%a in ("%TIME%") do (set mytime=%%a-%%b)
set mytime=%mytime: =0%
set TIMESTAMP=%mydate%_%mytime%

set BACKUP_DIR=%~dp0..\backups
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

set BACKUP_FILE=%BACKUP_DIR%\shehswar_backup_%TIMESTAMP%.sql

echo =======================================================
echo     SHEHSWAR ONE360 - AUTOMATED DATABASE BACKUP
echo =======================================================
echo Timestamp: %TIMESTAMP%
echo Target:    %BACKUP_FILE%
echo.

:: Check if running via Docker
docker ps | findstr "shehswar_postgres" >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Backing up from Docker container 'shehswar_postgres'...
    docker exec -t shehswar_postgres pg_dump -U shehswar_user shehswar_one360 > "%BACKUP_FILE%"
    goto finish
)

:: Check if running via local Windows PostgreSQL installation
set PG_BIN="C:\Program Files\PostgreSQL\16\bin\pg_dump.exe"
if exist %PG_BIN% (
    echo Backing up from local Windows PostgreSQL 16 service...
    %PG_BIN% -U postgres -d shehswar_one360 -f "%BACKUP_FILE%"
    goto finish
)

echo [WARNING] Neither Docker nor local PostgreSQL 16 binary found at default path.
echo Please ensure Docker or PostgreSQL is running.
pause
exit /b 1

:finish
echo.
echo [SUCCESS] Backup completed: %BACKUP_FILE%
echo =======================================================
pause
