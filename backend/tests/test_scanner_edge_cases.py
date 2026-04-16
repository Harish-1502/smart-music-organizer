from app.models.track import Track
from app.services.scanner import scan_library, reset_scan_state


def test_scan_skips_unsupported_files_and_scans_nested_audio(tmp_path, monkeypatch, db_session):
    """
    Test:
    - Folder contains supported and unsupported files
    - Supported file is inside nested subfolder

    Expected result:
    - only supported audio file is inserted
    """
    reset_scan_state()

    root = tmp_path / "Music"
    root.mkdir()

    nested = root / "Nested"
    nested.mkdir()

    (root / "notes.txt").write_text("not audio")
    audio_file = nested / "song.mp3"
    audio_file.write_bytes(b"fake audio")

    def fake_extract_metadata(_path):
        return {
            "title": "Nested Song",
            "artist": "Nested Artist",
            "album": "Nested Album",
            "duration": 111,
            "metadata_source": "tag",
        }

    def fake_detect_album_art(_path):
        return None

    monkeypatch.setattr("app.services.scanner.extract_metadata", fake_extract_metadata)
    monkeypatch.setattr("app.services.scanner.detect_album_art", fake_detect_album_art)

    scan_library(str(root), db_session)

    tracks = db_session.query(Track).all()
    assert len(tracks) == 1
    assert tracks[0].file_path == str(audio_file.resolve())


def test_scan_continues_when_metadata_extraction_fails(tmp_path, monkeypatch, db_session):
    """
    Test:
    - metadata extraction raises an exception

    Expected result:
    - scan does not crash
    - track still gets inserted with fallback metadata
    - scan_state.last_error is set
    """
    from app.services.scanner import scan_state

    reset_scan_state()

    root = tmp_path / "Music"
    root.mkdir()

    audio_file = root / "broken.mp3"
    audio_file.write_bytes(b"fake audio")

    def fake_extract_metadata(_path):
        raise RuntimeError("metadata boom")

    def fake_detect_album_art(_path):
        return None

    monkeypatch.setattr("app.services.scanner.extract_metadata", fake_extract_metadata)
    monkeypatch.setattr("app.services.scanner.detect_album_art", fake_detect_album_art)

    scan_library(str(root), db_session)

    track = db_session.query(Track).filter(Track.file_path == str(audio_file.resolve())).first()

    assert track is not None
    assert track.metadata_source == "unknown"
    assert scan_state["last_error"] is not None