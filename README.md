# Smart Music Organizer

Smart Music Organizer is a local personal server app. One computer runs the
FastAPI server and serves the built React app. Other devices on the same Wi-Fi
can open the app in a browser.

This is not a public hosted website setup.

## Docker Local-Server Mode

Use Docker when you want to run the app without installing Python, Node, React,
or opening the project in an editor.

From the project root, create host folders for persistent data and the default
music mount:

```powershell
mkdir data
mkdir music
```

Copy the example environment file:

```powershell
copy .env.example .env
```

Set `MUSIC_PATH` in `.env` to the real music folder on your computer. Examples:

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

From a tablet or phone on the same Wi-Fi, open:

```text
http://<server-ip>:8000
```

Docker builds the React/Vite frontend inside the image, then runs FastAPI from
the final Python container. The final runtime container does not need Node.

### Docker V1 Limitations

Docker v1 is focused on reliable core local-server usage: FastAPI starts,
the React frontend is served, SQLite persists through `./data`, `/music` is
mounted, and the library, playlist, player, and streaming routes are available.

Deep scan, audio fingerprinting, AcoustID fallback, and deeper audio analysis
may require optional system packages such as `ffmpeg` and
`fpcalc`/`libchromaprint-tools`. Those packages are not installed in the
default Docker image yet because they make builds depend on Debian package
mirror availability. They will be handled later in a Docker-full image or an
optional Compose profile.

### Docker Music Path

In Docker mode, the app runs inside a Linux container. Windows paths such as:

```text
C:\Users\Name\Music
```

do not exist inside the container.

Docker Compose mounts the host folder from `MUSIC_PATH` as:

```text
/music
```

When scanning in the app, enter:

```text
/music
```

Do not enter your Windows music path in Docker mode.

### Docker Data And Database

Docker stores SQLite data, uploaded artwork, and app data in the root `data`
folder through this volume:

```text
./data:/app/backend/data
```

That means the Docker database is:

```text
data/app.db
```

The development database is still:

```text
backend/data/app.db
```

To reuse an existing development database in Docker, copy:

```text
backend/data/app.db
```

to:

```text
data/app.db
```

The Docker image does not copy your music files or bake your SQLite database
into the image.

### Optional Deep Scan Key

Deep scan fingerprint lookup can use an AcoustID API key. Copy `.env.example`
to `.env` and set:

```text
ACOUSTID_API_KEY=your-key-here
```

Docker Compose reads `.env` automatically for variable substitution.

## Development Mode

Use this when editing the app.

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

In Vite development, frontend API calls use `http://127.0.0.1:8000` by
default. You can override this with `VITE_API_BASE_URL`.

## Build The Frontend

Build the React app once before using production local-server mode:

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

Use this for normal personal use without running `npm run dev`.

After building the frontend, run the backend server:

```powershell
cd backend
.\venv\Scripts\activate
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Then open:

```text
http://localhost:8000
```

FastAPI serves the built React frontend from `frontend/dist` when it exists.
API routes such as `/tracks`, `/playlists`, `/library`, `/tags`, and
`/ai_playlists` remain unchanged.

You can also use the Windows launcher:

```text
Start Smart Music Organizer.bat
```

The launcher starts the FastAPI server on `0.0.0.0:8000`, opens
`http://localhost:8000`, and prints tablet access instructions.

## Tablet Or Phone Access

Make sure the server computer and tablet/phone are on the same Wi-Fi network.

Find the server computer's local IPv4 address:

```powershell
ipconfig
```

Look for `IPv4 Address`, then open this URL on the tablet/phone:

```text
http://<server-ip>:8000
```

For example:

```text
http://192.168.1.25:8000
```

The server computer must stay awake, connected to Wi-Fi, and have the launcher
or backend terminal window open while using the app.
