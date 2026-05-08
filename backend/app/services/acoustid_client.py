"""
Thin wrapper around AcoustID.

This file only handles fingerprinting and AcoustID lookup. It does not decide
which tags to save. That decision belongs in deep_scan.py.
"""

import logging
import os

import acoustid

from app.models.track import Track

logger = logging.getLogger(__name__)

MIN_ACOUSTID_SCORE = 0.75


class AcoustIDLookupError(Exception):
    """Raised when AcoustID fingerprinting or lookup fails unexpectedly."""


def find_recording_id_by_fingerprint(track: Track) -> tuple[str | None, dict | None]:
    """
    Identify a track using AcoustID fingerprinting.

    Returns:
        (musicbrainz_recording_id, acoustid_recording_payload)

    Returns:
        (None, None) when no confident match is found.
    """
    api_key = os.getenv("ACOUSTID_API_KEY")

    if not api_key:
        raise AcoustIDLookupError("Missing ACOUSTID_API_KEY in environment")

    if not track.file_path:
        logger.info(
            "Skipping AcoustID lookup because track has no file_path",
            extra={"track_id": track.id},
        )
        return None, None

    logger.info(
        "Generating AcoustID fingerprint",
        extra={"track_id": track.id, "file_path": track.file_path},
    )

    try:
        duration, fingerprint = acoustid.fingerprint_file(track.file_path)

        logger.info(
            "Looking up AcoustID fingerprint",
            extra={
                "track_id": track.id,
                "duration": duration,
                "fingerprint_length": len(fingerprint),
            },
        )

        result = acoustid.lookup(
            apikey=api_key,
            fingerprint=fingerprint,
            duration=duration,
            meta="recordings releasegroups compress",
        )

    except acoustid.FingerprintGenerationError as error:
        logger.exception(
            "AcoustID fingerprint generation failed. fpcalc may be missing.",
            extra={"track_id": track.id, "file_path": track.file_path},
        )
        raise AcoustIDLookupError(
            "Fingerprint generation failed. Make sure fpcalc is installed and on PATH."
        ) from error

    except Exception as error:
        logger.exception(
            "AcoustID lookup failed",
            extra={"track_id": track.id, "file_path": track.file_path},
        )
        raise AcoustIDLookupError(str(error)) from error

    best_score = 0.0
    best_recording_id = None
    best_recording = None

    for item in result.get("results", []):
        score = float(item.get("score", 0))

        if score < best_score:
            continue

        recordings = item.get("recordings", [])

        if not recordings:
            continue

        recording = recordings[0]
        recording_id = recording.get("id")

        if not recording_id:
            continue

        best_score = score
        best_recording_id = recording_id
        best_recording = recording

    if best_score < MIN_ACOUSTID_SCORE:
        logger.info(
            "AcoustID did not find a confident match",
            extra={
                "track_id": track.id,
                "best_score": best_score,
                "min_score": MIN_ACOUSTID_SCORE,
            },
        )
        return None, None

    logger.info(
        "AcoustID found a confident match",
        extra={
            "track_id": track.id,
            "recording_id": best_recording_id,
            "score": best_score,
        },
    )

    return best_recording_id, best_recording