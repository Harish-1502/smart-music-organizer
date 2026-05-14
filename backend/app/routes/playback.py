import asyncio
import logging
import mimetypes
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.path_guard import (
    PathSecurityError,
    is_supported_audio_file,
    is_within_any_directory,
    safe_resolve_path,
)
from app.models.track import Track

router = APIRouter(prefix="/tracks", tags=["playback"])
logger = logging.getLogger(__name__)


class AudioFileResponse(FileResponse):
    async def __call__(self, scope, receive, send):
        try:
            await super().__call__(scope, receive, send)
        except asyncio.CancelledError:
            logger.debug(
                "Audio stream response was cancelled during shutdown or client disconnect."
            )


@router.get("/{track_id}/stream")
def stream_track(track_id: int, db: Session = Depends(get_db)):
    track = db.query(Track).filter(Track.id == track_id).first()

    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    try:
        file_path = safe_resolve_path(track.file_path)
    except PathSecurityError:
        raise HTTPException(status_code=403, detail="Audio file path is not allowed")

    if settings.allowed_scan_roots and not is_within_any_directory(
        file_path,
        settings.allowed_scan_roots,
    ):
        raise HTTPException(status_code=403, detail="Audio file path is not allowed")

    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="Audio file not found")

    if not is_supported_audio_file(file_path):
        raise HTTPException(status_code=400, detail="Unsupported audio file type")

    guessed_media_type, _ = mimetypes.guess_type(file_path.name)

    return AudioFileResponse(
        path=file_path,
        media_type=guessed_media_type or "application/octet-stream",
        filename=file_path.name,
    )
