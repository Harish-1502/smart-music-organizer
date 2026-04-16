from app.models.track import Track
from app.services.scanner import scan_library, reset_scan_state


def test_edit_then_rescan_preserves_user_values(tmp_path, monkeypatch, db_session):
    """
    Test:
    - A track exists
    - User edits it manually
    - A rescan finds different scanned metadata

    Expected result:
    - scanned_* fields update to new scan values
    - display/title/artist/album stay as the user-edited values
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
        art_path="old_cover.jpg",
        user_edited=True,
    )
    db_session.add(track)
    db_session.commit()
    db_session.refresh(track)

    def fake_extract_metadata(_path):
        return {
            "title": "Scanned Title",
            "artist": "Scanned Artist",
            "album": "Scanned Album",
            "duration": 250,
            "metadata_source": "tag",
        }

    def fake_detect_album_art(_path):
        return "new_cover.jpg"

    monkeypatch.setattr("app.services.scanner.extract_metadata", fake_extract_metadata)
    monkeypatch.setattr("app.services.scanner.detect_album_art", fake_detect_album_art)

    scan_library(str(music_dir), db_session)

    db_session.refresh(track)

    # scanned fields should update
    assert track.scanned_title == "Scanned Title"
    assert track.scanned_artist == "Scanned Artist"
    assert track.scanned_album == "Scanned Album"

    # user-facing fields should stay preserved
    assert track.title == "User Title"
    assert track.artist == "User Artist"
    assert track.album == "User Album"

    assert track.display_title == "User Title"
    assert track.display_artist == "User Artist"
    assert track.display_album == "User Album"

    # scanner-owned fields can still change
    assert track.duration == 250
    assert track.metadata_source == "tag"
    assert track.art_path == "new_cover.jpg"