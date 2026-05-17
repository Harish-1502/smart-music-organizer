import mimetypes
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.track import Track

router = APIRouter(prefix="/tracks", tags=["playback"])


@router.get("/{track_id}/stream")
def stream_track(track_id: int, db: Session = Depends(get_db)):
    track = db.query(Track).filter(Track.id == track_id).first()

    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    file_path = Path(track.file_path)

    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="Audio file not found")

    guessed_media_type, _ = mimetypes.guess_type(file_path.name)

    return FileResponse(
        path=file_path,
        media_type=guessed_media_type or "application/octet-stream",
        filename=file_path.name,
    )
