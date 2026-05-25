from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from app.models.tag import Tag
from app.models.track import Track
from app.models.track_tag import TrackTag
from app.services.tag_reference_tracks import add_or_update_tag_reference_track


@dataclass(frozen=True)
class ReferenceSuggestionBatchResult:
    tag_id: int
    track_ids: list[int]
    skipped_track_ids: list[int] = field(default_factory=list)


def _unique_track_ids(track_ids: list[int]) -> list[int]:
    return list(dict.fromkeys(track_ids))


def _ensure_tag_exists(db: Session, tag_id: int) -> None:
    if not db.get(Tag, tag_id):
        raise ValueError(f"Tag does not exist: {tag_id}")


def _ensure_tracks_exist(db: Session, track_ids: list[int]) -> None:
    if not track_ids:
        raise ValueError("At least one track ID is required")

    existing_track_ids = {
        track_id
        for (track_id,) in (
            db.query(Track.id)
            .filter(Track.id.in_(track_ids))
            .all()
        )
    }
    missing_track_ids = [
        track_id
        for track_id in track_ids
        if track_id not in existing_track_ids
    ]

    if missing_track_ids:
        raise ValueError(f"Track does not exist: {missing_track_ids[0]}")


def _get_existing_track_tag(
    db: Session,
    tag_id: int,
    track_id: int,
) -> TrackTag | None:
    return (
        db.query(TrackTag)
        .filter(
            TrackTag.tag_id == tag_id,
            TrackTag.track_id == track_id,
        )
        .first()
    )


def accept_reference_tag_suggestions_batch(
    db: Session,
    tag_id: int,
    track_ids: list[int],
) -> ReferenceSuggestionBatchResult:
    unique_track_ids = _unique_track_ids(track_ids)
    _ensure_tag_exists(db, tag_id)
    _ensure_tracks_exist(db, unique_track_ids)

    for track_id in unique_track_ids:
        existing_track_tag = _get_existing_track_tag(
            db=db,
            tag_id=tag_id,
            track_id=track_id,
        )

        if not existing_track_tag:
            db.add(
                TrackTag(
                    tag_id=tag_id,
                    track_id=track_id,
                    source="accepted_suggestion",
                    confidence=1.0,
                )
            )

        add_or_update_tag_reference_track(
            db=db,
            tag_id=tag_id,
            track_id=track_id,
            label="positive",
            source="accepted_suggestion",
        )

    db.flush()

    return ReferenceSuggestionBatchResult(
        tag_id=tag_id,
        track_ids=unique_track_ids,
    )


def reject_reference_tag_suggestions_batch(
    db: Session,
    tag_id: int,
    track_ids: list[int],
) -> ReferenceSuggestionBatchResult:
    unique_track_ids = _unique_track_ids(track_ids)
    _ensure_tag_exists(db, tag_id)
    _ensure_tracks_exist(db, unique_track_ids)

    for track_id in unique_track_ids:
        add_or_update_tag_reference_track(
            db=db,
            tag_id=tag_id,
            track_id=track_id,
            label="negative",
            source="rejected_suggestion",
        )

    db.flush()

    return ReferenceSuggestionBatchResult(
        tag_id=tag_id,
        track_ids=unique_track_ids,
    )
