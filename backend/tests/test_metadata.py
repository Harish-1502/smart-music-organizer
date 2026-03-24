from pathlib import Path

from app.services.metadata import (
    extract_metadata,
    infer_metadata_from_path,
    extract_tag_metadata,
)


class FakeInfo:
    def __init__(self, length):
        self.length = length


class FakeAudio:
    def __init__(self, tags=None, length=None):
        self.tags = tags or {}
        self.info = FakeInfo(length) if length is not None else None


def test_extract_tag_metadata_reads_basic_tags(monkeypatch, tmp_path):
    audio_file = tmp_path / "song.mp3"
    audio_file.write_text("fake mp3")

    fake_audio = FakeAudio(
        tags={
            "title": ["Blinding Lights"],
            "artist": ["The Weeknd"],
            "album": ["After Hours"],
        },
        length=200.5,
    )

    def fake_mutagen_file(path):
        return fake_audio

    monkeypatch.setattr("app.services.metadata.MutagenFile", fake_mutagen_file)

    result = extract_tag_metadata(audio_file)

    assert result["title"] == "Blinding Lights"
    assert result["artist"] == "The Weeknd"
    assert result["album"] == "After Hours"
    assert result["duration"] == 200.5


def test_extract_metadata_prefers_tags(monkeypatch, tmp_path):
    audio_file = tmp_path / "Artist - Title.mp3"
    audio_file.write_text("fake mp3")

    fake_audio = FakeAudio(
        tags={
            "title": ["Tagged Title"],
            "artist": ["Tagged Artist"],
            "album": ["Tagged Album"],
        },
        length=180.0,
    )

    def fake_mutagen_file(path):
        return fake_audio

    monkeypatch.setattr("app.services.metadata.MutagenFile", fake_mutagen_file)

    result = extract_metadata(audio_file)

    assert result["title"] == "Tagged Title"
    assert result["artist"] == "Tagged Artist"
    assert result["album"] == "Tagged Album"
    assert result["duration"] == 180.0
    assert result["metadata_source"] == "tag"


def test_infer_metadata_from_filename_artist_title(tmp_path):
    audio_file = tmp_path / "The Weeknd - Blinding Lights.mp3"
    audio_file.write_text("fake mp3")

    result = infer_metadata_from_path(audio_file)

    assert result["artist"] == "The Weeknd"
    assert result["title"] == "Blinding Lights"
    assert result["album"] == tmp_path.name


def test_infer_metadata_from_folder_structure(tmp_path):
    artist_dir = tmp_path / "Daft Punk"
    album_dir = artist_dir / "Discovery"
    album_dir.mkdir(parents=True)

    audio_file = album_dir / "One More Time.mp3"
    audio_file.write_text("fake mp3")

    result = infer_metadata_from_path(audio_file)

    assert result["artist"] == "Daft Punk"
    assert result["album"] == "Discovery"
    assert result["title"] == "One More Time"


def test_infer_metadata_strips_track_number(tmp_path):
    artist_dir = tmp_path / "Artist"
    album_dir = artist_dir / "Album"
    album_dir.mkdir(parents=True)

    audio_file = album_dir / "01 - My Song.mp3"
    audio_file.write_text("fake mp3")

    result = infer_metadata_from_path(audio_file)

    assert result["title"] == "My Song"
    assert result["artist"] == "Artist"
    assert result["album"] == "Album"


def test_extract_metadata_falls_back_to_path_when_tags_missing(monkeypatch, tmp_path):
    audio_file = tmp_path / "The Weeknd - Blinding Lights.mp3"
    audio_file.write_text("fake mp3")

    fake_audio = FakeAudio(tags={}, length=210.0)

    def fake_mutagen_file(path):
        return fake_audio

    monkeypatch.setattr("app.services.metadata.MutagenFile", fake_mutagen_file)

    result = extract_metadata(audio_file)

    assert result["title"] == "Blinding Lights"
    assert result["artist"] == "The Weeknd"
    assert result["album"] == tmp_path.name
    assert result["duration"] == 210.0
    assert result["metadata_source"] == "path"


def test_extract_metadata_returns_unknown_when_no_useful_data(monkeypatch, tmp_path):
    audio_file = tmp_path / "xj12demo.mp3"
    audio_file.write_text("fake mp3")

    fake_audio = FakeAudio(tags={}, length=None)

    def fake_mutagen_file(path):
        return fake_audio

    monkeypatch.setattr("app.services.metadata.MutagenFile", fake_mutagen_file)

    result = extract_metadata(audio_file)

    assert result["duration"] is None
    assert result["metadata_source"] in {"path", "unknown"}
    assert result["title"] is not None