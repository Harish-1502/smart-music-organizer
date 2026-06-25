# Backend Guide

The backend is a FastAPI application responsible for scanning local music folders, storing track metadata, serving audio files, managing playlists, managing tags, and protecting LAN/mobile access.

The backend owns all direct access to the SQLite database and the local filesystem. The frontend should interact with music files and metadata through backend API routes instead of reading arbitrary local paths directly.

## Backend Responsibilities

The backend is responsible for:

* starting the FastAPI app
* loading environment-based settings
* exposing API routes to the frontend
* scanning local music folders
* validating scan paths and file paths
* extracting and storing track metadata
* serving audio streams
* serving artwork
* managing playlists
* managing tags
* applying tag and playlist logic
* enforcing LAN mode API-token protection
* running backend tests with Pytest

## Backend Folder Structure

The backend is organized around app startup, routes, models, services, settings, and tests.

```text
backend/
  app/
    main.py
    settings.py
    database.py
    models/
    routes/
    services/
  data/
    app.db
  tests/
```

### `app/main.py`

FastAPI application entry point.

Responsibilities:

* create the FastAPI app
* register middleware
* register API routes
* serve the built React frontend when available
* configure app startup behavior

### `app/settings.py`

Environment-based backend configuration.

Responsibilities:

* load local mode and LAN mode settings
* configure backend host and port
* configure API token behavior
* configure allowed scan roots
* configure CORS origins
* configure privacy/path exposure settings

Important settings include:

* `APP_LAN_MODE`
* `BACKEND_HOST`
* `BACKEND_PORT`
* `API_AUTH_TOKEN`
* `ALLOWED_SCAN_ROOTS`
* `EXPOSE_LOCAL_PATHS`
* `DATABASE_URL`

### `app/database.py`

Database connection and session setup.

Responsibilities:

* configure SQLAlchemy engine
* create database sessions
* provide database dependencies for routes/services

### `app/models/`

SQLAlchemy database models.

Models may include:

* tracks
* playlists
* playlist-track relationships
* tags
* track-tag relationships
* tag references
* other metadata tables

The models define the persistent structure of the local music library.

### `app/routes/`

FastAPI route handlers.

Routes are the HTTP interface used by the frontend.

Typical route areas include:

* tracks
* playlists
* library
* scanner
* tags
* AI playlists
* artwork
* streaming

Routes should stay thin when possible. They should validate request/response behavior and delegate business logic to services.

### `app/services/`

Backend business logic.

Services are responsible for logic that should not live directly inside route handlers.

Service areas may include:

* scanning folders
* extracting metadata
* validating paths
* resolving track files
* applying tag logic
* generating playlists
* managing external metadata lookup
* preparing API-safe response objects

### `backend/data/`

Local backend data folder.

This may contain the development SQLite database:

```text
backend/data/app.db
```

Docker mode may use a different host-mounted database path:

```text
data/app.db
```

### `backend/tests/`

Pytest test suite.

Tests cover backend behavior such as:

* settings and environment overrides
* LAN mode behavior
* path safety
* scanner behavior
* tag persistence
* tag inference
* route behavior
* metadata updates

## Request Lifecycle

Most backend requests follow this flow:

```text
Frontend
  ↓
FastAPI route
  ↓
Dependency injection / database session
  ↓
Service function
  ↓
Database and/or filesystem
  ↓
Response model / JSON response
  ↓
Frontend
```

Example: loading tracks

```text
Frontend requests tracks
  ↓
Tracks route receives request
  ↓
Route opens database session
  ↓
Backend queries Track rows
  ↓
Backend prepares API-safe track response
  ↓
Frontend receives track list
```

Example: playing a track

```text
Frontend requests audio stream
  ↓
Backend resolves track by ID
  ↓
Backend validates file path
  ↓
Backend opens audio file
  ↓
Backend streams audio response
  ↓
Frontend player plays the track
```

## Main Backend Areas

## Track Management

Track management covers storing and retrieving music metadata.

The backend should know:

* where the track file is stored
* what metadata is available
* how to expose safe metadata to the frontend
* how to stream the file when requested

Track data can include:

* title
* artist
* album
* duration
* file path
* folder path
* artwork path
* BPM
* energy
* loudness
* tags

Raw local paths should not be exposed unless explicitly enabled for local debugging.

## Library Scanning

Library scanning lets the user add music files from a folder.

The scan flow should:

1. receive a folder path
2. validate the path
3. verify it is inside allowed scan roots when required
4. find supported audio files
5. extract metadata
6. create or update track records
7. return a scan result to the frontend

Path validation is security-sensitive because the backend has access to the user's filesystem.

## Playback And Streaming

The backend streams audio files to the frontend.

The frontend controls playback, but the backend owns:

* resolving the track
* validating the file path
* opening the audio file
* returning the stream response

This avoids requiring the frontend to directly access local file paths.

## Artwork

Artwork should be served through backend routes when possible.

This allows the frontend to display album art without exposing raw local artwork paths.

Recommended behavior:

* frontend requests artwork by track ID
* backend resolves the artwork
* backend returns the image response
* raw local artwork path fallback stays disabled for normal use

## Playlist Management

Playlist management handles creating, updating, deleting, and reading playlists.

The backend should manage:

* playlist records
* playlist-track relationships
* ordering when supported
* playlist metadata
* validation when adding/removing tracks

## Tagging System

