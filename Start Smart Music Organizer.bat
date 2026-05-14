@echo off
setlocal

cd /d "%~dp0"

set "PYTHON_EXE=%~dp0backend\venv\Scripts\python.exe"
if not exist "%PYTHON_EXE%" set "PYTHON_EXE=python"

echo Smart Music Organizer
echo.
echo Starting the local server on http://localhost:8000
echo.
echo From a tablet or phone on the same Wi-Fi, open:
echo   http://^<server-ip^>:8000
echo.
echo To find this computer's IP address, run ipconfig and use the IPv4 Address.
echo Keep this window open while using the app.
echo.

start "" "http://localhost:8000"

cd /d "%~dp0backend"
"%PYTHON_EXE%" -m uvicorn app.main:app --host 0.0.0.0 --port 8000

echo.
echo Server stopped.
pause
