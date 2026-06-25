# Setup Guide

This guide explains how to run Smart Music Organizer in local development, local production, Docker, LAN/mobile, and Capacitor Android modes.

Smart Music Organizer is a local personal server app. One computer runs the FastAPI backend and serves the React frontend. By default, the backend binds to `127.0.0.1`, so it is only reachable from the same computer.

LAN/mobile access is an explicit opt-in mode. It requires an API token and should only be used on trusted local networks. Do not expose this app to the public internet.

## Run Modes

The app supports several run modes:

| Mode                         | Use Case                                                                           |
| ---------------------------- | ---------------------------------------------------------------------------------- |
| Docker Local-Server Mode     | Run the app without manually installing Python, Node, or frontend dependencies     |
| Development Mode             | Edit frontend/backend code during development                                      |
| Production Local-Server Mode | Run the built app locally without the Vite dev server                              |
| LAN/Mobile Mode              | Access the app from a phone, tablet, or another computer on the same Wi-Fi network |
| Capacitor Android Mode       | Wrap the React frontend in an Android shell that talks to the PC backend over LAN  |

## Requirements

For Docker mode:

* Docker Desktop
* Docker Compose

For development mode:

* Python
* Node.js
* npm
* Git
* A Python virtual environment for the backend

For Android/Capacitor mode:

* Node.js
* npm
* Android Studio
* Capacitor dependencies already installed in the frontend project

## Docker Local-Server Mode

Use Docker when you want to run the app without manually installing backend or frontend dependencies.

From the project root, create host folders for persistent app data and the default music mount:

```powershell
mkdir data
mkdir music
```

Copy the example environment file:

```powershell
copy .env.example .env
```

Set `MUSIC_PATH` in `.env` to the real music folder on your computer.

Examples:

```text
MUSIC_PATH=./music
MUSIC_PATH=C:/Users/Alex/Music
MUSIC_PATH=S:/Music
```

Start the app:

```powershell
docker compose up --build
```

Then open:

```text
http://localhost:8000
```

In Docker mode, the app runs inside a Linux container. Your Windows music path is mounted into the container as:

```text
/music
```

When scanning music from inside the app, enter:

```text
/music
```

Do not enter a Windows path such as this inside the app when using Docker:

```text
C:\Users\Name\Music
```

That path exists on Windows, but it does not exist inside the Linux container.

## Docker Data And Database

Docker stores persistent app data through this volume:

```text
./data:/app/backend/data
```

That means the Docker SQLite database is stored on the host at:

```text
data/app.db
```

The development database may be stored separately at:

```text
backend/data/app.db
```

If you want Docker to reuse an existing development database, copy:

```text
backend/data/app.db
```

to:

```text
data/app.db
```

The Docker image does not copy your music files into the image. It only mounts the folder you provide through `MUSIC_PATH`.

## Development Mode

Use development mode when editing the app.

Start the backend:

```powershell
cd backend
.\venv\Scripts\activate
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Start the frontend dev server in another terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open the Vite URL, usually:

```text
http://localhost:5173
```

In Vite development, frontend API calls should point to the backend at:

```text
http://127.0.0.1:8000
```

If needed, override the frontend API base URL with:

```powershell
$env:VITE_API_BASE_URL = "http://127.0.0.1:8000"
npm run dev
```

## Build The Frontend

Build the React frontend before running production local-server mode:

```powershell
cd frontend
npm install
npm run build
```

The production build is written to:

```text
frontend/dist
```

## Production Local-Server Mode

Use production local-server mode when you want normal desktop use without running the Vite dev server.

First build the frontend:

```powershell
cd frontend
npm install
npm run build
```

Then start the backend:

```powershell
cd backend
.\venv\Scripts\activate
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Then open:

```text
http://localhost:8000
```

When `frontend/dist` exists, FastAPI serves the built React frontend. API routes remain available from the same server.

The local launcher can also be used if available:

```text
Start Smart Music Organizer.bat
```

The local launcher should use:

```text
APP_LAN_MODE=false
BACKEND_HOST=127.0.0.1
```

This mode does not require an API token and is meant for desktop use on the same computer.

## LAN / Mobile Mode

LAN/mobile mode allows another device on the same Wi-Fi network to connect to the app.

Use LAN mode only on a trusted network. Do not expose the app to the public internet.

Before first use, create `.env.lan` from the example file:

```powershell
copy .env.lan.example .env.lan
```

Set a long random token:

```text
API_AUTH_TOKEN=replace-with-a-long-random-token
```

Set allowed scan roots:

```text
ALLOWED_SCAN_ROOTS=["S:/Music"]
```

In LAN mode, scan requests should only be allowed inside `ALLOWED_SCAN_ROOTS`.

Use a JSON array of absolute folder paths. Subfolders under those roots are allowed.

Start the LAN launcher if available:

```text
Start Smart Music Organizer LAN.bat
```

The LAN launcher should use:

```text
APP_LAN_MODE=true
BACKEND_HOST=0.0.0.0
```

Manual LAN startup:

