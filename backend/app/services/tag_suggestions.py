from sqlalchemy.orm import Session

from app.utils.tag_rules import TAG_RULES
from app.models.tag import Tag
from app.models.track import Track
from app.models.track_tag import TrackTag
from app.models.track_tag_suggestion import TrackTagSuggestion
from app.services.tag_inference import infer_track_tag_suggestions


def ensure_tag_exists(db: Session, tag_name: str) -> Tag | None:
    rule = TAG_RULES.get(tag_name)

    if not rule:
        return None

    tag = db.query(Tag).filter(Tag.name == tag_name).first()

    if tag:
        return tag

    tag = Tag(
        name=tag_name,
        category=rule["category"],
    )

    db.add(tag)
    db.flush()

    return tag


def refresh_track_tag_suggestions(db: Session, track: Track) -> list[TrackTagSuggestion]:
    """
    Rebuild pending auto tag suggestions for a track.

    Existing accepted/rejected suggestions are preserved so the app does not
    keep re-suggesting tags the user already rejected.
    """
    suggestions = infer_track_tag_suggestions(track)
    saved_suggestions = []

    for suggestion in suggestions:
        tag = ensure_tag_exists(db, suggestion["tag_name"])

        if not tag:
            continue

        # Do not suggest tags the track already has.
        existing_track_tag = (
            db.query(TrackTag)
            .filter(
                TrackTag.track_id == track.id,
                TrackTag.tag_id == tag.id,
            )
            .first()
        )

        if existing_track_tag:
            continue

        existing_suggestion = (
            db.query(TrackTagSuggestion)
            .filter(
                TrackTagSuggestion.track_id == track.id,
                TrackTagSuggestion.tag_id == tag.id,
            )
            .first()
        )

        if existing_suggestion:
            # Do not resurrect rejected suggestions.
            if existing_suggestion.status == "rejected":
                continue

            # Keep accepted suggestions as history.
            if existing_suggestion.status == "accepted":
                continue

            existing_suggestion.confidence = max(
                existing_suggestion.confidence,
                suggestion["confidence"],
            )
            existing_suggestion.reason = suggestion["reason"]
            saved_suggestions.append(existing_suggestion)
            continue

        track_tag_suggestion = TrackTagSuggestion(
            track_id=track.id,
            tag_id=tag.id,
            source="rule",
            confidence=suggestion["confidence"],
            status="pending",
            reason=suggestion["reason"],
        )

        db.add(track_tag_suggestion)
        saved_suggestions.append(track_tag_suggestion)

    return saved_suggestions


def accept_tag_suggestion(
    db: Session,
    track_id: int,
    suggestion_id: int,
) -> TrackTag:
    suggestion = (
        db.query(TrackTagSuggestion)
        .filter(
            TrackTagSuggestion.id == suggestion_id,
            TrackTagSuggestion.track_id == track_id,
        )
        .first()
    )

    if not suggestion:
        raise ValueError("Suggestion not found")

    existing_track_tag = (
        db.query(TrackTag)
        .filter(
            TrackTag.track_id == track_id,
            TrackTag.tag_id == suggestion.tag_id,
        )
        .first()
    )

    if existing_track_tag:
        suggestion.status = "accepted"
        return existing_track_tag

    track_tag = TrackTag(
        track_id=track_id,
        tag_id=suggestion.tag_id,
        source="auto_accepted",
        confidence=suggestion.confidence,
    )

    suggestion.status = "accepted"

    db.add(track_tag)
    db.flush()

    return track_tag


def reject_tag_suggestion(
    db: Session,
    track_id: int,
    suggestion_id: int,
) -> TrackTagSuggestion:
    suggestion = (
        db.query(TrackTagSuggestion)
        .filter(
            TrackTagSuggestion.id == suggestion_id,
            TrackTagSuggestion.track_id == track_id,
        )
        .first()
    )

    if not suggestion:
        raise ValueError("Suggestion not found")

    suggestion.status = "rejected"

    return suggestion