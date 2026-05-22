import pytest

from app.models.track import Track
from app.services.scanner import scan_library, reset_scan_state


@pytest.fixture(autouse=True)
def reset_test_state(request):
    reset_scan_state()
    yield
    reset_scan_state()


def make_fake_metadata(
    title=None,
    artist=None,
    album=None,
    duration=None,
    metadata_source="unknown",
):
    return {
        "title": title,
        "artist": artist,
        "album": album,
        "duration": duration,
        "metadata_source": metadata_source,
    }


def test_scan_inserts_new_track(tmp_path, monkeypatch, db_session):
    music_file = tmp_path / "song.mp3"
    music_file.write_bytes(b"fake audio bytes")

    def fake_extract_metadata(_path):
        return make_fake_metadata(
            title="New Title",
            artist="New Artist",
            album="New Album",
            duration=180,
            metadata_source="tag",
        )

    def fake_detect_album_art(_path):
        return "cover.jpg"

    monkeypatch.setattr("app.services.scan_track_metadata.extract_metadata", fake_extract_metadata)
    monkeypatch.setattr("app.services.scan_track_metadata.detect_album_art", fake_detect_album_art)
    
    scan_library(tmp_path, db_session)
    track = db_session.query(Track).filter(Track.file_path == str(music_file.resolve())).first()

    assert track is not None
    assert track.file_name == "song.mp3"
    assert track.extension == ".mp3"
    assert track.folder_path == str(tmp_path.resolve())

    # compatibility fields
    assert track.title == "New Title"
    assert track.artist == "New Artist"
    assert track.album == "New Album"

    # scanned fields
    assert track.scanned_title == "New Title"
    assert track.scanned_artist == "New Artist"
    assert track.scanned_album == "New Album"

    # display fields
    assert track.display_title == "New Title"
    assert track.display_artist == "New Artist"
    assert track.display_album == "New Album"

    assert track.duration == 180
    assert track.metadata_source == "tag"
    assert track.art_path == "cover.jpg"
    assert track.user_edited is False


def test_rescan_updates_existing_unedited_track(tmp_path, monkeypatch, db_session):
    music_file = tmp_path / "song.mp3"
    music_file.write_bytes(b"fake audio bytes")

    existing = Track(
        file_path=str(music_file.resolve()),
        file_name="song.mp3",
        extension=".mp3",
        folder_path=str(tmp_path.resolve()),
        title="Old Title",
        artist="Old Artist",
        album="Old Album",
        scanned_title="Old Title",
        scanned_artist="Old Artist",
        scanned_album="Old Album",
        display_title="Old Title",
        display_artist="Old Artist",
        display_album="Old Album",
        duration=100,
        metadata_source="old_source",
        art_path="old_cover.jpg",
        user_edited=False,
    )
    db_session.add(existing)
    db_session.commit()

    def fake_extract_metadata(_path):
        return make_fake_metadata(
            title="New Title",
            artist="New Artist",
            album="New Album",
            duration=222,
            metadata_source="tag",
        )

    def fake_detect_album_art(_path):
        return "new_cover.jpg"

    monkeypatch.setattr("app.services.scan_track_metadata.extract_metadata", fake_extract_metadata)
    monkeypatch.setattr("app.services.scan_track_metadata.detect_album_art", fake_detect_album_art)

    scan_library(tmp_path,db_session)
    updated = db_session.query(Track).filter(Track.file_path == str(music_file.resolve())).first()

    assert updated is not None

    # compatibility fields should refresh
    assert updated.title == "New Title"
    assert updated.artist == "New Artist"
    assert updated.album == "New Album"

    # scanned fields should refresh
    assert updated.scanned_title == "New Title"
    assert updated.scanned_artist == "New Artist"
    assert updated.scanned_album == "New Album"

    # display fields should refresh
    assert updated.display_title == "New Title"
    assert updated.display_artist == "New Artist"
    assert updated.display_album == "New Album"

    # scanner-owned fields should refresh
    assert updated.duration == 222
    assert updated.metadata_source == "tag"
    assert updated.art_path == "new_cover.jpg"

    assert updated.user_edited is False