```powershell
cd backend
.\venv\Scripts\activate
$env:APP_LAN_MODE = "true"
$env:BACKEND_HOST = "0.0.0.0"
$env:API_AUTH_TOKEN = "use-a-long-random-token"
$env:ALLOWED_SCAN_ROOTS = '["S:/Music"]'
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Find the server computer's local IPv4 address:

```powershell
ipconfig
```

Look for `IPv4 Address`.

On the phone, tablet, or second computer, open:

```text
http://<server-ip>:8000
```

Example:

```text
http://192.168.1.25:8000
```

The server computer must stay awake, connected to Wi-Fi, and running the backend while another device is using the app.

## LAN Token Behavior

In LAN mode, the frontend should ask for the API token at runtime.

Normal API requests should send the token using the `Authorization` header.

Avoid putting API tokens in URLs.

For privacy-safe LAN use, keep raw local path exposure disabled unless you are intentionally debugging locally.

Recommended setting:

```text
EXPOSE_LOCAL_PATHS=false
```

## Docker LAN Mode

To run Docker in LAN mode, use the LAN Compose override if available:

```powershell
$env:API_AUTH_TOKEN = "use-a-long-random-token"
docker compose -f docker-compose.yml -f docker-compose.lan.yml up --build
```

Then open the server computer's LAN address from the other device:

```text
http://<server-ip>:8000
```

Make sure both devices are on the same Wi-Fi network.

## Capacitor Android Shell

The React frontend can be wrapped in a Capacitor Android app while still talking to the PC backend over LAN.

Important rules:

* Do not use `http://localhost:8000` inside the Android app when the backend is running on your PC.
* On Android, `localhost` means the phone itself.
* Use the PC's LAN IP address instead.
* Keep the PC backend running in LAN mode.
* Connect the Android device to the same Wi-Fi network.
* Enter the LAN API token in the app when prompted.
* Do not put the token into URLs.

Suggested workflow:

```powershell
Start Smart Music Organizer LAN.bat
cd frontend
$env:VITE_API_BASE_URL = "http://192.168.1.25:8000"
npm run build
npx cap sync android
npx cap open android
```

Capacitor uses the built frontend from:

```text
frontend/dist
```

## Environment Variables

Common backend environment variables:

| Variable             | Purpose                                                       |
| -------------------- | ------------------------------------------------------------- |
| `APP_LAN_MODE`       | Enables or disables LAN mode                                  |
| `BACKEND_HOST`       | Backend bind host, usually `127.0.0.1` or `0.0.0.0`           |
| `BACKEND_PORT`       | Backend port, usually `8000`                                  |
| `API_AUTH_TOKEN`     | Required token for LAN/mobile mode                            |
| `ALLOWED_SCAN_ROOTS` | JSON array of folders allowed for scanning                    |
| `EXPOSE_LOCAL_PATHS` | Controls whether raw local paths are exposed in API responses |
| `ACOUSTID_API_KEY`   | Optional key for AcoustID/deep scan features                  |

Common frontend environment variables:

| Variable                           | Purpose                                              |
| ---------------------------------- | ---------------------------------------------------- |
| `VITE_API_BASE_URL`                | Backend URL used by the React frontend               |
| `VITE_EXPOSE_LOCAL_PATHS`          | Frontend-side local path exposure flag               |
| `VITE_ALLOW_RAW_ART_PATH_FALLBACK` | Allows raw artwork path fallback for local debugging |

For normal local or LAN use, raw local path exposure should stay disabled.

## Testing

Run backend tests from the backend folder:

```powershell
cd backend
.\venv\Scripts\activate
python -m pytest
```

Or, if calling the virtual environment Python directly:

```powershell
cd backend
.\venv\Scripts\python.exe -m pytest
```

Run frontend checks if scripts are available:

```powershell
cd frontend
npm install
npm run lint
npm run test
```

If the frontend does not currently have lint or test scripts, skip those commands until they are added.

## Optional Deep Scan Setup

Some deeper audio analysis features may require optional system tools such as:

* `ffmpeg`
* `fpcalc`
* `libchromaprint-tools`

If these tools are not installed, basic library, playlist, playback, and streaming features should still work, but deeper fingerprinting or metadata lookup features may be limited.

If using AcoustID lookup, set:

```text
ACOUSTID_API_KEY=your-key-here
```

## Troubleshooting

### Docker scan path does not work

In Docker mode, scan:

```text
/music
```

Do not scan your Windows path directly.

Wrong:

```text
C:\Users\Name\Music
```

Correct:

```text
/music
```

### Phone cannot connect in LAN mode

Check that:

* the backend is running with `BACKEND_HOST=0.0.0.0`
* LAN mode is enabled
* the phone and PC are on the same Wi-Fi network
* the PC firewall allows the connection
* you are using the PC's IPv4 address, not `localhost`
* the API token is correct

### API token errors

Check that:

* `API_AUTH_TOKEN` is set in LAN mode
* the token entered in the frontend matches the backend token
* the token is not being placed in URLs
* the frontend is sending the token through the expected authorization flow

### Frontend cannot reach backend

Check `VITE_API_BASE_URL`.

For local development:

```text
http://127.0.0.1:8000
```

For Android/phone access:

```text
http://<server-ip>:8000
```

Example:

```text
http://192.168.1.25:8000
```

### Database looks empty in Docker

Docker and development mode may use different database paths.

Docker database:

```text
data/app.db
```

Development database:

```text
backend/data/app.db
```

Copy the database if you want to reuse the same data between modes.

## Safety Notes

This app can scan local folders, stream files, edit metadata, manage playlists, and expose a backend over LAN.

Use the default local mode for normal desktop use.

Use LAN mode only on trusted networks.

Do not expose the app to the public internet.