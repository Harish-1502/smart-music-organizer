from fastapi import APIRouter, Depends, HTTPException
import logging
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.schemas.ai_playlists import (
    GeneratePlaylistResponse,
    GeneratePlaylistRequest,
    ParsePromptResponse,
    ParsePromptRequest,
)
from app.services.prompt_parser import parse_prompt
from app.services.playlist_generator import generate_scored_tracks_from_rules
from app.services.tag_inference import parsed_rules_to_tags
from app.services.playlist import (
    add_playlist,
    add_tracks_to_playlist,

)
from app.services.playlist_generator import (
    generate_playlist_name_from_prompt,
    make_unique_playlist_name,
    apply_playlist_duration_limit,
)

router = APIRouter(prefix="/ai_playlists", tags=["ai_playlists"])
logger = logging.getLogger(__name__)

@router.post("/generate", response_model=GeneratePlaylistResponse)
def generate_ai_playlist(
    request: GeneratePlaylistRequest,
    db: Session = Depends(get_db),
):
    if not settings.enable_ai_playlists:
        raise HTTPException(
            status_code=403,
            detail="AI playlist generation is disabled.",
        )

    try:
        parsed_rules = parse_prompt(request.prompt)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))

    include_tags, exclude_tags = parsed_rules_to_tags(parsed_rules)

    duration_max_minutes = parsed_rules.get("duration_max_minutes")

    max_duration_seconds = (
        duration_max_minutes * 60
        if duration_max_minutes is not None
        else None
    )

    scored_tracks = generate_scored_tracks_from_rules(
        db=db,
        include_tags=include_tags,
        exclude_tags=exclude_tags,
        limit=max(request.limit * 3, request.limit),
    )

    scored_tracks = apply_playlist_duration_limit(
        scored_tracks=scored_tracks,
        max_duration_seconds=max_duration_seconds,
    )

    scored_tracks = scored_tracks[:request.limit]

    tracks = [track for track, score in scored_tracks]

    if not tracks:
        raise HTTPException(
            status_code=404,
            detail="No matching tracks found for this prompt.",
        )

    playlist_name = (
        request.playlist_name.strip()
        if request.playlist_name and request.playlist_name.strip()
        else generate_playlist_name_from_prompt(request.prompt)
    )

    playlist_name = make_unique_playlist_name(db, playlist_name)

    try:
        playlist = add_playlist(db=db, name=playlist_name)

        add_tracks_to_playlist(
            db=db,
            playlist_id=playlist.id,
            track_ids=[track.id for track in tracks],
        )

        db.commit()
        db.refresh(playlist)

    except Exception:
        db.rollback()
        logger.exception("Failed to generate AI playlist")
        raise HTTPException(
            status_code=500,
            detail="Failed to generate playlist",
        )

    total_duration_seconds = sum(
        float(track.duration or 0)
        for track in tracks
    )

    return {
        "prompt": request.prompt,
        "playlist_id": playlist.id,
        "playlist_name": playlist.name,
        "total_duration_minutes": round(total_duration_seconds / 60, 2),
        "parsed_rules": {
            **parsed_rules,
            "include_tags": include_tags,
            "exclude_tags": exclude_tags,
        },
        "tracks": tracks,
    }
