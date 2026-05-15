from fastapi import HTTPException
import logging
from math import ceil
from pathlib import Path

from fastapi import APIRouter, Depends, Query, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.path_guard import (
    PathSecurityError,
    is_supported_artwork_file,
    is_within_any_directory,
    safe_resolve_path,
)
from app.models.track import Track
from app.schemas.track import PaginatedTracks, TrackUpdateRequest
from app.services.art import ArtworkUploadError, upload_track_art
from app.services.tag_inference import apply_inferred_tags
from app.services.deep_scan import deep_scan_track
from app.services.track_audio_analysis import analyze_track_audio
from app.services.tag_inference import refresh_inferred_tags

router = APIRouter(prefix="/tracks", tags=["tracks"])
logger = logging.getLogger(__name__)


def _resolve_track_art_path(track: Track) -> Path:
    if not track.art_path:
        raise HTTPException(status_code=404, detail="Artwork not found")

    try:
        file_path = safe_resolve_path(track.art_path)
    except PathSecurityError as exc:
        raise HTTPException(status_code=403, detail=str(exc))

    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="Artwork not found")

    if not is_supported_artwork_file(file_path):
        raise HTTPException(status_code=403, detail="Artwork path is not allowed")

    managed_roots = [
        *settings.managed_static_dirs,
        settings.managed_artwork_dir,
    ]

    if is_within_any_directory(file_path, managed_roots):
        return file_path

    stored_path = safe_resolve_path(track.art_path, reject_parent_refs=False)
    if file_path == stored_path:
        return file_path

    raise HTTPException(status_code=403, detail="Artwork path is not allowed")

@router.get("", response_model=PaginatedTracks)
def get_tracks(
    search: str | None = Query(default=None),
    sort_by: str = Query(default="title"),
    order: str = Query(default="asc"),
    artist: str | None = Query(default=None),
    album: str | None = Query(default=None),
    exact_artist: str | None = Query(default=None),
    exact_album: str | None = Query(default=None),
    extension: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    db: Session = Depends(get_db),
):
    # print("GET /tracks called")
    # print(f"Query params - search: {search}, sort_by: {sort_by}, order: {order}, artist: {artist}, album: {album}, exact_artist: {exact_artist}, exact_album: {exact_album},extension: {extension}, page: {page}, page_size: {page_size}")
    query = db.query(Track)
    # print("base query created")

    if search:
        search_term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Track.display_title.ilike(search_term),
                Track.display_artist.ilike(search_term),
                Track.display_album.ilike(search_term),
            )
        )   
        logger.debug("Track search filter applied")
    
    # DUBUG
    # print("Exact artist:", exact_artist)
    # print("Artist:", artist)

    if exact_artist:
        query = query.filter(Track.display_artist == exact_artist.strip())
    elif artist:
        query = query.filter(Track.display_artist.ilike(f"%{artist.strip()}%"))

    if exact_album:
        query = query.filter(Track.display_album == exact_album.strip())
    elif album:
        query = query.filter(Track.display_album.ilike(f"%{album.strip()}%"))

    if extension:
        query = query.filter(Track.extension == extension)

    allowed_sort_fields = {
        "title": Track.display_title,
        "artist": Track.display_artist,
        "album": Track.display_album,
        "duration": Track.duration,
    }

    sort_column = allowed_sort_fields.get(sort_by, Track.display_title)

    if order.lower() == "desc":
        query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(sort_column.asc())

    # print("before count")
    total_items = query.count()
    # print("after count", total_items)

    total_pages = ceil(total_items / page_size) if total_items > 0 else 1

    offset = (page - 1) * page_size
    # print("before fetch")
    tracks = query.offset(offset).limit(page_size).all()
    # print("after fetch", len(tracks))

    return PaginatedTracks(
        items=tracks,
        page=page,
        page_size=page_size,
        total_items=total_items,
        total_pages=total_pages,
    )

@router.patch("/{track_id}", response_model=TrackUpdateRequest)
def update_track(track_id: int, data: TrackUpdateRequest, db: Session = Depends(get_db)):
    track = db.query(Track).filter(Track.id == track_id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    
    track.user_edited = True

    if data.title is not None:
        track.title = data.title
        track.display_title = data.title
    if data.artist is not None:
        track.artist = data.artist
        track.display_artist = data.artist
    if data.album is not None:
        track.album = data.album
        track.display_album = data.album

    try:
        apply_inferred_tags(db, track)
        db.commit()
        db.refresh(track)
    except Exception:
        db.rollback()
        logger.exception("Failed to update track", extra={"track_id": track_id})
        raise HTTPException(status_code=500, detail="Failed to update track")
    
    return TrackUpdateRequest(
        title=track.title,
        artist=track.artist,
        album=track.album,
    )

@router.post("/{track_id}/art")
def update_track_art(
    track_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    try:
        return upload_track_art(
            db=db,
            track_id=track_id,
            file=file,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ArtworkUploadError:
        logger.exception("Failed to upload artwork", extra={"track_id": track_id})
        raise HTTPException(status_code=500, detail="Failed to upload artwork")


@router.get("/{track_id}/art")
def get_track_art(
    track_id: int,
    db: Session = Depends(get_db),
):
    track = db.query(Track).filter(Track.id == track_id).first()

    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    return FileResponse(_resolve_track_art_path(track))


@router.post("/{track_id}/deep-scan")
def deep_scan_track_route(
    track_id: int,
    db: Session = Depends(get_db),
):
    if not settings.enable_deep_scan:
        raise HTTPException(
            status_code=403,
            detail="Deep scan is disabled.",
        )

    track = db.query(Track).filter(Track.id == track_id).first()

    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    try:
        result = deep_scan_track(db, track)
        db.commit()

    except Exception:
        db.rollback()
        logger.exception("Failed to deep scan track", extra={"track_id": track_id})
        raise HTTPException(
            status_code=500,
            detail="Failed to deep scan track",
        )

    return {
        "track_id": result.track_id,
        "method_used": result.method_used,
        "musicbrainz_recording_id": result.musicbrainz_recording_id,
        "warnings": result.warnings,
        "applied_tags": [
            {
                "name": track_tag.tag.name,
                "category": track_tag.tag.category,
                "source": track_tag.source,
                "confidence": track_tag.confidence,
            }
            for track_tag in result.applied_tags
        ],
    }


# @router.post("/{track_id}/audio-analysis/refresh")
# def refresh_track_audio_analysis_route(
#     track_id: int,
#     db: Session = Depends(get_db),
# ):
#     track = db.query(Track).filter(Track.id == track_id).first()

#     if not track:
#         raise HTTPException(status_code=404, detail="Track not found")

#     try:
#         analyze_track_audio(db, track)
#         refresh_inferred_tags(db, track)
#         db.commit()
#         db.refresh(track)

#     except Exception as error:
#         db.rollback()
#         raise HTTPException(
#             status_code=500,
#             detail=f"Failed to refresh audio analysis: {error}",
#         )

#     return {
#         "track_id": track.id,
#         "bpm": track.bpm,
#         "bpm_confidence": track.bpm_confidence,
#         "energy_score": track.energy_score,
#         "energy_label": track.energy_label,
#         "energy_confidence": track.energy_confidence,
#         "audio_analysis_error": track.audio_analysis_error,
#     }
