from __future__ import annotations

from pathlib import Path
import shutil
from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.models.track import Track

ARTWORK_FILENAMES = (
    "cover.jpg",
    "folder.jpg",
    "cover.png",
    "folder.png",
)

ART_DIR = Path("data/track_art")
ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


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

    ART_DIR.mkdir(parents=True, exist_ok=True)

    filename = f"track_{track_id}{extension}"
    file_path = ART_DIR / filename

    try:
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

    except Exception as e:
        db.rollback()
        raise ValueError(f"Failed to update track art: {e}")

    finally:
        file.file.close()
