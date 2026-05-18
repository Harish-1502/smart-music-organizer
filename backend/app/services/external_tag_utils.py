"""
Shared helpers for external tagging providers.

This file is intentionally provider-agnostic. MusicBrainz, AcoustID, and
future providers like Last.fm can reuse these functions.
"""

import logging

from sqlalchemy.orm import Session

from app.utils.external_tag_map import MUSICBRAINZ_TAG_MAP
from app.utils.tag_rules import TAG_RULES
from app.models.tag import Tag
from app.models.track import Track
from app.models.track_tag import TrackTag
from app.services.tag_persistence import (
    ensure_controlled_tag_exists,
    get_tag_by_name,
)

logger = logging.getLogger(__name__)


SOURCE_PRIORITY = {
    "rule": 1,
    "musicbrainz": 2,
    "acoustid": 2,
    "lastfm": 3,
    "metadata": 4,
    "manual": 5,
}


def get_track_identity(track: Track) -> tuple[str | None, str | None, str | None]:
    """
    Return the best available title, artist, and album for lookup.

    We prefer display fields because they represent what the app currently
    shows to the user. If those are missing, we fall back to older/scanned
    metadata.
    """
    title = track.display_title or track.title or track.scanned_title
    artist = track.display_artist or track.artist or track.scanned_artist
    album = track.display_album or track.album or track.scanned_album

    return title, artist, album


def has_usable_identity(track: Track) -> bool:
    """
    Decide whether text-based MusicBrainz search is worth trying.

    If title/artist are missing or obviously weak, text search is likely to
    produce bad matches. In that case, AcoustID fingerprinting is better.
    """
    title, artist, _ = get_track_identity(track)

    if not title or not artist:
        return False

    weak_values = {
        "unknown",
        "unknown artist",
        "unknown title",
        "track01",
        "track 01",
        "audio",
        "untitled",
    }

    if title.strip().lower() in weak_values:
        return False

    if artist.strip().lower() in weak_values:
        return False

    return True


def normalize_external_tag(value: str) -> str:
    """
    Normalize external tags before mapping them to internal tags.
    """
    return value.strip().lower().replace("_", " ").replace("-", " ")


def map_external_tag(raw_tag: str) -> str | None:
    """
    Convert an external tag into one of the app's internal tag names.

    Returns None when the external tag is not useful for playlist generation.
    This prevents the database from filling with noisy provider-specific tags.
    """
    normalized = normalize_external_tag(raw_tag)

    mapped = MUSICBRAINZ_TAG_MAP.get(normalized)
    if mapped:
        return mapped

    # If the provider already returned an internal tag name, keep it.
    if normalized in TAG_RULES:
        return normalized

    return None


def confidence_from_count(count: int | None) -> float:
    """
    Convert external tag vote/count data into a confidence score.

    MusicBrainz tag counts are community-based signals. They are useful, but
    not as strong as manual user tags.
    """
    if count is None:
        return 0.65

    if count >= 20:
        return 0.80

    if count >= 10:
        return 0.75

    if count >= 3:
        return 0.70

    return 0.65


def ensure_tag_exists(db: Session, tag_name: str) -> Tag | None:
    """
    Ensure an internal tag exists before attaching it to a track.

    Only tags that exist in TAG_RULES are allowed. This keeps the app's tag
    vocabulary controlled and predictable.
    """
    existing_tag = get_tag_by_name(db, tag_name)
    tag = ensure_controlled_tag_exists(db, tag_name)

    if not tag:
        logger.warning(
            "Skipping unknown internal tag",
            extra={"tag_name": tag_name},
        )
        return None

    if not existing_tag:
        logger.info(
            "Created missing internal tag",
            extra={"tag_name": tag.name, "category": tag.category},
        )

    return tag


def apply_external_tag(
    db: Session,
    track: Track,
    tag_name: str,
    source: str,
    confidence: float,
) -> TrackTag | None:
    """
    Attach an external tag to a track.

    Rules:
    - Never overwrite manual user tags.
    - Keep the highest confidence score.
    - Prefer stronger sources over weaker ones.
    """
    if track.id is None:
        db.add(track)
        db.flush()

    tag = ensure_tag_exists(db, tag_name)

    if not tag:
        return None

    existing = (
        db.query(TrackTag)
        .filter(
            TrackTag.track_id == track.id,
            TrackTag.tag_id == tag.id,
        )
        .first()
    )

    if existing:
        if existing.source == "manual":
            logger.info(
                "Preserved manual tag during external enrichment",
                extra={
                    "track_id": track.id,
                    "tag_name": tag.name,
                    "incoming_source": source,
                },
            )
            return existing

        existing.confidence = max(existing.confidence, confidence)

        existing_priority = SOURCE_PRIORITY.get(existing.source, 0)
        incoming_priority = SOURCE_PRIORITY.get(source, 0)

        if incoming_priority >= existing_priority:
            existing.source = source

        logger.info(
            "Updated existing track tag from external provider",
            extra={
                "track_id": track.id,
                "tag_name": tag.name,
                "source": existing.source,
                "confidence": existing.confidence,
            },
        )

        return existing

    track_tag = TrackTag(
        track_id=track.id,
        tag_id=tag.id,
        source=source,
        confidence=confidence,
    )

    db.add(track_tag)
    db.flush()

    logger.info(
        "Applied new external tag",
        extra={
            "track_id": track.id,
            "tag_name": tag.name,
            "source": source,
            "confidence": confidence,
        },
    )

    return track_tag


def extract_candidate_tags(recording: dict) -> list[tuple[str, float]]:
    """
    Extract useful internal tags from a MusicBrainz recording payload.

    MusicBrainz can return both:
    - genre-list
    - tag-list

    We map both to internal tags and keep the strongest confidence when the
    same tag appears multiple times.
    """
    candidates: list[tuple[str, float]] = []

    for genre in recording.get("genre-list", []):
        raw_name = genre.get("name")
        if not raw_name:
            continue

        mapped_name = map_external_tag(raw_name)
        if not mapped_name:
            continue

        candidates.append(
            (mapped_name, confidence_from_count(genre.get("count")))
        )

    for tag in recording.get("tag-list", []):
        raw_name = tag.get("name")
        if not raw_name:
            continue

        mapped_name = map_external_tag(raw_name)
        if not mapped_name:
            continue

        candidates.append(
            (mapped_name, confidence_from_count(tag.get("count")))
        )

    merged: dict[str, float] = {}

    for tag_name, confidence in candidates:
        merged[tag_name] = max(merged.get(tag_name, 0), confidence)

    return list(merged.items())
