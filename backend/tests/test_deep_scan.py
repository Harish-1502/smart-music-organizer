from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.track import Track
from app.models.tag import Tag
from app.models.track_tag import TrackTag
from app.services.acoustid_client import AcoustIDLookupError
from app.services.deep_scan import deep_scan_track
from app.services.musicbrainz_client import MusicBrainzLookupError


def make_test_db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
    )

    TestingSessionLocal = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=engine,
    )

    Base.metadata.create_all(bind=engine)

    return TestingSessionLocal


def create_track(
    db,
    title="Blinding Lights",
    artist="The Weeknd",
    file_path="S:/Music/test.mp3",
):
    track = Track(
        file_path=file_path,
        file_name="test.mp3",
        extension=".mp3",
        folder_path="S:/Music",
        title=title,
        artist=artist,
        album="Test Album",
        display_title=title,
        display_artist=artist,
        display_album="Test Album",
        duration=180,
        metadata_source="test",
        user_edited=False,
    )

    db.add(track)
    db.flush()

    return track


def fake_recording_details_with_tags(recording_id):
    return {
        "id": recording_id,
        "genre-list": [
            {"name": "pop", "count": 20},
            {"name": "electronic", "count": 10},
        ],
        "tag-list": [],
    }


def fake_recording_details_with_rap(recording_id):
    return {
        "id": recording_id,
        "genre-list": [
            {"name": "hip-hop", "count": 20},
        ],
        "tag-list": [],
    }


def fake_recording_details_without_useful_tags(recording_id):
    return {
        "id": recording_id,
        "genre-list": [],
        "tag-list": [
            {"name": "seen live", "count": 100}
        ],
    }


def test_deep_scan_musicbrainz_text_path_succeeds(monkeypatch):
    TestingSessionLocal = make_test_db()
    db = TestingSessionLocal()

    try:
        track = create_track(db)

        was_acoustid_called = False

        def fake_find_recording_id_by_text(track):
            return "mbid-text"

        def fake_fetch_recording_details(recording_id):
            return fake_recording_details_with_tags(recording_id)

        def fake_find_recording_id_by_fingerprint(track):
            nonlocal was_acoustid_called
            was_acoustid_called = True
            return None, None

        monkeypatch.setattr(
            "app.services.deep_scan.find_recording_id_by_text",
            fake_find_recording_id_by_text,
        )
        monkeypatch.setattr(
            "app.services.deep_scan.fetch_recording_details",
            fake_fetch_recording_details,
        )
        monkeypatch.setattr(
            "app.services.deep_scan.find_recording_id_by_fingerprint",
            fake_find_recording_id_by_fingerprint,
        )

        result = deep_scan_track(db, track)
        db.commit()

        tag_names = {track_tag.tag.name for track_tag in result.applied_tags}

        assert result.method_used == "musicbrainz_text"
        assert result.musicbrainz_recording_id == "mbid-text"
        assert "pop" in tag_names
        assert "electronic" in tag_names
        assert was_acoustid_called is False

    finally:
        db.close()


def test_deep_scan_skips_text_path_when_metadata_is_weak_and_uses_acoustid(monkeypatch):
    TestingSessionLocal = make_test_db()
    db = TestingSessionLocal()

    try:
        track = create_track(db, title="Track01", artist=None)

        was_text_called = False

        def fake_find_recording_id_by_text(track):
            nonlocal was_text_called
            was_text_called = True
            return "mbid-text"

        def fake_find_recording_id_by_fingerprint(track):
            return (
                "mbid-acoustid",
                {
                    "title": "Real Song",
                    "artists": [{"name": "Real Artist"}],
                },
            )

        def fake_fetch_recording_details(recording_id):
            return fake_recording_details_with_rap(recording_id)

        monkeypatch.setattr(
            "app.services.deep_scan.find_recording_id_by_text",
            fake_find_recording_id_by_text,
        )
        monkeypatch.setattr(
            "app.services.deep_scan.find_recording_id_by_fingerprint",
            fake_find_recording_id_by_fingerprint,
        )
        monkeypatch.setattr(
            "app.services.deep_scan.fetch_recording_details",
            fake_fetch_recording_details,
        )

        result = deep_scan_track(db, track)
        db.commit()

        tag_names = {track_tag.tag.name for track_tag in result.applied_tags}

        assert was_text_called is False
        assert result.method_used == "acoustid_fingerprint"
        assert result.musicbrainz_recording_id == "mbid-acoustid"
        assert "rap" in tag_names

    finally:
        db.close()


