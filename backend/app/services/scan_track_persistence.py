from pathlib import Path
from typing import Any

from app.models.track import Track


def update_if_changed(obj, field_name, new_value):
    if getattr(obj, field_name) != new_value:
        setattr(obj, field_name, new_value)
        return True
    return False


def build_scanned_track(
    resolved_path: Path,
    normalized_file_path: str,
    normalized_folder_path: str,
    metadata: dict[str, Any],
    art_path: str | None,
) -> Track:
    scanned_artist = metadata["artist"]
    scanned_album = metadata["album"]
    scanned_title = metadata["title"]

    return Track(
        file_path=normalized_file_path,
        file_name=resolved_path.name,
        extension=resolved_path.suffix.lower(),
        folder_path=normalized_folder_path,

        title=scanned_title,
        artist=scanned_artist,
        album=scanned_album,

        scanned_title=scanned_title,
        scanned_artist=scanned_artist,
        scanned_album=scanned_album,

        display_title=scanned_title,
        display_artist=scanned_artist,
        display_album=scanned_album,

        duration=metadata.get("duration"),
        metadata_source=metadata.get("metadata_source", "unknown"),
        art_path=art_path,

        user_edited=False,
    )


def apply_scanned_track_update(
    track: Track,
    resolved_path: Path,
    normalized_folder_path: str,
    metadata: dict[str, Any],
    art_path: str | None,
) -> bool:
    scanned_artist = metadata["artist"]
    scanned_album = metadata["album"]
    scanned_title = metadata["title"]

    changed = False

    changed |= update_if_changed(track, "file_name", resolved_path.name)
    changed |= update_if_changed(track, "extension", resolved_path.suffix.lower())
    changed |= update_if_changed(track, "folder_path", normalized_folder_path)

    changed |= update_if_changed(track, "scanned_title", scanned_title)
    changed |= update_if_changed(track, "scanned_artist", scanned_artist)
    changed |= update_if_changed(track, "scanned_album", scanned_album)

    changed |= update_if_changed(track, "duration", metadata.get("duration"))
    changed |= update_if_changed(track, "metadata_source", metadata.get("metadata_source", "unknown"))
    changed |= update_if_changed(track, "art_path", art_path)

    if not track.user_edited:
        if track.title != scanned_title:
            track.title = scanned_title
            changed = True
        if track.artist != scanned_artist:
            track.artist = scanned_artist
            changed = True
        if track.album != scanned_album:
            track.album = scanned_album
            changed = True

        if track.display_title != scanned_title:
            track.display_title = scanned_title
            changed = True
        if track.display_artist != scanned_artist:
            track.display_artist = scanned_artist
            changed = True
        if track.display_album != scanned_album:
            track.display_album = scanned_album
            changed = True

    return changed
