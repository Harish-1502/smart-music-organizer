from collections.abc import Callable, Iterator
import logging
import os
from pathlib import Path

from app.core.path_guard import (
    PathSecurityError,
    is_supported_audio_file,
    is_within_any_directory,
    is_within_directory,
    safe_resolve_path,
)

logger = logging.getLogger(__name__)


def discover_audio_files(
    root: Path | str,
    on_file_seen: Callable[[Path], None] | None = None,
    allowed_roots: list[Path] | None = None,
) -> Iterator[Path]:
    """
    Walk a scan root and yield supported audio files.

    The optional callback is called for every regular file, including
    unsupported files, so scanner progress counters keep their current meaning.
    """
    root_path = safe_resolve_path(root, reject_parent_refs=False)
    allowed_roots = allowed_roots or []

    def handle_walk_error(error: OSError) -> None:
        logger.warning("Skipping inaccessible scan path: %s", error)

    def path_is_allowed(path: Path) -> bool:
        if not is_within_directory(path, root_path):
            return False

        if allowed_roots and not is_within_any_directory(path, allowed_roots):
            return False

        return True

    for current_root, dir_names, file_names in os.walk(
        root_path,
        topdown=True,
        onerror=handle_walk_error,
        followlinks=False,
    ):
        current_path = Path(current_root)
        allowed_dir_names = []

        for dir_name in dir_names:
            dir_path = current_path / dir_name

            try:
                if dir_path.is_symlink():
                    continue

                resolved_dir = safe_resolve_path(
                    dir_path,
                    reject_parent_refs=False,
                )

                if path_is_allowed(resolved_dir):
                    allowed_dir_names.append(dir_name)
            except (OSError, RuntimeError, PathSecurityError) as error:
                logger.warning("Skipping inaccessible scan directory: %s", error)

        dir_names[:] = allowed_dir_names

        for file_name in file_names:
            path = current_path / file_name

            try:
                if path.is_symlink() or not path.is_file():
                    continue

                resolved_path = safe_resolve_path(
                    path,
                    reject_parent_refs=False,
                )

                if not path_is_allowed(resolved_path):
                    continue
            except (OSError, RuntimeError, PathSecurityError) as error:
                logger.warning("Skipping inaccessible scan file: %s", error)
                continue

            if on_file_seen:
                on_file_seen(resolved_path)

            if not is_supported_audio_file(resolved_path):
                continue

            yield resolved_path
