"""
Thin wrapper around MusicBrainz.

This file does not save anything to the database. It only talks to the
external API and returns normalized Python dictionaries/IDs.
"""

import logging
import time

import musicbrainzngs

from app.models.track import Track
from app.services.external_tag_utils import get_track_identity

logger = logging.getLogger(__name__)

MUSICBRAINZ_USER_AGENT_APP = "SmartMusicOrganizer"
MUSICBRAINZ_USER_AGENT_VERSION = "0.1"
MUSICBRAINZ_USER_AGENT_CONTACT = "https://github.com/Harish-1502"

REQUEST_DELAY_SECONDS = 1.1


class MusicBrainzLookupError(Exception):
    """Raised when a MusicBrainz lookup fails unexpectedly."""


musicbrainzngs.set_useragent(
    MUSICBRAINZ_USER_AGENT_APP,
    MUSICBRAINZ_USER_AGENT_VERSION,
    MUSICBRAINZ_USER_AGENT_CONTACT,
)


def _respect_rate_limit() -> None:
    """
    Keep requests slow enough for MusicBrainz public API usage.
    """
    time.sleep(REQUEST_DELAY_SECONDS)


def find_recording_id_by_text(track: Track) -> str | None:
    """
    Search MusicBrainz using title/artist/album metadata.

    Returns a MusicBrainz recording ID if a candidate is found.
    Returns None if no candidate is found.
    """
    title, artist, album = get_track_identity(track)

    if not title or not artist:
        logger.info(
            "Skipping MusicBrainz text search because identity is incomplete",
            extra={"track_id": track.id, "title": title, "artist": artist},
        )
        return None

    query_parts = [
        f'recording:"{title}"',
        f'artist:"{artist}"',
    ]

    if album:
        query_parts.append(f'release:"{album}"')

    query = " AND ".join(query_parts)

    logger.info(
        "Searching MusicBrainz by text",
        extra={
            "track_id": track.id,
            "title": title,
            "artist": artist,
            "album": album,
        },
    )

    try:
        _respect_rate_limit()

        result = musicbrainzngs.search_recordings(
            query=query,
            limit=1,
            strict=False,
        )

    except Exception as error:
        logger.exception(
            "MusicBrainz text search failed",
            extra={"track_id": track.id},
        )
        raise MusicBrainzLookupError(str(error)) from error

    recordings = result.get("recording-list", [])

    if not recordings:
        logger.info(
            "MusicBrainz text search returned no recordings",
            extra={"track_id": track.id},
        )
        return None

    recording_id = recordings[0].get("id")

    logger.info(
        "MusicBrainz text search found recording",
        extra={"track_id": track.id, "recording_id": recording_id},
    )

    return recording_id


def fetch_recording_details(recording_id: str) -> dict:
    """
    Fetch MusicBrainz recording details with tags and genres included.
    """
    logger.info(
        "Fetching MusicBrainz recording details",
        extra={"recording_id": recording_id},
    )

    try:
        _respect_rate_limit()

        result = musicbrainzngs.get_recording_by_id(
            recording_id,
            includes=["tags", "genres", "artists", "releases"],
        )

    except Exception as error:
        logger.exception(
            "MusicBrainz recording detail fetch failed",
            extra={"recording_id": recording_id},
        )
        raise MusicBrainzLookupError(str(error)) from error

    return result.get("recording", {})