from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pathlib import Path
from fastapi.responses import FileResponse
import logging

from app.core.config import settings
from app.core.database import get_db
from app.core.path_guard import (
    PathSecurityError,
    is_supported_artwork_file,
    is_within_any_directory,
    safe_resolve_path,
)
from app.schemas.library import ClearLibraryRequest, LibraryScanRequest
from app.services.scanner import run_scan_library, scan_state, reset_scan_state, validate_folder
from app.models.playlistTrack import PlaylistTrack
from app.models.track import Track
from app.models.track_tag import TrackTag
from app.models.track_tag_suggestion import TrackTagSuggestion

router = APIRouter(prefix="/library", tags=["library"])
logger = logging.getLogger(__name__)

@router.post("/scan")
def start_library_scan(payload: LibraryScanRequest):
    try:

        # validate path
        # validate_folder(payload.folder_path)
        resolved = validate_folder(payload.folder_path).resolve()
        logger.debug("Scan requested for raw folder=%r", payload.folder_path)
        logger.debug("Resolved scan folder=%s", resolved)

        message = run_scan_library(payload.folder_path)
        # scan_library(payload.folder_path, db) #This would be removed and replaced with the threaded version

        return {"message": message}

        # To be replaced 
        # return {"message": "Scan completed"}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception:
        logger.exception("Failed to scan library")
        raise HTTPException(status_code=500, detail="Failed to scan library")

@router.get("/scan_status")
def get_scan_status():
    public_scan_state = scan_state.copy()

    if not settings.expose_local_paths:
        public_scan_state["current_file"] = None

        if public_scan_state.get("last_error"):
            public_scan_state["last_error"] = "Scan error details hidden."

    return public_scan_state

@router.delete("/clear")
def clear_library(payload: ClearLibraryRequest, db: Session = Depends(get_db)):
    if payload.confirm != "CLEAR LIBRARY":
        raise HTTPException(
            status_code=400,
            detail='Confirmation must exactly match "CLEAR LIBRARY".',
        )

    before = db.query(Track).count()
    logger.debug("Clearing library with tracks_before=%s", before)

    db.query(PlaylistTrack).delete(synchronize_session=False)
    db.query(TrackTagSuggestion).delete(synchronize_session=False)
    db.query(TrackTag).delete(synchronize_session=False)
    deleted = db.query(Track).delete(synchronize_session=False)

    logger.debug("Library clear track delete returned=%s", deleted)
    db.commit()
    after = db.query(Track).count()
    logger.debug("Library clear tracks_after=%s", after)
    reset_scan_state()


    return {
        "message": "Library cleared",
        "deleted_tracks": deleted,
    }

def _stored_track_art_paths(db: Session) -> set[Path]:
    paths = set()

    for (art_path,) in db.query(Track.art_path).filter(Track.art_path.isnot(None)).all():
        if not art_path:
            continue

        try:
            paths.add(safe_resolve_path(art_path, reject_parent_refs=False))
        except PathSecurityError:
            continue

    return paths


@router.get("/art")
def get_album_art(path: str, db: Session = Depends(get_db)):
    if not settings.enable_legacy_art_path_route:
        raise HTTPException(
            status_code=403,
            detail="Legacy artwork path access is disabled.",
        )

    try:
        file_path = safe_resolve_path(path)
    except PathSecurityError as exc:
        raise HTTPException(status_code=403, detail=str(exc))

    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="Image not found")

    if not is_supported_artwork_file(file_path):
        raise HTTPException(status_code=403, detail="Artwork path is not allowed")

    managed_roots = [
        *settings.managed_static_dirs,
        settings.managed_artwork_dir,
    ]
    is_managed_file = is_within_any_directory(file_path, managed_roots)
    is_stored_track_art = file_path in _stored_track_art_paths(db)

    if not is_managed_file and not is_stored_track_art:
        raise HTTPException(status_code=403, detail="Artwork path is not allowed")

    return FileResponse(file_path)
