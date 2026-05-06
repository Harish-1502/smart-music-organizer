from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.track import Track
from app.models.tag import Tag
from app.models.track_tag import TrackTag
from app.services.tag_inference import apply_inferred_tags


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


def test_apply_inferred_tags_creates_rule_tags():
    TestingSessionLocal = make_test_db()
    db = TestingSessionLocal()

    try:
        track = Track(
            file_path="S:/Music/Study/lofi_chill_beats.mp3",
            file_name="lofi_chill_beats.mp3",
            extension=".mp3",
            folder_path="S:/Music/Study",
            display_title="lofi chill beats",
            duration=180,
        )

        db.add(track)
        db.commit()
        db.refresh(track)

        applied_tags = apply_inferred_tags(db, track)

        db.commit()

        assert len(applied_tags) > 0

        saved_track_tags = db.query(TrackTag).all()
        saved_tags = db.query(Tag).all()

        saved_tag_names = {tag.name for tag in saved_tags}

        assert "lofi" in saved_tag_names
        assert "chill" in saved_tag_names
        assert len(saved_track_tags) > 0

        for track_tag in saved_track_tags:
            assert track_tag.source == "rule"
            assert track_tag.confidence > 0

    finally:
        db.close()


def test_apply_inferred_tags_does_not_overwrite_manual_tag():
    TestingSessionLocal = make_test_db()
    db = TestingSessionLocal()

    try:
        track = Track(
            file_path="S:/Music/Study/lofi_chill_beats.mp3",
            file_name="lofi_chill_beats.mp3",
            extension=".mp3",
            folder_path="S:/Music/Study",
            display_title="lofi chill beats",
            duration=180,
        )

        tag = Tag(
            name="chill",
            category="mood",
        )

        db.add(track)
        db.add(tag)
        db.commit()
        db.refresh(track)
        db.refresh(tag)

        manual_track_tag = TrackTag(
            track_id=track.id,
            tag_id=tag.id,
            source="manual",
            confidence=1.0,
        )

        db.add(manual_track_tag)
        db.commit()

        apply_inferred_tags(db, track)
        db.commit()

        saved_track_tag = (
            db.query(TrackTag)
            .filter(
                TrackTag.track_id == track.id,
                TrackTag.tag_id == tag.id,
            )
            .first()
        )

        assert saved_track_tag.source == "manual"
        assert saved_track_tag.confidence == 1.0

    finally:
        db.close()