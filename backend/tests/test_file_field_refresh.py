from app.models.track import Track
from app.services.scanner import scan_library, reset_scan_state


def test_rescan_updates_file_owned_fields_even_when_user_edited(tmp_path, monkeypatch, db_session):
    """
    Test:
    - Existing track is user-edited
    - Rescan finds changed scanner-owned/file-owned values

    Expected result:
    - duration, metadata_source, art_path, scanned_* update
    - displayed values stay preserved
    """
    reset_scan_state()

    music_dir = tmp_path / "Music"
    music_dir.mkdir()

    audio_file = music_dir / "song.mp3"
    audio_file.write_bytes(b"fake audio")

    track = Track(
        file_path=str(audio_file.resolve()),
        file_name="song.mp3",
        extension=".mp3",
        folder_path=str(music_dir.resolve()),
        title="User Title",
        artist="User Artist",
        album="User Album",
        scanned_title="Old Scan Title",
        scanned_artist="Old Scan Artist",
        scanned_album="Old Scan Album",
        display_title="User Title",
        display_artist="User Artist",
        display_album="User Album",
        duration=100,
        metadata_source="old_source",
        art_path="old.jpg",
        user_edited=True,
    )
    db_session.add(track)
    db_session.commit()
    db_session.refresh(track)

    def fake_extract_metadata(_path):
        return {
            "title": "New Scan Title",
            "artist": "New Scan Artist",
            "album": "New Scan Album",
            "duration": 222,
            "metadata_source": "tag",
        }

    def fake_detect_album_art(_path):
        return "new.jpg"

    monkeypatch.setattr("app.services.scan_track_metadata.extract_metadata", fake_extract_metadata)
    monkeypatch.setattr("app.services.scan_track_metadata.detect_album_art", fake_detect_album_art)

    scan_library(str(music_dir), db_session)

    db_session.refresh(track)

    assert track.scanned_title == "New Scan Title"
    assert track.scanned_artist == "New Scan Artist"
    assert track.scanned_album == "New Scan Album"

    assert track.duration == 222
    assert track.metadata_source == "tag"
    assert track.art_path == "new.jpg"

    # preserved values
    assert track.title == "User Title"
    assert track.artist == "User Artist"
    assert track.album == "User Album"
