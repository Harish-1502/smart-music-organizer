@echo off
setlocal

cd /d "%~dp0"

set "PYTHON_EXE=%~dp0backend\venv\Scripts\python.exe"
if not exist "%PYTHON_EXE%" set "PYTHON_EXE=python"

if "%BACKEND_PORT%"=="" set "BACKEND_PORT=8000"

echo Smart Music Organizer
echo.

if /I "%APP_LAN_MODE%"=="true" (
    set "BACKEND_HOST=0.0.0.0"

    if "%API_AUTH_TOKEN%"=="" (
        echo ERROR: APP_LAN_MODE=true requires API_AUTH_TOKEN.
        echo Set API_AUTH_TOKEN to a long random value before starting LAN mode.
        exit /b 1
    )

    echo WARNING: LAN mode exposes the API on your local network.
    echo Only use this on a trusted network. Do not expose it to the internet.
    echo.
    echo Starting LAN server on http://%BACKEND_HOST%:%BACKEND_PORT%
    echo From this PC, open:
    echo   http://localhost:%BACKEND_PORT%
    echo From a tablet or phone on the same Wi-Fi, open:
    echo   http://^<server-ip^>:%BACKEND_PORT%
    echo.
    echo To find this computer's IP address, run ipconfig and use the IPv4 Address.
) else (
    set "BACKEND_HOST=127.0.0.1"
    echo Starting the local desktop server on http://localhost:%BACKEND_PORT%
    echo LAN/mobile access is disabled by default.
)

echo Keep this window open while using the app.
echo.

start "" "http://localhost:%BACKEND_PORT%"

cd /d "%~dp0backend"
"%PYTHON_EXE%" -m uvicorn app.main:app --host "%BACKEND_HOST%" --port "%BACKEND_PORT%"

echo.
echo Server stopped.
pause
