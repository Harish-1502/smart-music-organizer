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
