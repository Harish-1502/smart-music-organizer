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

    original_query = db_session.query
    delete_error = RuntimeError("delete boom")

    class FailingDeleteQuery:
        def __init__(self, query):
            self._query = query

        def filter(self, *args, **kwargs):
            return FailingDeleteQuery(self._query.filter(*args, **kwargs))

        def all(self):
            return self._query.all()

        def delete(self, *args, **kwargs):
            raise delete_error

    def fake_query(*args, **kwargs):
        query = original_query(*args, **kwargs)
        if args and args[0] is Track:
            return FailingDeleteQuery(query)
        return query

    monkeypatch.setattr(db_session, "query", fake_query)

    deleted, error = cleanup_stale_tracks(
        db_session,
        root.resolve(),
        str(root.resolve()),
        {str(seen_file.resolve())},
        supported_found=1,
    )

    assert deleted is None
    assert error is delete_error

    monkeypatch.setattr(db_session, "query", original_query)

    assert db_session.query(Track).count() == 1
