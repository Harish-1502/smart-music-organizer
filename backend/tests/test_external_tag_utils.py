from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.track import Track
from app.models.tag import Tag
from app.models.track_tag import TrackTag
from app.services.external_tag_utils import (
    get_track_identity,
    has_usable_identity,
    normalize_external_tag,
    map_external_tag,
    confidence_from_count,
    extract_candidate_tags,
    ensure_tag_exists,
    apply_external_tag,
)


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


def create_track(db, title="Test Song", artist="Test Artist"):
    track = Track(
        file_path=f"S:/Music/{title}.mp3",
        file_name=f"{title}.mp3",
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


def test_get_track_identity_prefers_display_fields():
    track = Track(
        display_title="Display Title",
        display_artist="Display Artist",
        display_album="Display Album",
        title="Title",
        artist="Artist",
        album="Album",
        scanned_title="Scanned Title",
        scanned_artist="Scanned Artist",
        scanned_album="Scanned Album",
    )

    title, artist, album = get_track_identity(track)

    assert title == "Display Title"
    assert artist == "Display Artist"
    assert album == "Display Album"


def test_get_track_identity_falls_back_to_title_fields():
    track = Track(
        display_title=None,
        display_artist=None,
        display_album=None,
        title="Title",
        artist="Artist",
        album="Album",
        scanned_title="Scanned Title",
        scanned_artist="Scanned Artist",
        scanned_album="Scanned Album",
    )

    title, artist, album = get_track_identity(track)

    assert title == "Title"
    assert artist == "Artist"
    assert album == "Album"


def test_get_track_identity_falls_back_to_scanned_fields():
    track = Track(
        display_title=None,
        display_artist=None,
        display_album=None,
        title=None,
        artist=None,
        album=None,
        scanned_title="Scanned Title",
        scanned_artist="Scanned Artist",
        scanned_album="Scanned Album",
    )

    title, artist, album = get_track_identity(track)

    assert title == "Scanned Title"
    assert artist == "Scanned Artist"
    assert album == "Scanned Album"


def test_has_usable_identity_returns_true_for_title_and_artist():
    track = Track(display_title="Blinding Lights", display_artist="The Weeknd")

    assert has_usable_identity(track) is True


def test_has_usable_identity_returns_false_when_title_missing():
    track = Track(display_title=None, display_artist="The Weeknd")

    assert has_usable_identity(track) is False


def test_has_usable_identity_returns_false_when_artist_missing():
    track = Track(display_title="Blinding Lights", display_artist=None)

    assert has_usable_identity(track) is False


def test_has_usable_identity_returns_false_for_weak_title():
    track = Track(display_title="Track01", display_artist="The Weeknd")

    assert has_usable_identity(track) is False


def test_has_usable_identity_returns_false_for_weak_artist():
    track = Track(display_title="Blinding Lights", display_artist="Unknown Artist")

    assert has_usable_identity(track) is False


def test_normalize_external_tag():
    assert normalize_external_tag("Hip-Hop") == "hip hop"
    assert normalize_external_tag("lo_fi") == "lo fi"
    assert normalize_external_tag("  R&B  ") == "r&b"


def test_map_external_tag_maps_common_provider_tags():
    assert map_external_tag("hip-hop") == "rap"
    assert map_external_tag("hip hop") == "rap"
    assert map_external_tag("r&b") == "rnb"
    assert map_external_tag("lo-fi") == "lofi"
    assert map_external_tag("calm") == "chill"


def test_map_external_tag_keeps_internal_tag_names():
    assert map_external_tag("chill") == "chill"


def test_map_external_tag_ignores_unknown_tags():
    assert map_external_tag("seen live") is None
    assert map_external_tag("random provider tag") is None


def test_confidence_from_count():
    assert confidence_from_count(None) == 0.65
    assert confidence_from_count(0) == 0.65
    assert confidence_from_count(1) == 0.65
    assert confidence_from_count(3) == 0.70
    assert confidence_from_count(10) == 0.75
    assert confidence_from_count(20) == 0.80
    assert confidence_from_count(100) == 0.80


def test_extract_candidate_tags_maps_and_filters_external_tags():
    recording = {
        "genre-list": [
            {"name": "hip-hop", "count": 20},
            {"name": "pop", "count": 10},
        ],
        "tag-list": [
            {"name": "calm", "count": 5},
            {"name": "seen live", "count": 50},
        ],
    }

    result = extract_candidate_tags(recording)
    result_dict = dict(result)

    assert "rap" in result_dict
    assert "pop" in result_dict
    assert "chill" in result_dict
    assert "seen live" not in result_dict


def test_extract_candidate_tags_merges_duplicate_mapped_tags_with_highest_confidence():
    recording = {
        "genre-list": [
            {"name": "hip-hop", "count": 3},
        ],
        "tag-list": [
            {"name": "rap", "count": 20},
        ],
    }

    result = extract_candidate_tags(recording)
    result_dict = dict(result)

    assert result_dict["rap"] == 0.80


def test_ensure_tag_exists_returns_existing_tag():
    TestingSessionLocal = make_test_db()
    db = TestingSessionLocal()

    try:
        existing = Tag(name="chill", category="mood")
        db.add(existing)
        db.commit()

        tag = ensure_tag_exists(db, "chill")

        assert tag.id == existing.id
        assert tag.name == "chill"

    finally:
        db.close()


def test_ensure_tag_exists_creates_valid_missing_tag():
    TestingSessionLocal = make_test_db()
    db = TestingSessionLocal()

    try:
        tag = ensure_tag_exists(db, "chill")
        db.commit()

        saved = db.query(Tag).filter(Tag.name == "chill").first()

        assert tag is not None
        assert saved is not None
        assert saved.category == "mood"

    finally:
        db.close()


def test_ensure_tag_exists_ignores_unknown_tag():
    TestingSessionLocal = make_test_db()
    db = TestingSessionLocal()

    try:
        tag = ensure_tag_exists(db, "random_external_tag")
        db.commit()

        saved = db.query(Tag).filter(Tag.name == "random_external_tag").first()

        assert tag is None
        assert saved is None

    finally:
        db.close()


def test_apply_external_tag_creates_new_track_tag():
    TestingSessionLocal = make_test_db()
    db = TestingSessionLocal()

    try:
        track = create_track(db)

        track_tag = apply_external_tag(
            db=db,
            track=track,
            tag_name="chill",
            source="musicbrainz",
            confidence=0.75,
        )

        db.commit()

        assert track_tag is not None
        assert track_tag.source == "musicbrainz"
        assert track_tag.confidence == 0.75

        saved_tag = db.query(Tag).filter(Tag.name == "chill").first()
        assert saved_tag is not None

    finally:
        db.close()


def test_apply_external_tag_preserves_manual_tag():
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

        apply_external_tag(
            db=db,
            track=track,
            tag_name="chill",
            source="musicbrainz",
            confidence=0.75,
        )

        db.commit()

        saved = (
            db.query(TrackTag)
            .filter(TrackTag.track_id == track.id, TrackTag.tag_id == tag.id)
            .first()
        )

        assert saved.source == "manual"
        assert saved.confidence == 1.0

    finally:
        db.close()


def test_apply_external_tag_upgrades_rule_tag_to_musicbrainz():
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

        apply_external_tag(
            db=db,
            track=track,
            tag_name="rap",
            source="musicbrainz",
            confidence=0.8,
        )

        db.commit()

        saved = (
            db.query(TrackTag)
            .filter(TrackTag.track_id == track.id, TrackTag.tag_id == tag.id)
            .first()
        )

        assert saved.source == "musicbrainz"
        assert saved.confidence == 0.8

    finally:
        db.close()


def test_apply_external_tag_keeps_highest_confidence():
    TestingSessionLocal = make_test_db()
    db = TestingSessionLocal()

    try:
        track = create_track(db)
        tag = Tag(name="rap", category="genre")
        db.add(tag)
        db.flush()

        existing_track_tag = TrackTag(
            track_id=track.id,
            tag_id=tag.id,
            source="musicbrainz",
            confidence=0.8,
        )

        db.add(existing_track_tag)
        db.commit()

        apply_external_tag(
            db=db,
            track=track,
            tag_name="rap",
            source="musicbrainz",
            confidence=0.65,
        )

        db.commit()

        saved = (
            db.query(TrackTag)
            .filter(TrackTag.track_id == track.id, TrackTag.tag_id == tag.id)
            .first()
        )

        assert saved.confidence == 0.8

    finally:
        db.close()


def test_apply_external_tag_ignores_unknown_tag():
    TestingSessionLocal = make_test_db()
    db = TestingSessionLocal()

    try:
        track = create_track(db)

        result = apply_external_tag(
            db=db,
            track=track,
            tag_name="random_provider_tag",
            source="musicbrainz",
            confidence=0.8,
        )

        db.commit()

        assert result is None
        assert db.query(Tag).count() == 0
        assert db.query(TrackTag).count() == 0

    finally:
        db.close()