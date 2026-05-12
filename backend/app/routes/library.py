from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pathlib import Path
from fastapi.responses import FileResponse

from app.core.config import settings
from app.core.database import get_db
from app.core.path_guard import (
    PathSecurityError,
    is_supported_artwork_file,
    is_within_any_directory,
    safe_resolve_path,
)
from app.schemas.library import LibraryScanRequest
from app.services.scanner import run_scan_library, scan_state, reset_scan_state, validate_folder
from app.models.track import Track

router = APIRouter(prefix="/library", tags=["library"])

@router.post("/scan")
def start_library_scan(payload: LibraryScanRequest):
    try:

        # validate path
        # validate_folder(payload.folder_path)
        resolved = validate_folder(payload.folder_path).resolve()
        print(f"\n[DEBUG /library/scan] raw_folder={payload.folder_path!r}")
        print(f"[DEBUG /library/scan] resolved_folder={resolved}")

        message = run_scan_library(payload.folder_path)
        # scan_library(payload.folder_path, db) #This would be removed and replaced with the threaded version

        return {"message": message}

        # To be replaced 
        # return {"message": "Scan completed"}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Scan failed: {exc}")

@router.get("/scan_status")
def get_scan_status():
    return scan_state

@router.delete("/clear")
def clear_library(db: Session = Depends(get_db)):
    # deleted = db.query(Track).delete()
    # db.commit()
    # reset_scan_state()

    before = db.query(Track).count()
    print(f"\n[DEBUG /library/clear] tracks_before={before}")
    deleted = db.query(Track).delete()
    print(f"[DEBUG /library/clear] delete_returned={deleted}")
    db.commit()
    after = db.query(Track).count()
    print(f"[DEBUG /library/clear] tracks_after={after}")
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
