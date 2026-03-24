from app.models.track import Track
from app.services.scanner import scan_library
from tests.conftest import TestingSessionLocal


def test_scan_library_saves_metadata_and_art(tmp_path, monkeypatch):
    music_dir = tmp_path / "Music"
    music_dir.mkdir()

    audio_file = music_dir / "Artist - Song.mp3"
    cover_file = music_dir / "cover.jpg"

    audio_file.write_text("fake mp3")
    cover_file.write_text("fake image")

    def fake_extract_metadata(path):
        return {
            "title": "Song",
            "artist": "Artist",
            "album": "Test Album",
            "duration": 123.4,
            "metadata_source": "path",
        }

    def fake_detect_album_art(path):
        return str(cover_file)

    monkeypatch.setattr("app.services.scanner.extract_metadata", fake_extract_metadata)
    monkeypatch.setattr("app.services.scanner.detect_album_art", fake_detect_album_art)

    db = TestingSessionLocal()

    try:
        scan_library(str(music_dir), db)

        tracks = db.query(Track).all()
        assert len(tracks) == 1

        track = tracks[0]
        assert track.title == "Song"
        assert track.artist == "Artist"
        assert track.album == "Test Album"
        assert track.duration == 123.4
        assert track.metadata_source == "path"
        assert track.art_path == str(cover_file)

    finally:
        db.close()


def test_scan_library_uses_unknown_metadata_when_extraction_fails(tmp_path, monkeypatch):
    music_dir = tmp_path / "Music"
    music_dir.mkdir()

    audio_file = music_dir / "broken.mp3"
    audio_file.write_text("fake mp3")

    def fake_extract_metadata(path):
        raise RuntimeError("metadata boom")

    def fake_detect_album_art(path):
        return None

    monkeypatch.setattr("app.services.scanner.extract_metadata", fake_extract_metadata)
    monkeypatch.setattr("app.services.scanner.detect_album_art", fake_detect_album_art)

    db = TestingSessionLocal()

    try:
        scan_library(str(music_dir), db)

        tracks = db.query(Track).all()
        assert len(tracks) == 1

        track = tracks[0]
        assert track.title is None
        assert track.artist is None
        assert track.album is None
        assert track.duration is None
        assert track.metadata_source == "unknown"
        assert track.art_path is None

    finally:
        db.close()


def test_scan_library_skips_duplicate_and_keeps_metadata_fields(tmp_path, monkeypatch):
    music_dir = tmp_path / "Music"
    music_dir.mkdir()

    audio_file = music_dir / "Artist - Song.mp3"
    audio_file.write_text("fake mp3")

    def fake_extract_metadata(path):
        return {
            "title": "Song",
            "artist": "Artist",
            "album": "Album",
            "duration": 200.0,
            "metadata_source": "path",
        }

    def fake_detect_album_art(path):
        return None

    monkeypatch.setattr("app.services.scanner.extract_metadata", fake_extract_metadata)
    monkeypatch.setattr("app.services.scanner.detect_album_art", fake_detect_album_art)

    db = TestingSessionLocal()

    try:
        scan_library(str(music_dir), db)
        scan_library(str(music_dir), db)

        tracks = db.query(Track).all()
        assert len(tracks) == 1

        track = tracks[0]
        assert track.title == "Song"
        assert track.artist == "Artist"
        assert track.album == "Album"
        assert track.duration == 200.0
        assert track.metadata_source == "path"

    finally:
        db.close()