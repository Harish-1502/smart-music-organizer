from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.tag import Tag
from app.models.track import Track
from app.models.track_tag import TrackTag
from app.schemas.tags import (
    TagCreateRequest,
    TagResponse,
    TrackTagCreateRequest,
    TrackTagResponse,
)

router = APIRouter(prefix="/tags", tags=["tags"])


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