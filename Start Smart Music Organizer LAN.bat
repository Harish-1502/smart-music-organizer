@echo off
setlocal

cd /d "%~dp0"

if not exist "%~dp0logs" mkdir "%~dp0logs"
set "LOG_FILE=%~dp0logs\lan-server.log"

echo. >> "%LOG_FILE%"
echo ======================================== >> "%LOG_FILE%"
echo LAN launcher started at %DATE% %TIME% >> "%LOG_FILE%"
echo ======================================== >> "%LOG_FILE%"

set "PYTHON_EXE=%~dp0backend\venv\Scripts\python.exe"
if not exist "%PYTHON_EXE%" set "PYTHON_EXE=python"

set "BACKEND_PORT="
set "API_AUTH_TOKEN="
set "ALLOWED_SCAN_ROOTS="

if not exist "%~dp0.env.lan" (
    echo Smart Music Organizer LAN
    echo.
    echo ERROR: .env.lan was not found.
    echo Copy .env.lan.example to .env.lan and set API_AUTH_TOKEN.
    echo ERROR: .env.lan was not found. >> "%LOG_FILE%"
    pause
    exit /b 1
)

call :load_lan_env "%~dp0.env.lan"

set "APP_LAN_MODE=true"
set "BACKEND_HOST=0.0.0.0"
if not defined BACKEND_PORT set "BACKEND_PORT=8000"

if "%API_AUTH_TOKEN%"=="" (
    echo Smart Music Organizer LAN
    echo.
    echo ERROR: API_AUTH_TOKEN is required for LAN mode.
    echo Set it in .env.lan.
    echo This launcher never prints the token value.
    echo ERROR: API_AUTH_TOKEN is missing. >> "%LOG_FILE%"
    pause
    exit /b 1
)

if defined ALLOWED_SCAN_ROOTS (
    "%PYTHON_EXE%" -c "import json, os; json.loads(os.environ['ALLOWED_SCAN_ROOTS'])" >nul 2>&1
    if errorlevel 1 (
        echo Smart Music Organizer LAN
        echo.
        echo ERROR: ALLOWED_SCAN_ROOTS must be valid JSON.
        echo Good example: ALLOWED_SCAN_ROOTS=[""C:/Users/Harish/Music"",""D:/Audio""]
        echo Bad example:  ALLOWED_SCAN_ROOTS=C:\Music
        echo ERROR: ALLOWED_SCAN_ROOTS is invalid JSON. >> "%LOG_FILE%"
        pause
        exit /b 1
    )
    set "ALLOWED_SCAN_ROOTS_CONFIGURED=yes"
) else (
    set "ALLOWED_SCAN_ROOTS_CONFIGURED=no"
)

echo Smart Music Organizer LAN
echo.
echo APP_LAN_MODE=true
echo BACKEND_HOST=0.0.0.0
echo BACKEND_PORT=%BACKEND_PORT%
echo API token configured: yes
echo ALLOWED_SCAN_ROOTS configured: %ALLOWED_SCAN_ROOTS_CONFIGURED%
echo.
echo WARNING: LAN mode exposes the API on your local network.
echo Use only on a trusted network and do not expose the app to the internet.
echo.

echo APP_LAN_MODE=true >> "%LOG_FILE%"
echo BACKEND_HOST=%BACKEND_HOST% >> "%LOG_FILE%"
echo BACKEND_PORT=%BACKEND_PORT% >> "%LOG_FILE%"
echo API token configured: yes >> "%LOG_FILE%"
echo ALLOWED_SCAN_ROOTS configured: %ALLOWED_SCAN_ROOTS_CONFIGURED% >> "%LOG_FILE%"

echo Building frontend...
echo.
echo Building frontend at %DATE% %TIME% >> "%LOG_FILE%"

if not exist "%~dp0frontend\package.json" (
    echo ERROR: frontend\package.json was not found.
    echo ERROR: frontend\package.json was not found. >> "%LOG_FILE%"
    pause
    exit /b 1
)

cd /d "%~dp0frontend"
call npm run build >> "%LOG_FILE%" 2>&1
if errorlevel 1 (
    echo.
    echo ERROR: frontend build failed.
    echo Check log file:
    echo   %LOG_FILE%
    echo ERROR: frontend build failed. >> "%LOG_FILE%"
    pause
    exit /b 1
)

echo.
echo Frontend build complete.
echo.
echo Open on this PC:
echo   http://localhost:%BACKEND_PORT%
echo Open on phone/tablet:
echo   http://^<your-pc-ip^>:%BACKEND_PORT%
echo.
echo Find your PC IPv4 address with: ipconfig
echo Enter the API token in the browser prompt when the app asks for it.
echo Keep this window open while using the app.
echo.
echo Server logs are being written to:
echo   %LOG_FILE%
echo.
echo To watch logs live in another PowerShell window, run:
echo   Get-Content "%LOG_FILE%" -Wait
echo.

echo Frontend build complete at %DATE% %TIME% >> "%LOG_FILE%"
echo Starting Uvicorn at %DATE% %TIME% >> "%LOG_FILE%"

start "" "http://localhost:%BACKEND_PORT%"

cd /d "%~dp0backend"
"%PYTHON_EXE%" -m uvicorn app.main:app --host "%BACKEND_HOST%" --port "%BACKEND_PORT%" >> "%LOG_FILE%" 2>&1

echo.
echo Server stopped.
echo Uvicorn stopped at %DATE% %TIME% >> "%LOG_FILE%"
pause

goto :eof

:load_lan_env
for /f "usebackq tokens=1* delims==" %%A in (`findstr /r /b /c:"BACKEND_PORT=" "%~1"`) do (
    if /I "%%A"=="BACKEND_PORT" set "BACKEND_PORT=%%B"
)

for /f "usebackq tokens=1* delims==" %%A in (`findstr /r /b /c:"API_AUTH_TOKEN=" "%~1"`) do (
    if /I "%%A"=="API_AUTH_TOKEN" set "API_AUTH_TOKEN=%%B"
)

for /f "usebackq tokens=1* delims==" %%A in (`findstr /r /b /c:"ALLOWED_SCAN_ROOTS=" "%~1"`) do (
    if /I "%%A"=="ALLOWED_SCAN_ROOTS" set "ALLOWED_SCAN_ROOTS=%%B"
)

exit /b 0