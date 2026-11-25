@echo off
TITLE Shehswar ONE360 - Migrate Cloud Database to Local PC
COLOR 0E

echo ==============================================================
echo   MIGRATE DATABASE FROM CLOUD (RENDER) TO LOCAL CLIENT PC
echo ==============================================================
echo.
echo Source: postgresql://shehswar_user:...@render.com/shehswar_one360
echo Target: Local PostgreSQL (Docker or Local Windows Service)
echo.

set CLOUD_URL=postgresql://shehswar_user:PHHDD5jvPcZsDCX2LH7mKrcO5GBtobti@dpg-dbc8moafngtc739dhgkg-a.oregon-postgres.render.com/shehswar_one360
set DUMP_FILE=%~dp0..\cloud_migration.dump

echo [Step 1/3] Downloading snapshot from cloud database...
docker run --rm -v "%~dp0..:/work" postgres:16-alpine pg_dump "%CLOUD_URL%" -F c -b -v -f /work/cloud_migration.dump

if not exist "%DUMP_FILE%" (
    echo [ERROR] Dump failed. Checking local pg_dump...
    set PG_DUMP="C:\Program Files\PostgreSQL\16\bin\pg_dump.exe"
    if exist %PG_DUMP% (
        %PG_DUMP% "%CLOUD_URL%" -F c -b -v -f "%DUMP_FILE%"
    )
)

if not exist "%DUMP_FILE%" (
    echo [FAILED] Could not create cloud database snapshot.
    pause
    exit /b 1
)

echo.
echo [Step 2/3] Snapshot downloaded successfully!
echo File: %DUMP_FILE%
echo.

echo [Step 3/3] Restoring snapshot into local database...
docker ps | findstr "shehswar_postgres" >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Restoring into Docker container 'shehswar_postgres'...
    docker exec -i shehswar_postgres pg_restore -U shehswar_user -d shehswar_one360 --clean --if-exists -v < "%DUMP_FILE%"
    echo.
    echo [SUCCESS] Local Docker database is now completely up-to-date with cloud data!
    goto done
)

set PG_RESTORE="C:\Program Files\PostgreSQL\16\bin\pg_restore.exe"
if exist %PG_RESTORE% (
    echo Restoring into local Windows PostgreSQL service...
    %PG_RESTORE% -U postgres -d shehswar_one360 --clean --if-exists -v "%DUMP_FILE%"
    echo.
    echo [SUCCESS] Local Windows PostgreSQL database is now completely up-to-date with cloud data!
    goto done
)

echo [WARNING] Local PostgreSQL container/service not detected.
echo Start your local PostgreSQL and restore using: pg_restore -d shehswar_one360 "%DUMP_FILE%"

:done
echo ==============================================================
pause
