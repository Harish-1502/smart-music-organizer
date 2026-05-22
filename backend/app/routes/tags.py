from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.tag import Tag
from app.models.track import Track
from app.models.track_tag import TrackTag
from app.schemas.tags import (
    PositiveIntId,
    ReferenceSuggestionBatchRequest,
    ReferenceSuggestionBatchResponse,
    ReferenceTagSuggestionRead,
    TagCreateRequest,
    TagReferenceTrackCreate,
    TagReferenceTrackDeleteResponse,
    TagReferenceTrackRead,
    TagResponse,
    TrackTagCreateRequest,
    TrackTagResponse,
)
from app.services.tag_reference_tracks import (
    add_or_update_tag_reference_track,
    list_reference_tracks_for_tag,
    remove_tag_reference_track,
)
from app.services.tagging.reference_tag_scorer import suggest_tracks_for_tag_from_references
from app.services.tagging.reference_suggestion_actions import (
    accept_reference_tag_suggestions_batch,
    reject_reference_tag_suggestions_batch,
)

router = APIRouter(prefix="/tags", tags=["tags"])


def _get_tag_or_404(db: Session, tag_id: int) -> Tag:
    tag = db.query(Tag).filter(Tag.id == tag_id).first()

    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    return tag


def _get_track_or_404(db: Session, track_id: int) -> Track:
    track = db.query(Track).filter(Track.id == track_id).first()

    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    return track


def _track_title(track: Track) -> str | None:
    return track.display_title or track.title or track.scanned_title


def _track_artist(track: Track) -> str | None:
    return track.display_artist or track.artist or track.scanned_artist


def _reference_response(reference) -> TagReferenceTrackRead:
    track = reference.track

    return TagReferenceTrackRead(
        id=reference.id,
        tag_id=reference.tag_id,
        track_id=reference.track_id,
        label=reference.label,
        source=reference.source,
        track_title=_track_title(track) if track else None,
        track_artist=_track_artist(track) if track else None,
        track_file_name=track.file_name if track else "",
        created_at=reference.created_at,
    )


@router.get("", response_model=list[TagResponse])
def get_tags(db: Session = Depends(get_db)):
    return db.query(Tag).order_by(Tag.category.asc(), Tag.name.asc()).all()


@router.post("", response_model=TagResponse)
def create_tag(request: TagCreateRequest, db: Session = Depends(get_db)):
    name = request.name.strip().lower()
    category = request.category.strip().lower()

    if not name:
        raise HTTPException(status_code=400, detail="Tag name cannot be empty")

    if not category:
        raise HTTPException(status_code=400, detail="Tag category cannot be empty")

    existing_tag = db.query(Tag).filter(Tag.name == name).first()

    if existing_tag:
        raise HTTPException(status_code=400, detail="Tag already exists")

    tag = Tag(name=name, category=category)

    db.add(tag)
    db.commit()
    db.refresh(tag)

    return tag


@router.get(
    "/{tag_id}/reference-tracks",
    response_model=list[TagReferenceTrackRead],
)
def get_tag_reference_tracks(tag_id: int, db: Session = Depends(get_db)):
    _get_tag_or_404(db, tag_id)

    references = list_reference_tracks_for_tag(db, tag_id)

    return [
        _reference_response(reference)
        for reference in references
    ]


@router.get(
    "/{tag_id}/reference-suggestions",
    response_model=list[ReferenceTagSuggestionRead],
)
def get_reference_suggestions(
    tag_id: int,
    limit: int = Query(default=25, ge=1, le=100),
    min_score: float = Query(default=0.65, ge=0.0, le=1.0),
    db: Session = Depends(get_db),
):
    try:
        return suggest_tracks_for_tag_from_references(
            db,
            tag_id=tag_id,
            limit=limit,
            min_score=min_score,
        )
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))


@router.post(
    "/{tag_id}/reference-suggestions/accept-batch",
    response_model=ReferenceSuggestionBatchResponse,
)
def accept_reference_suggestions_batch(
    tag_id: int,
    request: ReferenceSuggestionBatchRequest,
    db: Session = Depends(get_db),
):
    try:
        result = accept_reference_tag_suggestions_batch(
            db=db,
            tag_id=tag_id,
            track_ids=request.track_ids,
        )
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))

    db.commit()

    return ReferenceSuggestionBatchResponse(
        tag_id=result.tag_id,
        accepted_count=len(result.track_ids),
        track_ids=result.track_ids,
        skipped_track_ids=result.skipped_track_ids,
    )


