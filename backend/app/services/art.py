from __future__ import annotations

from pathlib import Path

ARTWORK_FILENAMES = (
    "cover.jpg",
    "folder.jpg",
    "cover.png",
    "folder.png",
)


def detect_album_art(file_path: str | Path) -> str | None:
    """
    Look for common local album art files in the same directory
    as the audio file.

    Returns:
        Absolute or relative path string to the first match, or None.
    """
    path = Path(file_path)
    folder = path.parent

    for filename in ARTWORK_FILENAMES:
        candidate = folder / filename
        if candidate.exists() and candidate.is_file():
            return str(candidate)

    return None