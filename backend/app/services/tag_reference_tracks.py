from sqlalchemy.orm import Session

from app.models.tag import Tag
from app.models.tag_reference_track import TagReferenceTrack
from app.models.track import Track


VALID_REFERENCE_LABELS = {"positive", "negative"}


def validate_reference_label(label: str) -> None:
    if label not in VALID_REFERENCE_LABELS:
        raise ValueError("Reference label must be exactly 'positive' or 'negative'")


def _get_existing_reference(
    db: Session,
    tag_id: int,
    track_id: int,
) -> TagReferenceTrack | None:
    return (
        db.query(TagReferenceTrack)
        .filter(
            TagReferenceTrack.tag_id == tag_id,
            TagReferenceTrack.track_id == track_id,
        )
        .first()
    )


def _ensure_tag_exists(db: Session, tag_id: int) -> Tag:
    tag = db.get(Tag, tag_id)

    if not tag:
        raise ValueError(f"Tag does not exist: {tag_id}")

    return tag


def _ensure_track_exists(db: Session, track_id: int) -> Track:
    track = db.get(Track, track_id)

    if not track:
        raise ValueError(f"Track does not exist: {track_id}")

    return track


def add_or_update_tag_reference_track(
    db: Session,
    tag_id: int,
    track_id: int,
    label: str,
    source: str = "manual_reference",
) -> TagReferenceTrack:
    validate_reference_label(label)
    _ensure_tag_exists(db, tag_id)
    _ensure_track_exists(db, track_id)

    existing_reference = _get_existing_reference(
        db=db,
        tag_id=tag_id,
        track_id=track_id,
    )

    if existing_reference:
        existing_reference.label = label
        existing_reference.source = source
        db.flush()
        return existing_reference

    reference = TagReferenceTrack(
        tag_id=tag_id,
        track_id=track_id,
        label=label,
        source=source,
    )

    db.add(reference)
    db.flush()

    return reference


def remove_tag_reference_track(db: Session, tag_id: int, track_id: int) -> bool:
    reference = _get_existing_reference(
        db=db,
        tag_id=tag_id,
        track_id=track_id,
    )

    if not reference:
        return False

    db.delete(reference)
    db.flush()

    return True


def list_reference_tracks_for_tag(
    db: Session,
    tag_id: int,
) -> list[TagReferenceTrack]:
    return (
        db.query(TagReferenceTrack)
        .filter(TagReferenceTrack.tag_id == tag_id)
        .order_by(TagReferenceTrack.id.asc())
        .all()
    )


def list_reference_tracks_for_track(
    db: Session,
    track_id: int,
) -> list[TagReferenceTrack]:
    return (
        db.query(TagReferenceTrack)
        .filter(TagReferenceTrack.track_id == track_id)
        .order_by(TagReferenceTrack.id.asc())
        .all()
    )