def test_deep_scan_falls_back_to_acoustid_when_text_path_has_no_useful_tags(monkeypatch):
    TestingSessionLocal = make_test_db()
    db = TestingSessionLocal()

    try:
        track = create_track(db)

        def fake_find_recording_id_by_text(track):
            return "mbid-text"

        def fake_find_recording_id_by_fingerprint(track):
            return (
                "mbid-acoustid",
                {
                    "title": "Real Song",
                    "artists": [{"name": "Real Artist"}],
                },
            )

        def fake_fetch_recording_details(recording_id):
            if recording_id == "mbid-text":
                return fake_recording_details_without_useful_tags(recording_id)

            return fake_recording_details_with_rap(recording_id)

        monkeypatch.setattr(
            "app.services.deep_scan.find_recording_id_by_text",
            fake_find_recording_id_by_text,
        )
        monkeypatch.setattr(
            "app.services.deep_scan.find_recording_id_by_fingerprint",
            fake_find_recording_id_by_fingerprint,
        )
        monkeypatch.setattr(
            "app.services.deep_scan.fetch_recording_details",
            fake_fetch_recording_details,
        )

        result = deep_scan_track(db, track)
        db.commit()

        tag_names = {track_tag.tag.name for track_tag in result.applied_tags}

        assert result.method_used == "acoustid_fingerprint"
        assert result.musicbrainz_recording_id == "mbid-acoustid"
        assert "rap" in tag_names

    finally:
        db.close()


def test_deep_scan_falls_back_to_acoustid_when_text_path_returns_none(monkeypatch):
    TestingSessionLocal = make_test_db()
    db = TestingSessionLocal()

    try:
        track = create_track(db)

        def fake_find_recording_id_by_text(track):
            return None

        def fake_find_recording_id_by_fingerprint(track):
            return (
                "mbid-acoustid",
                {
                    "title": "Real Song",
                    "artists": [{"name": "Real Artist"}],
                },
            )

        def fake_fetch_recording_details(recording_id):
            return fake_recording_details_with_rap(recording_id)

        monkeypatch.setattr(
            "app.services.deep_scan.find_recording_id_by_text",
            fake_find_recording_id_by_text,
        )
        monkeypatch.setattr(
            "app.services.deep_scan.find_recording_id_by_fingerprint",
            fake_find_recording_id_by_fingerprint,
        )
        monkeypatch.setattr(
            "app.services.deep_scan.fetch_recording_details",
            fake_fetch_recording_details,
        )

        result = deep_scan_track(db, track)
        db.commit()

        assert result.method_used == "acoustid_fingerprint"
        assert result.musicbrainz_recording_id == "mbid-acoustid"

    finally:
        db.close()


def test_deep_scan_adds_warning_when_text_path_errors_then_fallback_succeeds(monkeypatch):
    TestingSessionLocal = make_test_db()
    db = TestingSessionLocal()

    try:
        track = create_track(db)

        def fake_find_recording_id_by_text(track):
            raise MusicBrainzLookupError("network down")

        def fake_find_recording_id_by_fingerprint(track):
            return (
                "mbid-acoustid",
                {
                    "title": "Real Song",
                    "artists": [{"name": "Real Artist"}],
                },
            )

        def fake_fetch_recording_details(recording_id):
            return fake_recording_details_with_rap(recording_id)

        monkeypatch.setattr(
            "app.services.deep_scan.find_recording_id_by_text",
            fake_find_recording_id_by_text,
        )
        monkeypatch.setattr(
            "app.services.deep_scan.find_recording_id_by_fingerprint",
            fake_find_recording_id_by_fingerprint,
        )
        monkeypatch.setattr(
            "app.services.deep_scan.fetch_recording_details",
            fake_fetch_recording_details,
        )

        result = deep_scan_track(db, track)
        db.commit()

        assert result.method_used == "acoustid_fingerprint"
        assert any("MusicBrainz text lookup failed" in warning for warning in result.warnings)

    finally:
        db.close()


