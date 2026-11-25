from app.services.playlist_generator import score_track
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.track import Track
from app.models.tag import Tag
from app.models.track_tag import TrackTag
from app.services.playlist_generator import generate_tracks_from_rules

class FakeTag:
    def __init__(self, name):
        self.name = name


class FakeTrackTag:
    def __init__(self, tag_name, source="rule", confidence=1.0):
        self.tag = FakeTag(tag_name)
        self.source = source
        self.confidence = confidence


def test_score_track_gives_points_for_matching_include_tag():
    track_tags = [
        FakeTrackTag("chill", source="rule", confidence=0.8),
    ]

    score = score_track(
        track_tags=track_tags,
        include_tags=["chill"],
        exclude_tags=[],
    )

    assert score == 8.0


def test_score_track_ignores_non_matching_tags():
    track_tags = [
        FakeTrackTag("sad", source="rule", confidence=0.8),
    ]

    score = score_track(
        track_tags=track_tags,
        include_tags=["chill"],
        exclude_tags=[],
    )

    assert score == 0


def test_score_track_adds_multiple_matching_tags():
    track_tags = [
        FakeTrackTag("chill", source="rule", confidence=0.8),
        FakeTrackTag("study", source="rule", confidence=0.7),
    ]

    score = score_track(
        track_tags=track_tags,
        include_tags=["chill", "study"],
        exclude_tags=[],
    )

    assert score == 15.0


def test_score_track_penalizes_excluded_tags():
    track_tags = [
        FakeTrackTag("chill", source="rule", confidence=0.8),
        FakeTrackTag("explicit", source="rule", confidence=1.0),
    ]

    score = score_track(
        track_tags=track_tags,
        include_tags=["chill"],
        exclude_tags=["explicit"],
    )

    assert score < 0


def test_score_track_manual_tags_score_higher_than_rule_tags():
    manual_tags = [
        FakeTrackTag("chill", source="manual", confidence=1.0),
    ]

    rule_tags = [
        FakeTrackTag("chill", source="rule", confidence=1.0),
    ]

    manual_score = score_track(
        track_tags=manual_tags,
        include_tags=["chill"],
        exclude_tags=[],
    )

    rule_score = score_track(
        track_tags=rule_tags,
        include_tags=["chill"],
        exclude_tags=[],
    )

    assert manual_score > rule_score

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


def create_track(db, file_name, title):
    track = Track(
        file_path=f"S:/Music/{file_name}",
        file_name=file_name,
        extension=".mp3",
        folder_path="S:/Music",
        title=title,
        artist="Test Artist",
        album="Test Album",
        display_title=title,
        display_artist="Test Artist",
        display_album="Test Album",
        duration=180,
        metadata_source="test",
        user_edited=False,
    )

    db.add(track)
    db.flush()

    return track


def create_tag(db, name, category):
    tag = Tag(
        name=name,
        category=category,
    )

    db.add(tag)
    db.flush()

    return tag


def attach_tag(db, track, tag, source="rule", confidence=1.0):
    track_tag = TrackTag(
        track_id=track.id,
        tag_id=tag.id,
        source=source,
        confidence=confidence,
    )

    db.add(track_tag)
    db.flush()

    return track_tag


def test_generate_tracks_from_rules_returns_matching_tracks():
    TestingSessionLocal = make_test_db()
    db = TestingSessionLocal()

    try:
        chill = create_tag(db, "chill", "mood")
        workout = create_tag(db, "workout", "activity")

        chill_track = create_track(db, "lofi_chill.mp3", "Lofi Chill")
        workout_track = create_track(db, "gym_song.mp3", "Gym Song")

        attach_tag(db, chill_track, chill, confidence=0.8)
        attach_tag(db, workout_track, workout, confidence=0.9)

        db.commit()

        results = generate_tracks_from_rules(
            db=db,
            include_tags=["chill"],
            exclude_tags=[],
            limit=20,
        )

        assert len(results) == 1
        assert results[0].id == chill_track.id

    finally:
        db.close()


def test_generate_tracks_from_rules_sorts_by_score():
    TestingSessionLocal = make_test_db()
    db = TestingSessionLocal()

    try:
        chill = create_tag(db, "chill", "mood")
        study = create_tag(db, "study", "activity")

        weaker_track = create_track(db, "chill_only.mp3", "Chill Only")
        stronger_track = create_track(db, "chill_study.mp3", "Chill Study")

        attach_tag(db, weaker_track, chill, confidence=0.7)

        attach_tag(db, stronger_track, chill, confidence=0.8)
        attach_tag(db, stronger_track, study, confidence=0.8)

        db.commit()

        results = generate_tracks_from_rules(
            db=db,
            include_tags=["chill", "study"],
            exclude_tags=[],
            limit=20,
        )

        assert len(results) == 2
        assert results[0].id == stronger_track.id
        assert results[1].id == weaker_track.id

    finally:
        db.close()


def test_generate_tracks_from_rules_respects_limit():
    TestingSessionLocal = make_test_db()
    db = TestingSessionLocal()

    try:
        chill = create_tag(db, "chill", "mood")

        for index in range(5):
            track = create_track(
                db,
                file_name=f"chill_{index}.mp3",
                title=f"Chill {index}",
            )
            attach_tag(db, track, chill, confidence=0.8)

        db.commit()

        results = generate_tracks_from_rules(
            db=db,
            include_tags=["chill"],
            exclude_tags=[],
            limit=3,
        )

        assert len(results) == 3

    finally:
        db.close()


def test_generate_tracks_from_rules_excludes_tracks_with_excluded_tag():
    TestingSessionLocal = make_test_db()
    db = TestingSessionLocal()

    try:
        chill = create_tag(db, "chill", "mood")
        explicit = create_tag(db, "explicit", "content")

        clean_chill_track = create_track(db, "clean_chill.mp3", "Clean Chill")
        explicit_chill_track = create_track(db, "explicit_chill.mp3", "Explicit Chill")

        attach_tag(db, clean_chill_track, chill, confidence=0.8)

        attach_tag(db, explicit_chill_track, chill, confidence=0.9)
        attach_tag(db, explicit_chill_track, explicit, confidence=1.0)

        db.commit()

        results = generate_tracks_from_rules(
            db=db,
            include_tags=["chill"],
            exclude_tags=["explicit"],
            limit=20,
        )

        result_ids = {track.id for track in results}

        assert clean_chill_track.id in result_ids
        assert explicit_chill_track.id not in result_ids

    finally:
        db.close()