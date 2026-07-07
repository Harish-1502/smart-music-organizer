# Setup Guide

This guide explains how to run Smart Music Organizer in the correct mode for your use case.

Smart Music Organizer is a local personal server app. One computer runs the FastAPI backend and serves the React frontend. By default, the backend binds to `127.0.0.1`, so it is only reachable from the same computer.

LAN/mobile mode is optional. It exposes the app to devices on the same Wi-Fi network, requires an API token, and should only be used on trusted networks.

Do not expose this app to the public internet.

---

## Recommended Run Modes

| Mode                   | Best For                              | Main Command                          |
| ---------------------- | ------------------------------------- | ------------------------------------- |
| Desktop Launcher Mode  | Normal personal use on the same PC    | `Start Smart Music Organizer.bat`     |
| LAN Launcher Mode      | Phone/tablet/another PC on same Wi-Fi | `Start Smart Music Organizer LAN.bat` |
| Development Mode       | Editing frontend/backend code         | Backend terminal + Vite terminal      |
| Docker Mode            | Containerized local-server setup      | `docker compose up --build`           |
| Capacitor Android Mode | Android app shell testing             | LAN backend + Capacitor build         |

---

## Project Root Files

Run the launcher files from the project root.

Expected important files:

```text
smart-music-organizer/
  Start Smart Music Organizer.bat
  Start Smart Music Organizer LAN.bat
  .env.example
  .env.lan.example
  docker-compose.yml
  docker-compose.lan.yml
  backend/
  frontend/
  docs/
```

The launcher files are the easiest way to run the app without opening the project in a code editor.

---

## Desktop Launcher Mode

Use this mode for normal desktop use on the same computer.

From the project root, run:

```text
Start Smart Music Organizer.bat
```

This mode should force local-only settings:

```text
APP_LAN_MODE=false
BACKEND_HOST=127.0.0.1
```

Then open:

```text
http://localhost:8000
```

This mode does not require an API token.

Use this mode when:

* you are using the app on the same PC
* you do not need phone/tablet access
* you want the safest default run mode

---

## First-Time Desktop Setup

If this is the first time running the app locally, make sure backend dependencies and the frontend build exist.

### Backend virtual environment

From the project root:

```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```

Return to the project root:

```powershell
cd ..
```

### Build the frontend

From the project root:

```powershell
cd frontend
npm install
npm run build
```

Return to the project root:

```powershell
cd ..
```

The production frontend build is written to:

```text
frontend/dist
```

The launcher uses the FastAPI backend to serve the built React frontend when `frontend/dist` exists.

After setup, run:

```text
Start Smart Music Organizer.bat
```

---

## LAN Launcher Mode

Use LAN mode when you want to access the app from a phone, tablet, or another computer on the same Wi-Fi network.

Use LAN mode only on a trusted network.

Do not expose the app to the public internet.

### First-time LAN setup

From the project root, create `.env.lan`:

```powershell
copy .env.lan.example .env.lan
```

Edit `.env.lan` and set a long random API token:

```text
API_AUTH_TOKEN=replace-with-a-long-random-token
```

Set allowed scan roots:

```text
ALLOWED_SCAN_ROOTS=["S:/Music"]
```

`ALLOWED_SCAN_ROOTS` should be a JSON array of absolute folder paths. In LAN mode, scan requests should only be allowed inside these roots.

### Start LAN mode

From the project root, run:

```text
Start Smart Music Organizer LAN.bat
```

The LAN launcher should force:

```text
APP_LAN_MODE=true
BACKEND_HOST=0.0.0.0
```

The app will be reachable from other devices on the same Wi-Fi network.

### Find the server PC IP address

On the server computer, run:

```powershell
ipconfig
```

Look for the local `IPv4 Address`.

On the phone/tablet/other PC, open:

```text
http://<server-ip>:8000
```

Example:

```text
http://192.168.1.25:8000
```

The server computer must stay awake, connected to Wi-Fi, and running the app while other devices use it.

---

## LAN Token Behavior

In LAN mode, the frontend should ask for the API token at runtime.

Normal API requests should send the token using the supported authorization flow.

Avoid putting API tokens in URLs.