The tagging system organizes tracks using controlled tags, manual tags, inferred tags, and tag reference data.

The backend should manage:

* valid tag names
* track-tag relationships
* tag references
* positive/negative reference labels
* duplicate prevention
* inference or suggestion behavior

Tag logic should be tested because it affects playlist generation and music organization.

## AI Playlist Logic

AI-style playlist logic uses available metadata and tags to generate or suggest playlists.

Possible inputs include:

* prompt text
* title
* artist
* album
* filename
* folder path
* tags
* BPM
* energy
* loudness
* duration

The backend should keep playlist generation logic separate from route handlers so it can be tested and improved safely.

## Data Layer

The backend uses SQLite with SQLAlchemy.

SQLite fits this project because the app is local-first and personal. It does not require a separate database server.

The database stores metadata, not the actual audio files. Audio files stay on the user's filesystem.

Important database concepts:

* Track
* Playlist
* PlaylistTrack
* Tag
* TrackTag
* TagReference

See `docs/database.md` for more detailed database documentation.

## File And Path Safety

File and path safety is one of the most important backend responsibilities.

The backend should:

* resolve paths safely
* reject invalid paths
* reject paths outside allowed roots when required
* avoid exposing raw local paths in API responses by default
* validate file access before streaming
* treat LAN mode as higher risk than local-only mode

This matters because the backend can scan folders, stream files, and access local data.

## LAN And Auth Behavior

The backend has two major access modes.

### Local Mode

Local mode is the default.

Expected behavior:

```text
APP_LAN_MODE=false
BACKEND_HOST=127.0.0.1
```

In this mode, the backend is only reachable from the same computer.

### LAN Mode

LAN mode is explicit opt-in.

Expected behavior:

```text
APP_LAN_MODE=true
BACKEND_HOST=0.0.0.0
API_AUTH_TOKEN=required
```

In this mode, another device on the same Wi-Fi network can connect to the backend.

Because LAN mode exposes the backend to the local network:

* API token protection is required
* scan roots should be restricted
* raw local path exposure should stay disabled
* the app should not be exposed to the public internet

## Important API Areas

The exact route files may change, but the backend API is organized around these areas:

| Area            | Purpose                                                         |
| --------------- | --------------------------------------------------------------- |
| Tracks          | List tracks, update track metadata, stream audio, serve artwork |
| Library         | Load library state and related metadata                         |
| Scanner         | Scan folders and import music files                             |
| Playlists       | Create, read, update, and delete playlists                      |
| Tags            | Manage tags and track-tag relationships                         |
| AI Playlists    | Generate playlists using prompt/metadata/tag logic              |
| Health/Settings | Confirm backend status or runtime configuration when available  |

Routes should be documented in more detail in `docs/features/` if the API grows.

## Testing

Backend tests use Pytest.

Run tests from the backend folder:

```powershell
cd backend
.\venv\Scripts\activate
python -m pytest
```

Or run using the virtual environment Python directly:

```powershell
cd backend
.\venv\Scripts\python.exe -m pytest
```

Important test areas:

* settings/environment behavior
* LAN mode authentication
* path safety
* scanner behavior
* tag persistence
* tag inference
* external tag utilities
* track update routes
* playlist behavior

Backend tests are important because the app interacts with local files and can optionally expose routes over LAN.

## Debugging Guide

### Backend does not start

Check:

* virtual environment is activated
* dependencies are installed
* `.env` values are valid
* database path exists or can be created
* port `8000` is not already in use

### Frontend cannot reach backend

Check:

* backend is running
* frontend `VITE_API_BASE_URL` is correct
* CORS settings allow the frontend origin
* LAN mode token is correct if enabled

### Scan fails

Check:

* the folder exists
* the folder is a directory
* the folder is inside `ALLOWED_SCAN_ROOTS` when LAN mode is enabled
* Docker mode scans `/music`, not the Windows host path

### Track does not play

Check:

* the track exists in the database
* the file still exists on disk
* the backend can resolve the file path
* the stream route is reachable
* LAN token/auth behavior is working if LAN mode is enabled

### Database looks empty

Check which database path is being used:

Development mode:

```text
backend/data/app.db
```

Docker mode:

```text
data/app.db
```

## Backend Design Rules

Follow these rules when changing the backend:

1. Keep routes thin.
2. Put business logic in services.
3. Keep database models focused on persistence.
4. Validate paths before filesystem access.
5. Avoid exposing raw local paths by default.
6. Treat LAN mode as security-sensitive.
7. Add or update tests when changing backend behavior.
8. Keep local mode simple and safe by default.
9. Prefer small changes with tests over large rewrites.
10. Document important behavior when it affects setup, security, or architecture.

## Known Backend Risks

* LAN mode must always require a valid token.
* Scan roots must be enforced carefully.
* Raw local paths should not leak in normal local/LAN API responses.
* Offline mobile sync rules are still evolving.
* Full-library download needs strong error handling.
* Deep audio analysis may depend on optional tools such as `ffmpeg` or `fpcalc`.
* Some frontend flows may depend on backend response shapes, so response changes should be made carefully.

## Future Backend Improvements

Possible backend improvements:

* clearer route-level API documentation
* stronger error response consistency
* better scan progress reporting
* improved metadata sync support for offline mobile mode
* better download/delete APIs for mobile offline storage
* more complete frontend/backend integration tests
* optional Docker profile for deep audio analysis dependencies
* improved AI playlist scoring
* hardware controller command API