def test_deep_scan_returns_clean_empty_result_when_both_paths_fail(monkeypatch):
    TestingSessionLocal = make_test_db()
    db = TestingSessionLocal()

    try:
        track = create_track(db)

        def fake_find_recording_id_by_text(track):
            return None

        def fake_find_recording_id_by_fingerprint(track):
            return None, None

        monkeypatch.setattr(
            "app.services.deep_scan.find_recording_id_by_text",
            fake_find_recording_id_by_text,
        )
        monkeypatch.setattr(
            "app.services.deep_scan.find_recording_id_by_fingerprint",
            fake_find_recording_id_by_fingerprint,
        )

        result = deep_scan_track(db, track)
        db.commit()

        assert result.method_used is None
        assert result.musicbrainz_recording_id is None
        assert result.applied_tags == []

    finally:
        db.close()


def test_deep_scan_adds_warning_when_acoustid_errors(monkeypatch):
    TestingSessionLocal = make_test_db()
    db = TestingSessionLocal()

    try:
        track = create_track(db)

        def fake_find_recording_id_by_text(track):
            return None

        def fake_find_recording_id_by_fingerprint(track):
            raise AcoustIDLookupError("fpcalc missing")

        monkeypatch.setattr(
            "app.services.deep_scan.find_recording_id_by_text",
            fake_find_recording_id_by_text,
        )
        monkeypatch.setattr(
            "app.services.deep_scan.find_recording_id_by_fingerprint",
            fake_find_recording_id_by_fingerprint,
        )

        result = deep_scan_track(db, track)
        db.commit()

        assert result.method_used is None
        assert result.applied_tags == []
        assert any("AcoustID lookup failed" in warning for warning in result.warnings)

    finally:
        db.close()


def test_deep_scan_adds_warning_when_musicbrainz_details_after_acoustid_fails(monkeypatch):
    TestingSessionLocal = make_test_db()
    db = TestingSessionLocal()

    try:
        track = create_track(db)

        def fake_find_recording_id_by_text(track):
            return None

        def fake_find_recording_id_by_fingerprint(track):
            return (
                "mbid-acoustid",
                {
                    "title": "Real Song",
                    "artists": [{"name": "Real Artist"}],
                },
            )

        def fake_fetch_recording_details(recording_id):
            raise MusicBrainzLookupError("detail fetch failed")

        monkeypatch.setattr(
            "app.services.deep_scan.find_recording_id_by_text",
            fake_find_recording_id_by_text,
        )
        monkeypatch.setattr(
            "app.services.deep_scan.find_recording_id_by_fingerprint",
            fake_find_recording_id_by_fingerprint,
        )
        monkeypatch.setattr(
            "app.services.deep_scan.fetch_recording_details",
            fake_fetch_recording_details,
        )

        result = deep_scan_track(db, track)
        db.commit()

        assert result.method_used is None
        assert result.applied_tags == []
        assert any("MusicBrainz lookup after AcoustID failed" in warning for warning in result.warnings)

    finally:
        db.close()


def test_deep_scan_preserves_manual_tags(monkeypatch):
    TestingSessionLocal = make_test_db()
    db = TestingSessionLocal()

    try:
        track = create_track(db)
        tag = Tag(name="chill", category="mood")
        db.add(tag)
        db.flush()

        manual_track_tag = TrackTag(
            track_id=track.id,
            tag_id=tag.id,
            source="manual",
            confidence=1.0,
        )
        db.add(manual_track_tag)
        db.commit()

        def fake_find_recording_id_by_text(track):
            return "mbid-text"

        def fake_fetch_recording_details(recording_id):
            return {
                "id": recording_id,
                "genre-list": [],
                "tag-list": [
                    {"name": "calm", "count": 20}
                ],
            }

        monkeypatch.setattr(
            "app.services.deep_scan.find_recording_id_by_text",
            fake_find_recording_id_by_text,
        )
        monkeypatch.setattr(
            "app.services.deep_scan.fetch_recording_details",
            fake_fetch_recording_details,
        )

        deep_scan_track(db, track)
        db.commit()

        saved = (
            db.query(TrackTag)
            .filter(
                TrackTag.track_id == track.id,
                TrackTag.tag_id == tag.id,
            )
            .first()
        )

        assert saved.source == "manual"
        assert saved.confidence == 1.0

    finally:
        db.close()