@router.post(
    "/{tag_id}/reference-suggestions/reject-batch",
    response_model=ReferenceSuggestionBatchResponse,
)
def reject_reference_suggestions_batch(
    tag_id: int,
    request: ReferenceSuggestionBatchRequest,
    db: Session = Depends(get_db),
):
    try:
        result = reject_reference_tag_suggestions_batch(
            db=db,
            tag_id=tag_id,
            track_ids=request.track_ids,
        )
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))

    db.commit()

    return ReferenceSuggestionBatchResponse(
        tag_id=result.tag_id,
        rejected_count=len(result.track_ids),
        track_ids=result.track_ids,
        skipped_track_ids=result.skipped_track_ids,
    )


@router.post(
    "/{tag_id}/reference-tracks",
    response_model=TagReferenceTrackRead,
)
def add_tag_reference_track(
    tag_id: int,
    request: TagReferenceTrackCreate,
    db: Session = Depends(get_db),
):
    _get_tag_or_404(db, tag_id)
    _get_track_or_404(db, request.track_id)

    reference = add_or_update_tag_reference_track(
        db=db,
        tag_id=tag_id,
        track_id=request.track_id,
        label=request.label,
        source="manual_reference",
    )

    db.commit()
    db.refresh(reference)

    return _reference_response(reference)


@router.delete(
    "/{tag_id}/reference-tracks",
    response_model=TagReferenceTrackDeleteResponse,
)
def delete_tag_reference_track(
    tag_id: int,
    track_id: PositiveIntId,
    db: Session = Depends(get_db),
):
    _get_tag_or_404(db, tag_id)
    _get_track_or_404(db, track_id)

    removed = remove_tag_reference_track(
        db=db,
        tag_id=tag_id,
        track_id=track_id,
    )

    if not removed:
        raise HTTPException(status_code=404, detail="Tag reference track not found")

    db.commit()

    return TagReferenceTrackDeleteResponse(
        message="Tag reference track removed",
        tag_id=tag_id,
        track_id=track_id,
    )


@router.get("/tracks/{track_id}", response_model=list[TrackTagResponse])
def get_track_tags(track_id: int, db: Session = Depends(get_db)):
    track = db.query(Track).filter(Track.id == track_id).first()

    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    track_tags = (
        db.query(TrackTag)
        .join(Tag, TrackTag.tag_id == Tag.id)
        .filter(TrackTag.track_id == track_id)
        .order_by(Tag.category.asc(), Tag.name.asc())
        .all()
    )

    return [
        TrackTagResponse(
            id=track_tag.id,
            tag_id=track_tag.tag.id,
            name=track_tag.tag.name,
            category=track_tag.tag.category,
            source=track_tag.source,
            confidence=track_tag.confidence,
            created_at=track_tag.created_at,
        )
        for track_tag in track_tags
    ]


@router.post("/tracks/{track_id}", response_model=TrackTagResponse)
def add_tag_to_track(
    track_id: int,
    request: TrackTagCreateRequest,
    db: Session = Depends(get_db),
):
    track = db.query(Track).filter(Track.id == track_id).first()

    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    tag = db.query(Tag).filter(Tag.id == request.tag_id).first()

    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    existing_track_tag = (
        db.query(TrackTag)
        .filter(
            TrackTag.track_id == track_id,
            TrackTag.tag_id == request.tag_id,
        )
        .first()
    )

    if existing_track_tag:
        raise HTTPException(status_code=400, detail="Track already has this tag")

    track_tag = TrackTag(
        track_id=track_id,
        tag_id=request.tag_id,
        source="manual",
        confidence=1.0,
    )

    db.add(track_tag)
    db.commit()
    db.refresh(track_tag)

    return TrackTagResponse(
        id=track_tag.id,
        tag_id=tag.id,
        name=tag.name,
        category=tag.category,
        source=track_tag.source,
        confidence=track_tag.confidence,
        created_at=track_tag.created_at,
    )


@router.delete("/tracks/{track_id}/{tag_id}")
def remove_tag_from_track(
    track_id: int,
    tag_id: int,
    db: Session = Depends(get_db),
):
    track_tag = (
        db.query(TrackTag)
        .filter(
            TrackTag.track_id == track_id,
            TrackTag.tag_id == tag_id,
        )
        .first()
    )

    if not track_tag:
        raise HTTPException(status_code=404, detail="Track tag not found")

    db.delete(track_tag)
    db.commit()

    return {"message": "Tag removed from track"}
