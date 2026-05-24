import pytest

from app.services import scan_file_discovery
from app.services.scan_file_discovery import discover_audio_files


def test_discover_audio_files_finds_supported_audio_files(tmp_path):
    audio_file = tmp_path / "song.mp3"
    audio_file.write_bytes(b"fake audio")

    discovered = list(discover_audio_files(tmp_path))

    assert set(discovered) == {audio_file}


def test_discover_audio_files_ignores_unsupported_files(tmp_path):
    audio_file = tmp_path / "song.flac"
    text_file = tmp_path / "notes.txt"
    audio_file.write_bytes(b"fake audio")
    text_file.write_text("not audio")

    discovered = list(discover_audio_files(tmp_path))

    assert set(discovered) == {audio_file}


def test_discover_audio_files_finds_nested_audio_files(tmp_path):
    nested = tmp_path / "Nested"
    nested.mkdir()
    audio_file = nested / "song.m4a"
    audio_file.write_bytes(b"fake audio")

    discovered = list(discover_audio_files(tmp_path))

    assert discovered == [audio_file]


def test_discover_audio_files_handles_empty_folders(tmp_path):
    discovered = list(discover_audio_files(tmp_path))

    assert discovered == []


def test_discover_audio_files_reports_unsupported_regular_files_as_seen(tmp_path):
    audio_file = tmp_path / "song.mp3"
    text_file = tmp_path / "notes.txt"
    folder = tmp_path / "Folder"
    audio_file.write_bytes(b"fake audio")
    text_file.write_text("not audio")
    folder.mkdir()

    seen_files = []

    discovered = list(
        discover_audio_files(
            tmp_path,
            on_file_seen=seen_files.append,
        )
    )

    assert set(discovered) == {audio_file}
    assert set(seen_files) == {audio_file, text_file}


def test_discover_audio_files_skips_symlinked_audio_outside_root(tmp_path):
    root = tmp_path / "Music"
    outside = tmp_path / "Outside"
    root.mkdir()
    outside.mkdir()

    normal_audio = root / "inside.mp3"
    outside_audio = outside / "outside.mp3"
    symlink_audio = root / "linked-outside.mp3"
    normal_audio.write_bytes(b"inside")
    outside_audio.write_bytes(b"outside")

    try:
        symlink_audio.symlink_to(outside_audio)
    except (OSError, NotImplementedError) as error:
        pytest.skip(f"Symlinks are not available in this environment: {error}")

    discovered = list(discover_audio_files(root))

    assert discovered == [normal_audio.resolve()]


def test_discover_audio_files_skips_bad_file_path_without_crashing(
    tmp_path,
    monkeypatch,
):
    audio_file = tmp_path / "bad.mp3"
    audio_file.write_bytes(b"fake audio")
    original_safe_resolve_path = scan_file_discovery.safe_resolve_path

    def fake_safe_resolve_path(path, *, reject_parent_refs=True):
        if str(path).endswith("bad.mp3"):
            raise OSError("simulated file access error")

        return original_safe_resolve_path(
            path,
            reject_parent_refs=reject_parent_refs,
        )

    monkeypatch.setattr(
        scan_file_discovery,
        "safe_resolve_path",
        fake_safe_resolve_path,
    )

    discovered = list(discover_audio_files(tmp_path))

    assert discovered == []