def test_deep_scan_upgrades_rule_tags(monkeypatch):
    TestingSessionLocal = make_test_db()
    db = TestingSessionLocal()

    try:
        track = create_track(db)
        tag = Tag(name="rap", category="genre")
        db.add(tag)
        db.flush()

        rule_track_tag = TrackTag(
            track_id=track.id,
            tag_id=tag.id,
            source="rule",
            confidence=0.6,
        )
        db.add(rule_track_tag)
        db.commit()

        def fake_find_recording_id_by_text(track):
            return "mbid-text"

        def fake_fetch_recording_details(recording_id):
            return fake_recording_details_with_rap(recording_id)

        monkeypatch.setattr(
            "app.services.deep_scan.find_recording_id_by_text",
            fake_find_recording_id_by_text,
        )
        monkeypatch.setattr(
            "app.services.deep_scan.fetch_recording_details",
            fake_fetch_recording_details,
        )

        deep_scan_track(db, track)
        db.commit()

        saved = (
            db.query(TrackTag)
            .filter(
                TrackTag.track_id == track.id,
                TrackTag.tag_id == tag.id,
            )
            .first()
        )

        assert saved.source == "musicbrainz"
        assert saved.confidence == 0.8

    finally:
        db.close()


def test_deep_scan_acoustid_fills_missing_metadata(monkeypatch):
    TestingSessionLocal = make_test_db()
    db = TestingSessionLocal()

    try:
        track = create_track(db, title=None, artist=None)

        def fake_find_recording_id_by_fingerprint(track):
            return (
                "mbid-acoustid",
                {
                    "title": "Real Song",
                    "artists": [{"name": "Real Artist"}],
                },
            )

        def fake_fetch_recording_details(recording_id):
            return fake_recording_details_with_rap(recording_id)

        monkeypatch.setattr(
            "app.services.deep_scan.find_recording_id_by_fingerprint",
            fake_find_recording_id_by_fingerprint,
        )
        monkeypatch.setattr(
            "app.services.deep_scan.fetch_recording_details",
            fake_fetch_recording_details,
        )

        result = deep_scan_track(db, track)
        db.commit()

        assert result.method_used == "acoustid_fingerprint"
        assert track.display_title == "Real Song"
        assert track.display_artist == "Real Artist"

    finally:
        db.close()


def test_deep_scan_acoustid_does_not_overwrite_existing_metadata(monkeypatch):
    TestingSessionLocal = make_test_db()
    db = TestingSessionLocal()

    try:
        track = create_track(db, title="User Title", artist="User Artist")

        def fake_find_recording_id_by_text(track):
            return None

        def fake_find_recording_id_by_fingerprint(track):
            return (
                "mbid-acoustid",
                {
                    "title": "Real Song",
                    "artists": [{"name": "Real Artist"}],
                },
            )

        def fake_fetch_recording_details(recording_id):
            return fake_recording_details_with_rap(recording_id)

        monkeypatch.setattr(
            "app.services.deep_scan.find_recording_id_by_text",
            fake_find_recording_id_by_text,
        )
        monkeypatch.setattr(
            "app.services.deep_scan.find_recording_id_by_fingerprint",
            fake_find_recording_id_by_fingerprint,
        )
        monkeypatch.setattr(
            "app.services.deep_scan.fetch_recording_details",
            fake_fetch_recording_details,
        )

        result = deep_scan_track(db, track)
        db.commit()

        assert result.method_used == "acoustid_fingerprint"
        assert track.display_title == "User Title"
        assert track.display_artist == "User Artist"

    finally:
        db.close()