def test_rescan_preserves_existing_user_edited_track(tmp_path, monkeypatch, db_session):
    music_file = tmp_path / "song.mp3"
    music_file.write_bytes(b"fake audio bytes")

    existing = Track(
        file_path=str(music_file.resolve()),
        file_name="song.mp3",
        extension=".mp3",
        folder_path=str(tmp_path.resolve()),
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
    db_session.add(existing)
    db_session.commit()


    def fake_extract_metadata(_path):
        return make_fake_metadata(
            title="Scanned Title",
            artist="Scanned Artist",
            album="Scanned Album",
            duration=333,
            metadata_source="tag",
        )

    def fake_detect_album_art(_path):
        return "new_cover.jpg"

    monkeypatch.setattr("app.services.scan_track_metadata.extract_metadata", fake_extract_metadata)
    monkeypatch.setattr("app.services.scan_track_metadata.detect_album_art", fake_detect_album_art)

    scan_library(tmp_path,db_session)

    updated = db_session.query(Track).filter(Track.file_path == str(music_file.resolve())).first()

    assert updated is not None

    # compatibility fields should stay preserved
    assert updated.title == "User Title"
    assert updated.artist == "User Artist"
    assert updated.album == "User Album"

    # scanned fields should still refresh
    assert updated.scanned_title == "Scanned Title"
    assert updated.scanned_artist == "Scanned Artist"
    assert updated.scanned_album == "Scanned Album"

    # display fields should stay preserved
    assert updated.display_title == "User Title"
    assert updated.display_artist == "User Artist"
    assert updated.display_album == "User Album"

    # scanner-owned fields can still refresh
    assert updated.duration == 333
    assert updated.metadata_source == "tag"
    assert updated.art_path == "new_cover.jpg"

    assert updated.user_edited is True



def test_rescan_with_same_metadata_keeps_values_stable(tmp_path, monkeypatch, db_session):
    music_file = tmp_path / "song.mp3"
    music_file.write_bytes(b"fake audio bytes")

    existing = Track(
        file_path=str(music_file.resolve()),
        file_name="song.mp3",
        extension=".mp3",
        folder_path=str(tmp_path.resolve()),
        title="Same Title",
        artist="Same Artist",
        album="Same Album",
        scanned_title="Same Title",
        scanned_artist="Same Artist",
        scanned_album="Same Album",
        display_title="Same Title",
        display_artist="Same Artist",
        display_album="Same Album",
        duration=150,
        metadata_source="tag",
        art_path="cover.jpg",
        user_edited=False,
    )
    db_session.add(existing)
    db_session.commit()

    def fake_extract_metadata(_path):
        return make_fake_metadata(
            title="Same Title",
            artist="Same Artist",
            album="Same Album",
            duration=150,
            metadata_source="tag",
        )

    def fake_detect_album_art(_path):
        return "cover.jpg"

    monkeypatch.setattr("app.services.scan_track_metadata.extract_metadata", fake_extract_metadata)
    monkeypatch.setattr("app.services.scan_track_metadata.detect_album_art", fake_detect_album_art)

    scan_library(tmp_path,db_session)

    updated = db_session.query(Track).filter(Track.file_path == str(music_file.resolve())).first()

    assert updated is not None
    assert updated.title == "Same Title"
    assert updated.artist == "Same Artist"
    assert updated.album == "Same Album"
    assert updated.scanned_title == "Same Title"
    assert updated.scanned_artist == "Same Artist"
    assert updated.scanned_album == "Same Album"
    assert updated.display_title == "Same Title"
    assert updated.display_artist == "Same Artist"
    assert updated.display_album == "Same Album"
    assert updated.duration == 150
    assert updated.metadata_source == "tag"
    assert updated.art_path == "cover.jpg"
