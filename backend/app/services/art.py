from __future__ import annotations

from pathlib import Path
import shutil
from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.path_guard import (
    is_supported_artwork_file,
    safe_resolve_path,
    validate_upload_size,
)
from app.models.track import Track

ARTWORK_FILENAMES = (
    "cover.jpg",
    "folder.jpg",
    "cover.png",
    "folder.png",
)

ART_DIR = settings.managed_artwork_dir
ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


class ArtworkUploadError(RuntimeError):
    """Raised when artwork upload fails after request validation passes."""


def detect_album_art(file_path: str | Path) -> str | None:
    """
    Look for common local album art files in the same directory
    as the audio file.

    Returns:
        Absolute or relative path string to the first match, or None.
    """
    path = Path(file_path)
    folder = path.parent

    for filename in ARTWORK_FILENAMES:
        candidate = folder / filename
        if candidate.exists() and candidate.is_file():
            return str(candidate)

    return None

def upload_track_art(
    db: Session,
    track_id: int,
    file: UploadFile,
) -> dict:
    track = db.query(Track).filter(Track.id == track_id).first()

    if not track:
        raise ValueError("Track not found")

    extension = ALLOWED_IMAGE_TYPES.get(file.content_type)

    if not extension:
        raise ValueError("Invalid image type. Use JPG, PNG, or WebP.")

    if not is_supported_artwork_file(f"artwork{extension}"):
        raise ValueError("Invalid image type. Use JPG, PNG, or WebP.")

    validate_upload_size(file, settings.upload_max_bytes)

    filename = f"track_{track_id}{extension}"

    try:
        art_dir = safe_resolve_path(ART_DIR, reject_parent_refs=False)
        art_dir.mkdir(parents=True, exist_ok=True)
        file_path = art_dir / filename

        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        track.art_path = str(file_path)

        db.commit()
        db.refresh(track)

        return {
            "result": "Track art updated",
            "track_id": track.id,
            "art_path": track.art_path,
            "art_path": f"/static/track_art/{filename}",
        }

    except Exception as exc:
        db.rollback()
        raise ArtworkUploadError("Failed to upload artwork") from exc

    finally:
        file.file.close()
