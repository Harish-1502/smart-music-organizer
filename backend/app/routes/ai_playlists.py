from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.ai_playlists import GeneratePlaylistResponse, GeneratePlaylistRequest, ParsePromptResponse, ParsePromptRequest
from app.services.prompt_parser import parse_prompt
from app.services.playlist_generator import generate_tracks_from_rules, generate_scored_tracks_from_rules
from app.services.tag_inference import parsed_rules_to_tags

router = APIRouter(prefix="/ai_playlists", tags=["ai_playlists"])


@router.post("/parse-prompt", response_model=ParsePromptResponse)
def parse_ai_prompt(request: ParsePromptRequest):
    try:
        parsed_rules = parse_prompt(request.prompt)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))

    return {
        "prompt": request.prompt,
        "parsed_rules": parsed_rules,
    }

@router.post("/generate", response_model=GeneratePlaylistResponse)
def generate_ai_playlist(
    request: GeneratePlaylistRequest,
    db: Session = Depends(get_db),
):
    try:
        parsed_rules = parse_prompt(request.prompt)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))

    include_tags, exclude_tags = parsed_rules_to_tags(parsed_rules)

    scored_tracks = generate_scored_tracks_from_rules(
        db=db,
        include_tags=include_tags,
        exclude_tags=exclude_tags,
        limit=request.limit,
    )

    for track, score in scored_tracks:
        print(f"[AI playlist] {track.display_title} score={score}")

    tracks = [track for track, score in scored_tracks]

    return {
        "prompt": request.prompt,
        "parsed_rules": {
            **parsed_rules,
            "include_tags": include_tags,
            "exclude_tags": exclude_tags,
        },
        "tracks": tracks,
    }