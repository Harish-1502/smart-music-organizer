from pathlib import Path
from typing import Any

from app.services.art import detect_album_art
from app.services.metadata import extract_metadata


UNKNOWN_METADATA = {
    "title": None,
    "artist": None,
    "album": None,
    "duration": None,
    "metadata_source": "unknown",
}


def load_track_metadata_and_art(
    path: Path | str,
) -> tuple[dict[str, Any], str | None, Exception | None]:
    metadata = UNKNOWN_METADATA.copy()
    art_path = None

    try:
        metadata = extract_metadata(path)
        art_path = detect_album_art(path)
    except Exception as error:
        return UNKNOWN_METADATA.copy(), None, error

    return metadata, art_path, None
