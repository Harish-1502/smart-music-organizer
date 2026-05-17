# app/services/deep_scan.py

"""
Deep scan orchestration.

This service coordinates:
1. MusicBrainz text search
2. AcoustID fingerprint fallback
3. MusicBrainz tag/genre fetching
4. Saving mapped tags to the database

This file owns the workflow. Provider-specific code stays in the client files.
"""

import logging
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models.track import Track
from app.models.track_tag import TrackTag
from app.services.acoustid_client import (
    AcoustIDLookupError,
    find_recording_id_by_fingerprint,
)
from app.services.external_tag_utils import (
    apply_external_tag,
    extract_candidate_tags,
    has_usable_identity,
)
from app.services.musicbrainz_client import (
    MusicBrainzLookupError,
    fetch_recording_details,
    find_recording_id_by_text,
)

logger = logging.getLogger(__name__)

MUSICBRAINZ_SOURCE = "musicbrainz"
ACOUSTID_SOURCE = "acoustid"


@dataclass
class DeepScanResult:
    """
    Structured result object for a deep scan.

    This is easier to maintain than returning loose dictionaries everywhere.
    """
    track_id: int
    method_used: str | None
    musicbrainz_recording_id: str | None
    applied_tags: list[TrackTag]
    warnings: list[str]


def apply_metadata_from_acoustid_match(track: Track, acoustid_recording: dict | None) -> None:
    """
    Optionally fill missing metadata using AcoustID/MusicBrainz match data.

    We only fill missing fields. We do not overwrite user-visible metadata that
    already exists, because the user may have corrected it manually.
    """
    if not acoustid_recording:
        return

    title = acoustid_recording.get("title")
    artists = acoustid_recording.get("artists", [])
    artist_name = artists[0].get("name") if artists else None

    if title and not track.display_title:
        track.scanned_title = title
        track.display_title = title
        track.title = title

    if artist_name and not track.display_artist:
        track.scanned_artist = artist_name
        track.display_artist = artist_name
        track.artist = artist_name


def apply_recording_tags(
    db: Session,
    track: Track,
    recording_id: str,
    source: str,
) -> list[TrackTag]:
    """
    Fetch MusicBrainz tags/genres for a recording and attach mapped tags.

    This function is shared by both:
    - MusicBrainz text search
    - AcoustID fingerprint lookup

    Both paths eventually give us a MusicBrainz recording ID.
    """
    details = fetch_recording_details(recording_id)
    candidate_tags = extract_candidate_tags(details)

    logger.info(
        "Extracted candidate tags from recording",
        extra={
            "track_id": track.id,
            "recording_id": recording_id,
            "candidate_count": len(candidate_tags),
            "source": source,
        },
    )

    applied: list[TrackTag] = []

    for tag_name, confidence in candidate_tags:
        track_tag = apply_external_tag(
            db=db,
            track=track,
            tag_name=tag_name,
            source=source,
            confidence=confidence,
        )

        if track_tag:
            applied.append(track_tag)

    return applied


def try_musicbrainz_text_path(db: Session, track: Track) -> tuple[str | None, list[TrackTag]]:
    """
    Try the fast text-based MusicBrainz path.

    This should only be used when title + artist are usable.
    """
    recording_id = find_recording_id_by_text(track)

    if not recording_id:
        return None, []

    applied_tags = apply_recording_tags(
        db=db,
        track=track,
        recording_id=recording_id,
        source=MUSICBRAINZ_SOURCE,
    )

    return recording_id, applied_tags


def try_acoustid_fallback_path(
    db: Session,
    track: Track,
) -> tuple[str | None, list[TrackTag], dict | None]:
    """
    Try AcoustID fingerprinting fallback.

    This is slower than text search, so it should only run when:
    - metadata is missing/weak, or
    - MusicBrainz text search found no useful tags.
    """
    recording_id, acoustid_recording = find_recording_id_by_fingerprint(track)

    if not recording_id:
        return None, [], None

    applied_tags = apply_recording_tags(
        db=db,
        track=track,
        recording_id=recording_id,
        source=ACOUSTID_SOURCE,
    )

    return recording_id, applied_tags, acoustid_recording


def deep_scan_track(db: Session, track: Track) -> DeepScanResult:
    """
    Deep scan a single track.

    Strategy:
    1. If title/artist look usable, try MusicBrainz text search.
    2. If that returns no useful tags, fall back to AcoustID fingerprinting.
    3. Preserve manual tags and only add/update external tags.

    This function does not commit. The route or caller controls the transaction.
    """
    if track.id is None:
        db.add(track)
        db.flush()

    logger.info(
        "Starting deep scan",
        extra={
            "track_id": track.id,
            "title": track.display_title or track.title,
            "artist": track.display_artist or track.artist,
        },
    )

    warnings: list[str] = []
    method_used = None
    recording_id = None
    applied_tags: list[TrackTag] = []

    if has_usable_identity(track):
        try:
            text_recording_id, text_tags = try_musicbrainz_text_path(db, track)

            if text_recording_id and text_tags:
                recording_id = text_recording_id
                applied_tags = text_tags
                method_used = "musicbrainz_text"

                logger.info(
                    "Deep scan succeeded using MusicBrainz text path",
                    extra={
                        "track_id": track.id,
                        "recording_id": recording_id,
                        "applied_tag_count": len(applied_tags),
                    },
                )

        except MusicBrainzLookupError as error:
            warning = f"MusicBrainz text lookup failed: {error}"
            warnings.append(warning)

            logger.warning(
                warning,
                extra={"track_id": track.id},
            )

    else:
        logger.info(
            "Skipping MusicBrainz text path because track identity is weak",
            extra={"track_id": track.id},
        )

    if not applied_tags:
        try:
            acoustid_recording_id, acoustid_tags, acoustid_recording = (
                try_acoustid_fallback_path(db, track)
            )

            if acoustid_recording_id and acoustid_tags:
                recording_id = acoustid_recording_id
                applied_tags = acoustid_tags
                method_used = "acoustid_fingerprint"

                apply_metadata_from_acoustid_match(track, acoustid_recording)

                logger.info(
                    "Deep scan succeeded using AcoustID fallback path",
                    extra={
                        "track_id": track.id,
                        "recording_id": recording_id,
                        "applied_tag_count": len(applied_tags),
                    },
                )

        except AcoustIDLookupError as error:
            warning = f"AcoustID lookup failed: {error}"
            warnings.append(warning)

            logger.warning(
                warning,
                extra={"track_id": track.id},
            )

        except MusicBrainzLookupError as error:
            warning = f"MusicBrainz lookup after AcoustID failed: {error}"
            warnings.append(warning)

            logger.warning(
                warning,
                extra={"track_id": track.id},
            )

    if not applied_tags:
        logger.info(
            "Deep scan completed with no applied tags",
            extra={"track_id": track.id, "warnings": warnings},
        )

    return DeepScanResult(
        track_id=track.id,
        method_used=method_used,
        musicbrainz_recording_id=recording_id,
        applied_tags=applied_tags,
        warnings=warnings,
    )