Recommended LAN privacy setting:

```text
EXPOSE_LOCAL_PATHS=false
```

This helps avoid exposing raw local file paths in API responses.

---

## Development Mode

Use development mode when editing the app.

In this mode, the backend and frontend run in separate terminals.

### Start the backend

Terminal 1:

```powershell
cd backend
.\venv\Scripts\activate
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The backend runs at:

```text
http://127.0.0.1:8000
```

### Start the frontend dev server

Terminal 2:

```powershell
cd frontend
npm install
npm run dev
```

Open the Vite URL, usually:

```text
http://localhost:5173
```

In development mode, frontend API calls should point to:

```text
http://127.0.0.1:8000
```

If needed, override the frontend API base URL:

```powershell
$env:VITE_API_BASE_URL = "http://127.0.0.1:8000"
npm run dev
```

---

## Production Local-Server Mode Without Launcher

The launcher is the recommended normal run path.

If you want to run production local-server mode manually, build the frontend first:

```powershell
cd frontend
npm install
npm run build
```

Then start the backend:

```powershell
cd ..\backend
.\venv\Scripts\activate
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Then open:

```text
http://localhost:8000
```

When `frontend/dist` exists, FastAPI serves the built React frontend. API routes remain available from the same server.

---

## Docker Mode

Docker is available as an alternative runtime, but it is not the primary quick-start path.

Use Docker when you want a containerized local-server setup.

### Docker requirements

* Docker Desktop
* Docker Compose

### Start Docker local-server mode

From the project root:

```powershell
mkdir data
mkdir music
copy .env.example .env
docker compose up --build
```

Then open:

```text
http://localhost:8000
```

### Docker music path

In Docker mode, the app runs inside a Linux container.

Your Windows path, such as:

```text
C:\Users\Name\Music
```

does not exist inside the container.

Docker mounts your configured music folder as:

```text
/music
```

When scanning music from inside the app in Docker mode, use:

```text
/music
```

Do not scan the Windows host path directly in Docker mode.

### Docker data and database

Docker stores persistent app data through this volume:

```text
./data:/app/backend/data
```

That means the Docker SQLite database is stored at:

```text
data/app.db
```

Development mode may use:

```text
backend/data/app.db
```

If Docker looks empty but development mode has tracks, check whether the two modes are using different database files.

To reuse a development database in Docker, copy:

```text
backend/data/app.db
```

to:

```text
data/app.db
```

---

## Docker LAN Mode

To run Docker in LAN mode, use the LAN Compose override if available:

```powershell
$env:API_AUTH_TOKEN = "use-a-long-random-token"
docker compose -f docker-compose.yml -f docker-compose.lan.yml up --build
```

Then open the server computer's LAN address from another device:

```text
http://<server-ip>:8000
```

Make sure both devices are on the same Wi-Fi network.

---

## Capacitor Android Mode

The React frontend can be wrapped in a Capacitor Android app while still talking to the PC backend over trusted same-Wi-Fi LAN mode.

Important rules:

* Do not use `http://localhost:8000` inside the Android app when the backend is running on your PC.
* On Android, `localhost` means the phone itself.
* Use the PC's LAN IP address instead.
* Keep the PC backend running in LAN mode.
* Connect the Android device to the same Wi-Fi network.
* Enter the LAN API token in the app when prompted.
* Do not put API tokens into URLs.

Suggested workflow:

```powershell
Start Smart Music Organizer LAN.bat
cd frontend
$env:VITE_API_BASE_URL = "http://192.168.1.25:8000"
npm run build
npx cap sync android
npx cap open android
```

Replace this example IP:

```text
192.168.1.25
```

with the actual IPv4 address of the server computer.

Capacitor uses the built frontend from:

```text
frontend/dist
```

---

## Environment Files

The project may use different environment files depending on run mode.

| File               | Purpose                                                                 |
| ------------------ | ----------------------------------------------------------------------- |
| `.env.example`     | Example environment file for normal/local/Docker use                    |
| `.env`             | Local environment file used by Docker Compose and optional manual setup |
| `.env.lan.example` | Example LAN mode environment file                                       |
| `.env.lan`         | LAN mode environment file used by the LAN launcher                      |

