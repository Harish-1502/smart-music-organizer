from __future__ import annotations

from pathlib import Path
from typing import Iterable

from fastapi import UploadFile


SUPPORTED_AUDIO_EXTENSIONS = {".mp3", ".flac", ".wav", ".m4a", ".aac", ".ogg"}
SUPPORTED_ARTWORK_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


class PathSecurityError(ValueError):
    """Raised when a path would escape an allowed filesystem boundary."""

# This method prevents directory traversal attacks by checking for parent directory references in the path.
def has_parent_directory_reference(path: str | Path) -> bool:
    return ".." in Path(path).parts


# This method resolves the path to an absolute path, ensuring that it does not contain any parent directory references. It raises a PathSecurityError if parent directory references are found or if the path cannot be resolved.
def safe_resolve_path(path: str | Path, *, reject_parent_refs: bool = True) -> Path:
    if reject_parent_refs and has_parent_directory_reference(path):
        raise PathSecurityError("Parent directory references are not allowed.")

    try:
        return Path(path).expanduser().resolve()
    except RuntimeError as exc:
        raise PathSecurityError("Path could not be resolved.") from exc

# This method checks if the resolved path is the same as the root or is a subdirectory of the root. It returns True if the path is within the directory, and False otherwise.
def is_within_directory(path: str | Path, root: str | Path) -> bool:
    resolved_path = safe_resolve_path(path, reject_parent_refs=False)
    resolved_root = safe_resolve_path(root, reject_parent_refs=False)

    return resolved_path == resolved_root or resolved_root in resolved_path.parents

# If multiple allowed roots are provided, this method check if the path is withing any of the allowed roots. It returns True if the path is within any of the directories, and False otherwise.
def is_within_any_directory(path: str | Path, roots: Iterable[str | Path]) -> bool:
    return any(is_within_directory(path, root) for root in roots)


def is_supported_audio_file(path: str | Path) -> bool:
    return Path(path).suffix.lower() in SUPPORTED_AUDIO_EXTENSIONS


def is_supported_artwork_file(path: str | Path) -> bool:
    return Path(path).suffix.lower() in SUPPORTED_ARTWORK_EXTENSIONS

# This method validates that the provided path is an existing directory and is within the allowed scan roots.
def validate_scan_root(path: str | Path, allowed_roots: Iterable[str | Path]) -> Path:
    resolved_path = safe_resolve_path(path)

    if not resolved_path.exists():
        raise ValueError("Folder does not exist.")

    if not resolved_path.is_dir():
        raise ValueError("Provided path is not a folder.")

    allowed_roots = list(allowed_roots)
    if allowed_roots and not is_within_any_directory(resolved_path, allowed_roots):
        raise PathSecurityError("Scan folder is outside the allowed scan roots.")

    return resolved_path

# This method validates that the provided path is an existing file, is within the allowed managed roots and it checks if the files has a supported artwork.
def validate_managed_file_path(
    path: str | Path,
    managed_roots: Iterable[str | Path],
    *,
    require_supported_artwork: bool = False,
) -> Path:
    resolved_path = safe_resolve_path(path)

    if not resolved_path.exists() or not resolved_path.is_file():
        raise FileNotFoundError("File not found.")

    if require_supported_artwork and not is_supported_artwork_file(resolved_path):
        raise PathSecurityError("Unsupported artwork file extension.")

    if not is_within_any_directory(resolved_path, managed_roots):
        raise PathSecurityError("File is outside managed directories.")

    return resolved_path

# This method validates the uploaded file's size against the specified maximum upload size. 
def validate_upload_size(file: UploadFile, upload_max_bytes: int | None) -> None:
    if upload_max_bytes is None:
        return

    current_position = file.file.tell()
    file.file.seek(0, 2)
    size = file.file.tell()
    file.file.seek(current_position)

    if size > upload_max_bytes:
        raise ValueError("Uploaded file is too large.")
