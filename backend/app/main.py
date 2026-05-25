from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi.responses import FileResponse
from fastapi import HTTPException
from app.core.auth import is_auth_exempt_path, require_api_token
from app.core.config import settings
from app.core.database import Base, engine
from fastapi.staticfiles import StaticFiles
from app.routes import (
    library, 
    tracks,
    artist, 
    album, 
    playlist, 
    playback, 
    ai_playlists,
    tags,
    reference_suggestions,
)
import logging
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BACKEND_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = BACKEND_ROOT.parent
FRONTEND_DIST = PROJECT_ROOT / "frontend" / "dist"
FRONTEND_INDEX = FRONTEND_DIST / "index.html"
FRONTEND_ASSETS = FRONTEND_DIST / "assets"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Smart Music Organizer API")


def frontend_build_available() -> bool:
    return FRONTEND_INDEX.is_file()


def is_html_navigation(request: Request) -> bool:
    if request.method not in {"GET", "HEAD"}:
        return False

    return "text/html" in request.headers.get("accept", "").lower()


def is_frontend_route(path: str) -> bool:
    normalized_path = path.rstrip("/") or "/"

    if normalized_path in {"/", "/library", "/playlists", "/player"}:
        return True

    parts = [part for part in normalized_path.split("/") if part]
    return len(parts) == 2 and parts[0] == "playlists"


def get_frontend_root_file(path: str) -> Path | None:
    if path in {"", "/"}:
        return None

    relative_path = path.lstrip("/")

    if "/" in relative_path or "\\" in relative_path:
        return None

    requested_path = (FRONTEND_DIST / relative_path).resolve()
    dist_root = FRONTEND_DIST.resolve()

    try:
        requested_path.relative_to(dist_root)
    except ValueError:
        return None

    return requested_path if requested_path.is_file() else None


def resolve_backend_path(path: Path) -> Path:
    if path.is_absolute():
        return path

    return BACKEND_ROOT / path


@app.middleware("http")
async def serve_react_app_for_html_navigation(request: Request, call_next):
    if frontend_build_available() and request.method in {"GET", "HEAD"}:
        frontend_file = get_frontend_root_file(request.url.path)

        if frontend_file:
            return FileResponse(frontend_file)

        if is_html_navigation(request) and is_frontend_route(request.url.path):
            return FileResponse(FRONTEND_INDEX)

    return await call_next(request)


@app.middleware("http")
async def require_token_in_lan_mode(request: Request, call_next):
    is_frontend_navigation = (
        frontend_build_available()
        and is_html_navigation(request)
        and is_frontend_route(request.url.path)
    )

    if (
        settings.app_lan_mode
        and not is_auth_exempt_path(request.url.path)
        and not is_frontend_navigation
    ):
        try:
            require_api_token(request)
        except HTTPException as exc:
            return JSONResponse(
                status_code=exc.status_code,
                content={"detail": exc.detail},
                headers=exc.headers,
            )

    return await call_next(request)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "Backend is running"}

if FRONTEND_ASSETS.is_dir():
    app.mount("/assets", StaticFiles(directory=FRONTEND_ASSETS), name="frontend-assets")

MANAGED_ARTWORK_STATIC_DIR = resolve_backend_path(settings.managed_artwork_dir)
MANAGED_ARTWORK_STATIC_DIR.mkdir(parents=True, exist_ok=True)
app.mount(
    "/static/track_art",
    StaticFiles(directory=MANAGED_ARTWORK_STATIC_DIR),
    name="track-art-static",
)

app.include_router(library.router)
app.include_router(tracks.router)
app.include_router(artist.router)
app.include_router(album.router)
app.include_router(playlist.router)
app.include_router(playback.router)
app.include_router(ai_playlists.router)
app.include_router(tags.router)
app.include_router(reference_suggestions.router)
