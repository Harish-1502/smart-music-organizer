from app.services.scan_track_metadata import load_track_metadata_and_art


def test_load_track_metadata_and_art_returns_metadata_and_art(monkeypatch, tmp_path):
    audio_file = tmp_path / "song.mp3"
    art_file = tmp_path / "cover.jpg"

    expected_metadata = {
        "title": "Song",
        "artist": "Artist",
        "album": "Album",
        "duration": 123,
        "metadata_source": "tag",
    }

    monkeypatch.setattr(
        "app.services.scan_track_metadata.extract_metadata",
        lambda _path: expected_metadata,
    )
    monkeypatch.setattr(
        "app.services.scan_track_metadata.detect_album_art",
        lambda _path: str(art_file),
    )

    metadata, art_path, error = load_track_metadata_and_art(audio_file)

    assert metadata == expected_metadata
    assert art_path == str(art_file)
    assert error is None


def test_load_track_metadata_and_art_uses_fallback_when_metadata_fails(
    monkeypatch,
    tmp_path,
):
    audio_file = tmp_path / "broken.mp3"
    expected_error = RuntimeError("metadata boom")

    def fake_extract_metadata(_path):
        raise expected_error

    monkeypatch.setattr(
        "app.services.scan_track_metadata.extract_metadata",
        fake_extract_metadata,
    )
    monkeypatch.setattr(
        "app.services.scan_track_metadata.detect_album_art",
        lambda _path: "cover.jpg",
    )

    metadata, art_path, error = load_track_metadata_and_art(audio_file)

    assert metadata == {
        "title": None,
        "artist": None,
        "album": None,
        "duration": None,
        "metadata_source": "unknown",
    }
    assert art_path is None
    assert error is expected_error


def test_load_track_metadata_and_art_uses_fallback_when_art_detection_fails(
    monkeypatch,
    tmp_path,
):
    audio_file = tmp_path / "song.mp3"
    expected_error = RuntimeError("art boom")

    monkeypatch.setattr(
        "app.services.scan_track_metadata.extract_metadata",
        lambda _path: {
            "title": "Song",
            "artist": "Artist",
            "album": "Album",
            "duration": 123,
            "metadata_source": "tag",
        },
    )

    def fake_detect_album_art(_path):
        raise expected_error

    monkeypatch.setattr(
        "app.services.scan_track_metadata.detect_album_art",
        fake_detect_album_art,
    )

    metadata, art_path, error = load_track_metadata_and_art(audio_file)

    assert metadata == {
        "title": None,
        "artist": None,
        "album": None,
        "duration": None,
        "metadata_source": "unknown",
    }
    assert art_path is None
    assert error is expected_error
