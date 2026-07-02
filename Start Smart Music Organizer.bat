@echo off
setlocal

cd /d "%~dp0"

set "PYTHON_EXE=%~dp0backend\venv\Scripts\python.exe"
if not exist "%PYTHON_EXE%" set "PYTHON_EXE=python"

if "%BACKEND_PORT%"=="" set "BACKEND_PORT=8000"
set "APP_LAN_MODE=false"
set "BACKEND_HOST=127.0.0.1"
set "API_AUTH_TOKEN="

echo Smart Music Organizer
echo.
echo APP_LAN_MODE=false
echo BACKEND_HOST=127.0.0.1
echo BACKEND_PORT=%BACKEND_PORT%
echo Starting the local desktop server on http://localhost:%BACKEND_PORT%
echo LAN/mobile access is disabled by default.
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
echo Keep this window open while using the app.
echo.

start "" "http://localhost:%BACKEND_PORT%"

cd /d "%~dp0backend"
"%PYTHON_EXE%" -m uvicorn app.main:app --host "%BACKEND_HOST%" --port "%BACKEND_PORT%"

echo.
echo Server stopped.
pause