# Smart Music Organizer

Smart Music Organizer is a local-first music organizer and AI playlist app built with React, FastAPI, SQLite, and SQLAlchemy.

The app scans a local music library, stores track metadata, supports playlist management, streams local audio files, applies tag-based organization, and is being extended toward LAN/mobile access and offline playback.

This is not a public hosted music service. It is designed as a personal local server app where one computer runs the backend and serves the frontend.

## Project Goals

I built this project to create a useful personal music organizer while practicing full-stack development, backend API design, database modeling, local-first architecture, testing, LAN/mobile connectivity, and maintainable project documentation.

The long-term goal is to support a desktop music server that can sync playlists and tracks to a mobile device for offline playback.

## Core Features

* Local music folder scanning
* SQLite-based track metadata storage
* Browser-based music playback
* Playlist creation and management
* Tag-based music organization
* AI-style playlist generation using track metadata and tags
* LAN/mobile access mode for trusted local networks
* API-token protection in LAN mode
* Path-safety checks for local file access
* Docker local-server mode
* Capacitor Android shell planning
* Backend test coverage with Pytest

## Tech Stack

### Frontend

* React
* Vite
* JavaScript
* Capacitor for Android/mobile direction

### Backend

* FastAPI
* Python
* SQLite
* SQLAlchemy
* Pytest

### Deployment / Local Runtime

* Docker
* Docker Compose
* Local FastAPI server
* Built React frontend served by FastAPI

## Engineering Highlights

### Local-First Architecture

The app is designed around local music files instead of depending on a cloud music provider or streaming API.

### FastAPI Backend

The backend handles scanning folders, validating paths, storing metadata, serving audio files, managing playlists, and protecting LAN mode routes.

### SQLite Database Design

SQLite is used because the app is personal and local-first. SQLAlchemy models organize tracks, playlists, tags, and relationships between them.

### LAN Mode With API Protection

By default, the backend binds to `127.0.0.1`, so it is only reachable from the same computer.

LAN/mobile mode is an explicit opt-in mode. It binds to `0.0.0.0`, requires an API token, and should only be used on trusted local networks.

### Path Safety

The backend includes path validation so library scanning and file access stay within allowed roots, especially when LAN mode is enabled.

### Testing

The backend uses Pytest to cover important behavior such as settings, environment overrides, scanning, tag logic, and route behavior.

## Quick Start

### Option 1: Docker Local-Server Mode

Use this when you want to run the app without manually installing Python, Node, or frontend dependencies.

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

In Docker mode, the app mounts your music folder as:

```text
/music
```

When scanning music from the app, use:

```text
/music
```

For full Docker setup details, see:

```text
docs/setup.md
```

### Option 2: Development Mode

Use this when editing the app.

Start the backend:

```powershell
cd backend
.\venv\Scripts\activate
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Start the frontend in another terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open the Vite URL, usually:

```text
http://localhost:5173
```

### Option 3: Production Local-Server Mode

Use this for normal personal desktop use without running the Vite dev server.

Build the frontend:

```powershell
cd frontend
npm install
npm run build
```

Start the backend:

```powershell
cd backend
.\venv\Scripts\activate
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Then open:

```text
http://localhost:8000
```

FastAPI serves the built React frontend from `frontend/dist`.

## LAN / Mobile Access

LAN/mobile mode allows a phone, tablet, or another computer on the same Wi-Fi network to connect to the app.

This mode should only be used on a trusted network.

Before using LAN mode, create `.env.lan`:

```powershell
copy .env.lan.example .env.lan
```

Set a long random API token:

```text
API_AUTH_TOKEN=replace-with-a-long-random-token
ALLOWED_SCAN_ROOTS=["S:/Music"]
```

Start the LAN launcher:

```text
Start Smart Music Organizer LAN.bat
```

Then find the server computer's local IPv4 address:

```powershell
ipconfig
```

Open this on the mobile device:

```text
http://<server-ip>:8000
```

Example:

```text
http://192.168.1.25:8000
```

The server computer must stay awake and connected to the same Wi-Fi network.

For full LAN and Capacitor setup details, see:

```text
docs/setup.md
```

## Documentation

More detailed documentation is available in the `docs` folder.

```text
docs/
  overview.md
  setup.md
  architecture.md
  backend.md
  frontend.md
  database.md
  testing.md
  security.md
  roadmap.md
  known-issues.md
  features/
```

Recommended starting points:

* `docs/overview.md` - project overview
* `docs/setup.md` - full setup and run instructions
* `docs/architecture.md` - system architecture
* `docs/security.md` - LAN mode, API token, and path-safety notes
* `docs/testing.md` - backend testing guide
* `docs/roadmap.md` - current and future project direction

## Current Status

The app currently supports local-server desktop usage, backend API routes, music library scanning, playlist management, playback, Docker local-server mode, and LAN/mobile planning.

Offline mobile playback and Capacitor Android support are still being developed and stabilized.

## Roadmap

Near-term priorities:

1. Stabilize offline mobile downloads
2. Improve downloaded track recovery and deletion
3. Complete Capacitor Android workflow
4. Improve AI playlist accuracy
5. Add better loudness and lyrics-based analysis
6. Integrate external hardware controller commands
7. Improve frontend test coverage

## Known Limitations

* Offline mobile mode is still in progress.
* Full-library download needs stronger progress and error handling.
* Metadata sync between desktop and mobile needs a clear strategy.
* AI playlist quality depends on available metadata and tags.
* Deep scan features may require optional system packages such as `ffmpeg` and `fpcalc`.
* Frontend test coverage needs improvement.

## Safety Note

This app can access local music folders and optionally expose the backend over a local network.

Do not expose it to the public internet. LAN mode should only be used on trusted networks with a strong API token.
