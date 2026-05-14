from app.models.track import Track
from app.models.playlist import Playlist
from app.models.playlistTrack import PlaylistTrack
from app.services.scan_state import scan_state
from app.services.scanner import reset_scan_state, scan_library


def stub_scanner_dependencies(monkeypatch):
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

    monkeypatch.setattr(
        "app.services.scan_track_metadata.extract_metadata",
        fake_extract_metadata,
    )
    monkeypatch.setattr(
        "app.services.scan_track_metadata.detect_album_art",
        fake_detect_album_art,
    )
    monkeypatch.setattr(
        "app.services.scanner.analyze_track_audio",
        lambda _db, track: track,
    )


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

    stub_scanner_dependencies(monkeypatch)

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

    stub_scanner_dependencies(monkeypatch)

    scan_library(str(music_dir), db_session)
    reset_scan_state()
    scan_library(str(music_dir), db_session)

    tracks = db_session.query(Track).all()
    assert len(tracks) == 1
    assert tracks[0].file_name == "keep.mp3"


def test_rescan_does_not_delete_tracks_outside_scanned_root(
    tmp_path,
    monkeypatch,
    db_session,
):
    """
    Current behavior:
    - stale cleanup uses the scanned root prefix
    - tracks outside that root are preserved
    """

    reset_scan_state()
    stub_scanner_dependencies(monkeypatch)

    music_dir = tmp_path / "Music"
    outside_dir = tmp_path / "Outside"
    music_dir.mkdir()
    outside_dir.mkdir()

    keep_file = music_dir / "keep.mp3"
    outside_file = outside_dir / "outside.mp3"
    keep_file.write_bytes(b"fake audio keep")
    outside_file.write_bytes(b"fake audio outside")

    outside_track = Track(
        file_path=str(outside_file.resolve()),
        file_name=outside_file.name,
        extension=".mp3",
        folder_path=str(outside_dir.resolve()),
        title="Outside",
        artist=None,
        album=None,
        scanned_title="Outside",
        scanned_artist=None,
        scanned_album=None,
        display_title="Outside",
        display_artist=None,
        display_album=None,
        duration=None,
        metadata_source="unknown",
        art_path=None,
        user_edited=False,
    )
    db_session.add(outside_track)
    db_session.commit()

    scan_library(str(music_dir), db_session)

    outside_after_scan = (
        db_session.query(Track)
        .filter(Track.file_path == str(outside_file.resolve()))
        .first()
    )

    assert outside_after_scan is not None
    assert db_session.query(Track).count() == 2


def test_rescan_with_no_supported_files_preserves_tracks_under_root(
    tmp_path,
    monkeypatch,
    db_session,
    capsys,
):
    """
    Hardened behavior:
    - when no supported files are seen, seen_paths is empty
    - cleanup is skipped and DB tracks under the root are preserved
    """

    reset_scan_state()
    stub_scanner_dependencies(monkeypatch)

    music_dir = tmp_path / "Music"
    music_dir.mkdir()
    (music_dir / "notes.txt").write_text("not audio")

    missing_audio_file = music_dir / "missing.mp3"
    stale_track = Track(
        file_path=str(missing_audio_file.resolve()),
        file_name=missing_audio_file.name,
        extension=".mp3",
        folder_path=str(music_dir.resolve()),
        title="Missing",
        artist=None,
        album=None,
        scanned_title="Missing",
        scanned_artist=None,
        scanned_album=None,
        display_title="Missing",
        display_artist=None,
        display_album=None,
        duration=None,
        metadata_source="unknown",
        art_path=None,
        user_edited=False,
    )
    db_session.add(stale_track)
    db_session.commit()

    scan_library(str(music_dir), db_session)

    output = capsys.readouterr().out

    assert db_session.query(Track).count() == 1
    assert db_session.query(Track).filter(Track.id == stale_track.id).first() is not None
    assert scan_state["files_seen"] == 1
    assert scan_state["supported_found"] == 0
    assert "cleanup skipped because no supported audio files were found" in output


def test_rescan_stale_track_linked_to_playlist_cascades_playlist_rows(
    tmp_path,
    monkeypatch,
    db_session,
):
    """
    Expected behavior:
    - scanner stale cleanup bulk-deletes tracks directly
    - playlist_tracks.track_id cascades at the database level
    - a stale playlist-linked track is deleted with its playlist row
    """

    reset_scan_state()
    stub_scanner_dependencies(monkeypatch)

    music_dir = tmp_path / "Music"
    music_dir.mkdir()

    keep_file = music_dir / "keep.mp3"
    stale_file = music_dir / "stale.mp3"
    keep_file.write_bytes(b"fake audio keep")
    stale_track = Track(
        file_path=str(stale_file.resolve()),
        file_name=stale_file.name,
        extension=".mp3",
        folder_path=str(music_dir.resolve()),
        title="Stale",
        artist=None,
        album=None,
        scanned_title="Stale",
        scanned_artist=None,
        scanned_album=None,
        display_title="Stale",
        display_artist=None,
        display_album=None,
        duration=None,
        metadata_source="unknown",
        art_path=None,
        user_edited=False,
    )
    playlist = Playlist(name="Linked playlist")
    db_session.add_all([stale_track, playlist])
    db_session.commit()
    db_session.refresh(stale_track)
    db_session.refresh(playlist)

    playlist_track = PlaylistTrack(
        playlist_id=playlist.id,
        track_id=stale_track.id,
        position=0,
    )
    db_session.add(playlist_track)
    db_session.commit()
    stale_track_id = stale_track.id

    scan_library(str(music_dir), db_session)

    assert db_session.query(Track).filter(Track.id == stale_track_id).first() is None
    assert db_session.query(PlaylistTrack).filter(PlaylistTrack.track_id == stale_track_id).first() is None
    assert scan_state["failed"] == 0
    assert scan_state["last_error"] is None
