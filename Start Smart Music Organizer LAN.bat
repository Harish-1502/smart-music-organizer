@echo off
setlocal

cd /d "%~dp0"

set "PYTHON_EXE=%~dp0backend\venv\Scripts\python.exe"
if not exist "%PYTHON_EXE%" set "PYTHON_EXE=python"

if "%BACKEND_PORT%"=="" set "BACKEND_PORT=8000"
set "APP_LAN_MODE=true"
set "BACKEND_HOST=0.0.0.0"

if "%API_AUTH_TOKEN%"=="" if exist "%~dp0.env.lan" (
    for /f "usebackq tokens=1* delims==" %%A in (`findstr /r /b /c:"API_AUTH_TOKEN=" "%~dp0.env.lan"`) do (
        if /I "%%A"=="API_AUTH_TOKEN" set "API_AUTH_TOKEN=%%B"
    )
)

if "%API_AUTH_TOKEN%"=="" (
    echo Smart Music Organizer LAN
    echo.
    echo ERROR: API_AUTH_TOKEN is required for LAN mode.
    echo Set it in the environment or create .env.lan from .env.lan.example.
    echo This launcher never prints the token value.
    pause
    exit /b 1
)

echo Smart Music Organizer LAN
echo.
echo APP_LAN_MODE=true
echo BACKEND_HOST=0.0.0.0
echo BACKEND_PORT=%BACKEND_PORT%
echo API token configured: yes
echo.
echo WARNING: LAN mode exposes the API on your local network.
echo Use only on a trusted network and do not expose the app to the internet.
echo.

echo Building frontend...
echo.

if not exist "%~dp0frontend\package.json" (
    echo ERROR: frontend\package.json was not found.
    pause
    exit /b 1
)

cd /d "%~dp0frontend"
call npm run build
if errorlevel 1 (
    echo.
    echo ERROR: frontend build failed.
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

start "" "http://localhost:%BACKEND_PORT%"

cd /d "%~dp0backend"
"%PYTHON_EXE%" -m uvicorn app.main:app --host "%BACKEND_HOST%" --port "%BACKEND_PORT%"

echo.
echo Server stopped.
pause