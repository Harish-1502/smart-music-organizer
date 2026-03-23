from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from mutagen import File as MutagenFile

UNKNOWN_VALUES = {
    "",
    "unknown",
    "untitled",
    "none",
    "null",
    "n/a",
}

def clean_value(value: Any) -> str | None:
    """
    Normalize metadata values from tags or path parsing.

    Returns:
        Cleaned string or None if unusable.
    """

    if value is None:
        return None
    
    if isinstance(value, (list,tuple)):
        if not value:
            return None
        value = value[0]
    
    text = str(value).strip()

    if not text or text.lower() in UNKNOWN_VALUES:
        return None
    
    # Collapse repeated whitespace
    text = re.sub(r"\s+", " ", text).strip()

    return text or None

def _safe_float(value: Any) -> float | None:
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None

def _extract_first_tag(tags: Any, keys: list[str]) -> str | None:
    """
    Try multiple tag keys because formats differ by codec/container.

    Examples:
    - MP3/ID3: TIT2, TPE1, TALB
    - MP4/M4A: ©nam, ©ART, ©alb
    - FLAC/Vorbis: title, artist, album
    """

    if not tags:
        return None
    
    for key in keys:
        if key not in tags:
            continue

        raw_value = tags.get(key)

        # Mutagen ID3 frames often store text in .text
        if hasattr(raw_value, "text"):
            text_value = getattr(raw_value, "text", None)
            cleaned = clean_value(text_value)
            if cleaned:
                return cleaned

        cleaned = clean_value(raw_value)
        if cleaned:
            return cleaned
        
    return None

def extract_tag_metadata(file_path: Path) -> dict[str, str | float | None]:
    """
    Read metadata directly from the audio file using Mutagen.

    Returns:
        {
            "title": str | None,
            "artist": str | None,
            "album": str | None,
            "duration": float | None,
        }
    """
    try:
        audio = MutagenFile(file_path)
    except Exception:
        return {
            "title": None,
            "artist": None,
            "album": None,
            "duration": None,
        }

    if audio is None:
        return {
            "title": None,
            "artist": None,
            "album": None,
            "duration": None,
        }

    tags = getattr(audio, "tags", None)
    info = getattr(audio, "info", None)
    duration = _safe_float(getattr(info, "length", None))

    title = _extract_first_tag(tags, ["TIT2", "title", "TITLE", "\xa9nam"])
    artist = _extract_first_tag(tags, ["TPE1", "artist", "ARTIST", "\xa9ART"])
    album = _extract_first_tag(tags, ["TALB", "album", "ALBUM", "\xa9alb"])

    return {
        "title": title,
        "artist": artist,
        "album": album,
        "duration": duration,
    }


def _strip_leading_track_number(text: str) -> str:
    """
    Remove prefixes like:
    - 01 - Song
    - 01. Song
    - 01_Song
    - 1 Song
    """
    cleaned = re.sub(r"^\s*\d{1,3}\s*[-._ ]+\s*", "", text).strip()
    return cleaned

def _cleanup_title_from_stem(stem: str) -> str | None:
    """
    1) Replaces _ with spaces,
    2) Get rid of leading number
    3) Collapses spaces
    """
    text = stem.replace("_", " ").strip()
    text = _strip_leading_track_number(text)
    text = re.sub(r"\s+", " ", text).strip()
    return clean_value(text)

def infer_metadata_from_path(file_path: Path) -> dict[str, str | None]:
    """
    Infer metadata from the file path.

    Supported heuristics:
    - 'Artist - Title.mp3'
    - '/Artist/Album/Track.mp3'
    - '01 - Song.mp3'
    """
    stem = file_path.stem
    parent = file_path.parent

    title: str | None = None
    artist: str | None = None
    album: str | None = None

    normalized_stem = stem.replace("_", " ").strip()

    # Pattern: Artist - Title
    if " - " in normalized_stem:
        left, right = normalized_stem.split(" - ", 1)
        possible_artist = clean_value(left)
        possible_title = clean_value(_strip_leading_track_number(right))

        # Only accept if both sides look usable
        if possible_artist and possible_title:
            artist = possible_artist
            title = possible_title

    # Folder guess: /Artist/Album/file
    if parent.name:
        album = clean_value(parent.name)

    if parent.parent and parent.parent.name and not artist:
        artist = clean_value(parent.parent.name)

    # If title still missing, use filename stem cleanup
    if not title:
        title = _cleanup_title_from_stem(stem)

    return {
        "title": title,
        "artist": artist,
        "album": album,
    }


def extract_metadata(file_path: str | Path) -> dict[str, str | float | None]:
    path = Path(file_path)

    tag_meta = extract_tag_metadata(path)
    path_meta = infer_metadata_from_path(path)

    title = tag_meta["title"] or path_meta["title"]
    artist = tag_meta["artist"] or path_meta["artist"]
    album = tag_meta["album"] or path_meta["album"]
    duration = tag_meta["duration"]

    tag_used = any([tag_meta["title"], tag_meta["artist"], tag_meta["album"]])
    path_used = any([
        (not tag_meta["title"] and path_meta["title"]),
        (not tag_meta["artist"] and path_meta["artist"]),
        (not tag_meta["album"] and path_meta["album"]),
    ])

    if tag_used and path_used:
        metadata_source = "mixed"
    elif tag_used:
        metadata_source = "tag"
    elif any([path_meta["title"], path_meta["artist"], path_meta["album"]]):
        metadata_source = "path"
    else:
        metadata_source = "unknown"

    return {
        "title": title,
        "artist": artist,
        "album": album,
        "duration": duration,
        "metadata_source": metadata_source,
    }