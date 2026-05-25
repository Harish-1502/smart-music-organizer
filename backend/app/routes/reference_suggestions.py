from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.tags import GlobalReferenceTagSuggestionRead
from app.services.tagging.reference_tag_scorer import (
    suggest_tracks_for_all_reference_tags,
)


router = APIRouter(tags=["reference-suggestions"])


@router.get(
    "/reference-suggestions",
    response_model=list[GlobalReferenceTagSuggestionRead],
)
def get_global_reference_suggestions(
    limit: int = Query(default=50, ge=1, le=200),
    min_score: float = Query(default=0.65, ge=0.0, le=1.0),
    db: Session = Depends(get_db),
):
    return suggest_tracks_for_all_reference_tags(
        db,
        limit=limit,
        min_score=min_score,
    )