Do not commit real secrets or private tokens.

---

## Important Environment Variables

Common backend variables:

| Variable             | Purpose                                                       |
| -------------------- | ------------------------------------------------------------- |
| `APP_LAN_MODE`       | Enables or disables LAN mode                                  |
| `BACKEND_HOST`       | Backend bind host, usually `127.0.0.1` or `0.0.0.0`           |
| `BACKEND_PORT`       | Backend port, usually `8000`                                  |
| `API_AUTH_TOKEN`     | Required token for LAN/mobile mode                            |
| `ALLOWED_SCAN_ROOTS` | JSON array of folders allowed for scanning                    |
| `EXPOSE_LOCAL_PATHS` | Controls whether raw local paths are exposed in API responses |
| `ACOUSTID_API_KEY`   | Optional key for AcoustID/deep scan features                  |

Common frontend variables:

| Variable                           | Purpose                                              |
| ---------------------------------- | ---------------------------------------------------- |
| `VITE_API_BASE_URL`                | Backend URL used by the React frontend               |
| `VITE_EXPOSE_LOCAL_PATHS`          | Frontend-side local path exposure flag               |
| `VITE_ALLOW_RAW_ART_PATH_FALLBACK` | Allows raw artwork path fallback for local debugging |

For normal local or LAN use, raw local path exposure should stay disabled.

---

## Database Locations

Different run modes may use different database files.

| Mode             | Database Path         |
| ---------------- | --------------------- |
| Development mode | `backend/data/app.db` |
| Docker mode      | `data/app.db`         |

If the app appears empty in one mode but not another, check which database file is being used.

---

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

---

## Testing

Run backend tests from the backend folder:

```powershell
cd backend
.\venv\Scripts\activate
python -m pytest
```

Or call the virtual environment Python directly:

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

---

## Troubleshooting

### Launcher does not start

Check:

* you are running the `.bat` file from the project root
* backend virtual environment exists at `backend/venv`
* backend dependencies are installed
* frontend has been built into `frontend/dist`
* port `8000` is not already in use

To check if port `8000` is already in use:

```powershell
netstat -ano | findstr :8000
```

### App opens but page is blank

Check:

* `frontend/dist` exists
* the frontend build completed successfully
* backend terminal shows no import/startup errors
* browser console has no frontend errors

Rebuild the frontend:

```powershell
cd frontend
npm install
npm run build
```

### Frontend cannot reach backend in development mode

Check:

* backend is running at `http://127.0.0.1:8000`
* frontend is running at `http://localhost:5173`
* `VITE_API_BASE_URL` points to the backend
* browser Network tab shows the API request
* backend CORS settings allow the frontend dev server

### Phone cannot connect in LAN mode

Check:

* backend is running with `BACKEND_HOST=0.0.0.0`
* LAN mode is enabled
* phone and PC are on the same Wi-Fi network
* PC firewall allows the connection
* phone uses the PC IPv4 address, not `localhost`
* API token is correct

### API token errors

Check:

* `API_AUTH_TOKEN` is set in LAN mode
* token entered in the frontend matches the backend token
* token is not being placed in URLs
* frontend is sending the token through the expected authorization flow

### Docker scan path does not work

In Docker mode, scan:

```text
/music
```

Do not scan the Windows path directly.

Wrong:

```text
C:\Users\Name\Music
```

Correct:

```text
/music
```

### Database looks empty in Docker

Docker and development mode may use different database files.

Docker database:

```text
data/app.db
```

Development database:

```text
backend/data/app.db
```

Copy the database if you want both modes to use the same data.

### Android app cannot reach backend

Check:

* backend is running in LAN mode
* Android device and PC are on the same Wi-Fi network
* `VITE_API_BASE_URL` uses the PC LAN IP
* Android app is not using `localhost`
* API token is correct
* PC firewall allows the connection

---

## Safety Notes

This app can scan local folders, stream files, edit metadata, manage playlists, and expose a backend over LAN.

Use desktop launcher mode for normal local use.

Use LAN mode only on trusted networks.

Do not expose the app to the public internet.
