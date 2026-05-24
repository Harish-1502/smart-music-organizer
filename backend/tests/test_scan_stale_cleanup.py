import logging

from app.models.track import Track
from app.services import scan_stale_cleanup
from app.services.scan_stale_cleanup import cleanup_stale_tracks


def make_track(path, title="Track"):
    return Track(
        file_path=str(path.resolve()),
        file_name=path.name,
        extension=path.suffix.lower() or ".mp3",
        folder_path=str(path.parent.resolve()),
        title=title,
        artist=None,
        album=None,
        scanned_title=title,
        scanned_artist=None,
        scanned_album=None,
        display_title=title,
        display_artist=None,
        display_album=None,
        duration=None,
        metadata_source="unknown",
        art_path=None,
        user_edited=False,
    )


def test_cleanup_stale_tracks_deletes_stale_tracks_under_root(tmp_path, db_session):
    root = tmp_path / "Music"
    root.mkdir()
    keep_file = root / "keep.mp3"
    stale_file = root / "stale.mp3"
    keep_file.write_bytes(b"keep")

    db_session.add_all([
        make_track(keep_file, title="Keep"),
        make_track(stale_file, title="Stale"),
    ])
    db_session.commit()

    deleted, error = cleanup_stale_tracks(
        db_session,
        root.resolve(),
        str(root.resolve()),
        {str(keep_file.resolve())},
        supported_found=1,
    )

    assert error is None
    assert deleted == 1
    assert db_session.query(Track).filter(Track.file_path == str(keep_file.resolve())).first() is not None
    assert db_session.query(Track).filter(Track.file_path == str(stale_file.resolve())).first() is None


def test_cleanup_stale_tracks_keeps_seen_tracks(tmp_path, db_session):
    root = tmp_path / "Music"
    root.mkdir()
    seen_file = root / "seen.mp3"

    db_session.add(make_track(seen_file, title="Seen"))
    db_session.commit()

    deleted, error = cleanup_stale_tracks(
        db_session,
        root.resolve(),
        str(root.resolve()),
        {str(seen_file.resolve())},
        supported_found=1,
    )

    assert error is None
    assert deleted == 0
    assert db_session.query(Track).count() == 1


def test_cleanup_stale_tracks_preserves_tracks_outside_root(tmp_path, db_session):
    root = tmp_path / "Music"
    outside = tmp_path / "Outside"
    root.mkdir()
    outside.mkdir()
    outside_file = outside / "outside.mp3"

    db_session.add(make_track(outside_file, title="Outside"))
    db_session.commit()

    deleted, error = cleanup_stale_tracks(
        db_session,
        root.resolve(),
        str(root.resolve()),
        set(),
        supported_found=0,
    )

    assert error is None
    assert deleted == 0
    assert db_session.query(Track).count() == 1


def test_cleanup_stale_tracks_preserves_sibling_prefix_paths(
    tmp_path,
    db_session,
):
    root = tmp_path / "Music"
    sibling = tmp_path / "Music2"
    root.mkdir()
    sibling.mkdir()

    keep_file = root / "keep.mp3"
    stale_file = root / "stale.mp3"
    sibling_file = sibling / "sibling.mp3"
    keep_file.write_bytes(b"keep")
    sibling_file.write_bytes(b"sibling")

    db_session.add_all([
        make_track(keep_file, title="Keep"),
        make_track(stale_file, title="Stale"),
        make_track(sibling_file, title="Sibling"),
    ])
    db_session.commit()

    deleted, error = cleanup_stale_tracks(
        db_session,
        root.resolve(),
        str(root.resolve()),
        {str(keep_file.resolve())},
        supported_found=1,
    )

    assert error is None
    assert deleted == 1
    assert db_session.query(Track).filter(
        Track.file_path == str(stale_file.resolve())
    ).first() is None
    assert db_session.query(Track).filter(
        Track.file_path == str(sibling_file.resolve())
    ).first() is not None


def test_cleanup_stale_tracks_skips_cleanup_when_seen_paths_empty(
    tmp_path,
    db_session,
    caplog,
):
    root = tmp_path / "Music"
    root.mkdir()
    stale_file = root / "stale.mp3"

    db_session.add(make_track(stale_file, title="Stale"))
    db_session.commit()

    with caplog.at_level(logging.WARNING, logger=scan_stale_cleanup.__name__):
        deleted, error = cleanup_stale_tracks(
            db_session,
            root.resolve(),
            str(root.resolve()),
            set(),
            supported_found=0,
        )

    assert error is None
    assert deleted == 0
    assert db_session.query(Track).count() == 1
    assert "Stale cleanup skipped because no supported audio files were found." in caplog.text


def test_cleanup_stale_tracks_rolls_back_on_delete_error(
    tmp_path,
    db_session,
    monkeypatch,
):
    root = tmp_path / "Music"
    root.mkdir()
    seen_file = root / "seen.mp3"
    stale_file = root / "stale.mp3"

    seen_file.write_bytes(b"seen")
    db_session.add(make_track(stale_file, title="Stale"))
    db_session.commit()

    original_delete = db_session.delete
    delete_error = RuntimeError("delete boom")

    def fake_delete(obj):
        if isinstance(obj, Track):
            raise delete_error

        return original_delete(obj)

    monkeypatch.setattr(db_session, "delete", fake_delete)

    deleted, error = cleanup_stale_tracks(
        db_session,
        root.resolve(),
        str(root.resolve()),
        {str(seen_file.resolve())},
        supported_found=1,
    )

    assert deleted is None
    assert error is delete_error

    monkeypatch.setattr(db_session, "delete", original_delete)

    assert db_session.query(Track).count() == 1
