from app.models.track import Track
from app.services.scanner import reset_scan_state, scan_library


def test_rescan_removes_tracks_for_deleted_files(tmp_path, monkeypatch, db_session):
    """
    Test:
    - A folder initially contains two supported audio files
    - First scan inserts both tracks into the database
    - One file is deleted from disk
    - A second scan runs on the same folder

    Input:
    - Initial files:
        - keep.mp3
        - remove.mp3
    - After deletion:
        - keep.mp3 only

    Expected result:
    - After first scan, database contains 2 tracks
    - After second scan, database contains only 1 track
    - The deleted file's track is removed from the database
    - The remaining file's track still exists
    """

    reset_scan_state()

    music_dir = tmp_path / "Music"
    music_dir.mkdir()

    keep_file = music_dir / "keep.mp3"
    remove_file = music_dir / "remove.mp3"

    keep_file.write_bytes(b"fake audio keep")
    remove_file.write_bytes(b"fake audio remove")

    def fake_extract_metadata(path):
        return {
            "title": path.stem,
            "artist": "Test Artist",
            "album": "Test Album",
            "duration": 123.0,
            "metadata_source": "path",
        }

    def fake_detect_album_art(_path):
        return None

    monkeypatch.setattr("app.services.scan_track_metadata.extract_metadata", fake_extract_metadata)
    monkeypatch.setattr("app.services.scan_track_metadata.detect_album_art", fake_detect_album_art)

    # First scan: both files should be inserted
    scan_library(str(music_dir), db_session)

    tracks_after_first_scan = db_session.query(Track).order_by(Track.file_name.asc()).all()
    assert len(tracks_after_first_scan) == 2
    assert tracks_after_first_scan[0].file_name == "keep.mp3"
    assert tracks_after_first_scan[1].file_name == "remove.mp3"

    # Delete one file from disk
    remove_file.unlink()

    reset_scan_state()

    # Second scan: deleted file should be removed from DB
    scan_library(str(music_dir), db_session)

    tracks_after_second_scan = db_session.query(Track).order_by(Track.file_name.asc()).all()
    assert len(tracks_after_second_scan) == 1
    assert tracks_after_second_scan[0].file_name == "keep.mp3"

    deleted_track = (
        db_session.query(Track)
        .filter(Track.file_path == str(remove_file.resolve()))
        .first()
    )
    assert deleted_track is None

def test_rescan_keeps_existing_tracks_when_no_files_are_deleted(tmp_path, monkeypatch, db_session):
    """
    Test:
    - A folder contains one supported audio file
    - Scan runs twice without deleting anything

    Input:
    - keep.mp3 remains on disk for both scans

    Expected result:
    - Database still contains exactly 1 track after the second scan
    - No valid existing track is removed
    """

    reset_scan_state()

    music_dir = tmp_path / "Music"
    music_dir.mkdir()

    keep_file = music_dir / "keep.mp3"
    keep_file.write_bytes(b"fake audio keep")

    def fake_extract_metadata(path):
        return {
            "title": path.stem,
            "artist": "Test Artist",
            "album": "Test Album",
            "duration": 123.0,
            "metadata_source": "path",
        }

    def fake_detect_album_art(_path):
        return None

    monkeypatch.setattr("app.services.scan_track_metadata.extract_metadata", fake_extract_metadata)
    monkeypatch.setattr("app.services.scan_track_metadata.detect_album_art", fake_detect_album_art)

    scan_library(str(music_dir), db_session)
    reset_scan_state()
    scan_library(str(music_dir), db_session)

    tracks = db_session.query(Track).all()
    assert len(tracks) == 1
    assert tracks[0].file_name == "keep.mp3"
