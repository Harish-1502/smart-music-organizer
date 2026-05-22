from collections.abc import Callable, Iterator
from pathlib import Path

from app.core.path_guard import is_supported_audio_file


def discover_audio_files(
    root: Path | str,
    on_file_seen: Callable[[Path], None] | None = None,
) -> Iterator[Path]:
    """
    Walk a scan root and yield supported audio files.

    The optional callback is called for every regular file, including
    unsupported files, so scanner progress counters keep their current meaning.
    """
    root_path = Path(root)

    for path in root_path.rglob("*"):
        if not path.is_file():
            continue

        if on_file_seen:
            on_file_seen(path)

        if not is_supported_audio_file(path):
            continue

        yield path
