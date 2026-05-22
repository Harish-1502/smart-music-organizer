from pathlib import Path

import pytest

from app.core.path_guard import (
    PathSecurityError,
    is_supported_artwork_file,
    is_supported_audio_file,
    is_within_directory,
    safe_resolve_path,
    validate_scan_root,
)


def test_safe_resolve_path_rejects_parent_directory_reference(tmp_path):
    with pytest.raises(PathSecurityError):
        safe_resolve_path(tmp_path / "nested" / ".." / "secret.txt")


def test_is_within_directory_accepts_child_path(tmp_path):
    root = tmp_path / "root"
    child = root / "nested" / "file.txt"
    child.parent.mkdir(parents=True)
    child.write_text("content")

    assert is_within_directory(child, root) is True


def test_is_within_directory_rejects_sibling_path(tmp_path):
    root = tmp_path / "root"
    sibling = tmp_path / "sibling" / "file.txt"
    root.mkdir()
    sibling.parent.mkdir()
    sibling.write_text("content")

    assert is_within_directory(sibling, root) is False


def test_validate_scan_root_allows_any_existing_folder_when_no_roots_configured(
    tmp_path,
):
    root = tmp_path / "Music"
    root.mkdir()

    assert validate_scan_root(root, []) == root.resolve()


def test_validate_scan_root_rejects_folder_outside_allowed_roots(tmp_path):
    allowed_root = tmp_path / "Allowed"
    blocked_root = tmp_path / "Blocked"
    allowed_root.mkdir()
    blocked_root.mkdir()

    with pytest.raises(PathSecurityError):
        validate_scan_root(blocked_root, [allowed_root])


def test_supported_extension_helpers_match_current_media_rules():
    assert is_supported_audio_file(Path("song.mp3")) is True
    assert is_supported_audio_file(Path("notes.txt")) is False
    assert is_supported_artwork_file(Path("cover.jpg")) is True
    assert is_supported_artwork_file(Path("cover.gif")) is False
