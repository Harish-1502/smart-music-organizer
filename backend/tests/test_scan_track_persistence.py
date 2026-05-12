from app.models.track import Track
from app.services.scan_track_persistence import (
    apply_scanned_track_update,
    build_scanned_track,
)


def make_metadata(
    title="Song",
    artist="Artist",
    album="Album",
    duration=123,
    metadata_source="tag",
):
    return {
        "title": title,
        "artist": artist,
        "album": album,
        "duration": duration,
        "metadata_source": metadata_source,
    }


def test_build_scanned_track_sets_current_scanner_fields(tmp_path):
    audio_file = tmp_path / "Artist - Song.MP3"
    metadata = make_metadata()
    art_path = str(tmp_path / "cover.jpg")

    track = build_scanned_track(
        audio_file,
        str(audio_file),
        str(tmp_path),
        metadata,
        art_path,
    )

    assert track.file_path == str(audio_file)
    assert track.file_name == "Artist - Song.MP3"
    assert track.extension == ".mp3"
    assert track.folder_path == str(tmp_path)

    assert track.title == "Song"
    assert track.artist == "Artist"
    assert track.album == "Album"

    assert track.scanned_title == "Song"
    assert track.scanned_artist == "Artist"
    assert track.scanned_album == "Album"

    assert track.display_title == "Song"
    assert track.display_artist == "Artist"
    assert track.display_album == "Album"

    assert track.duration == 123
    assert track.metadata_source == "tag"
    assert track.art_path == art_path
    assert track.user_edited is False


def test_apply_scanned_track_update_refreshes_unedited_user_fields(tmp_path):
    original_file = tmp_path / "old.mp3"
    new_file = tmp_path / "new.FLAC"
    track = Track(
        file_path=str(original_file),
        file_name="old.mp3",
        extension=".mp3",
        folder_path=str(tmp_path),
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
        metadata_source="old",
        art_path="old.jpg",
        user_edited=False,
    )

    changed = apply_scanned_track_update(
        track,
        new_file,
        str(tmp_path),
        make_metadata(title="New Title", artist="New Artist", album="New Album"),
        "new.jpg",
    )

    assert changed is True
    assert track.file_path == str(original_file)
    assert track.file_name == "new.FLAC"
    assert track.extension == ".flac"
    assert track.title == "New Title"
    assert track.artist == "New Artist"
    assert track.album == "New Album"
    assert track.scanned_title == "New Title"
    assert track.scanned_artist == "New Artist"
    assert track.scanned_album == "New Album"
    assert track.display_title == "New Title"
    assert track.display_artist == "New Artist"
    assert track.display_album == "New Album"
    assert track.duration == 123
    assert track.metadata_source == "tag"
    assert track.art_path == "new.jpg"


def test_apply_scanned_track_update_preserves_user_edited_fields(tmp_path):
    original_file = tmp_path / "song.mp3"
    track = Track(
        file_path=str(original_file),
        file_name="song.mp3",
        extension=".mp3",
        folder_path=str(tmp_path),
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
        metadata_source="old",
        art_path="old.jpg",
        user_edited=True,
    )

    changed = apply_scanned_track_update(
        track,
        original_file,
        str(tmp_path),
        make_metadata(title="Scan Title", artist="Scan Artist", album="Scan Album"),
        "new.jpg",
    )

    assert changed is True
    assert track.title == "User Title"
    assert track.artist == "User Artist"
    assert track.album == "User Album"
    assert track.display_title == "User Title"
    assert track.display_artist == "User Artist"
    assert track.display_album == "User Album"
    assert track.scanned_title == "Scan Title"
    assert track.scanned_artist == "Scan Artist"
    assert track.scanned_album == "Scan Album"
    assert track.duration == 123
    assert track.metadata_source == "tag"
    assert track.art_path == "new.jpg"


def test_apply_scanned_track_update_returns_false_when_values_are_unchanged(tmp_path):
    audio_file = tmp_path / "song.mp3"
    metadata = make_metadata()
    track = build_scanned_track(
        audio_file,
        str(audio_file),
        str(tmp_path),
        metadata,
        "cover.jpg",
    )

    changed = apply_scanned_track_update(
        track,
        audio_file,
        str(tmp_path),
        metadata,
        "cover.jpg",
    )

    assert changed is False
