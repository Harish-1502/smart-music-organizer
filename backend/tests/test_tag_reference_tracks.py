import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.tag import Tag
from app.models.tag_reference_track import TagReferenceTrack
from app.models.track import Track
from app.services.tag_reference_tracks import (
    add_or_update_tag_reference_track,
    list_reference_tracks_for_tag,
    list_reference_tracks_for_track,
    remove_tag_reference_track,
    validate_reference_label,
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


def create_tag_and_track(db):
    tag = Tag(name="workout", category="activity")
    track = Track(
        file_path="S:/Music/test_track.mp3",
        file_name="test_track.mp3",
        extension=".mp3",
        folder_path="S:/Music",
        display_title="Test Track",
    )

    db.add(tag)
    db.add(track)
    db.commit()
    db.refresh(tag)
    db.refresh(track)

    return tag, track


def test_adds_positive_reference():
    TestingSessionLocal = make_test_db()
    db = TestingSessionLocal()

    try:
        tag, track = create_tag_and_track(db)

        reference = add_or_update_tag_reference_track(
            db=db,
            tag_id=tag.id,
            track_id=track.id,
            label="positive",
        )

        assert reference.id is not None
        assert reference.label == "positive"
        assert reference.source == "manual_reference"
        assert reference.tag_id == tag.id
        assert reference.track_id == track.id
    finally:
        db.close()


def test_adds_negative_reference():
    TestingSessionLocal = make_test_db()
    db = TestingSessionLocal()

    try:
        tag, track = create_tag_and_track(db)

        reference = add_or_update_tag_reference_track(
            db=db,
            tag_id=tag.id,
            track_id=track.id,
            label="negative",
        )

        assert reference.label == "negative"
    finally:
        db.close()


def test_invalid_label_raises_error():
    with pytest.raises(ValueError):
        validate_reference_label("maybe")


def test_duplicate_add_does_not_create_duplicate_rows():
    TestingSessionLocal = make_test_db()
    db = TestingSessionLocal()

    try:
        tag, track = create_tag_and_track(db)

        first_reference = add_or_update_tag_reference_track(
            db=db,
            tag_id=tag.id,
            track_id=track.id,
            label="positive",
        )
        second_reference = add_or_update_tag_reference_track(
            db=db,
            tag_id=tag.id,
            track_id=track.id,
            label="positive",
        )

        assert first_reference.id == second_reference.id
        assert db.query(TagReferenceTrack).count() == 1
    finally:
        db.close()


def test_positive_after_negative_switches_label():
    TestingSessionLocal = make_test_db()
    db = TestingSessionLocal()

    try:
        tag, track = create_tag_and_track(db)

        reference = add_or_update_tag_reference_track(
            db=db,
            tag_id=tag.id,
            track_id=track.id,
            label="negative",
        )
        updated_reference = add_or_update_tag_reference_track(
            db=db,
            tag_id=tag.id,
            track_id=track.id,
            label="positive",
        )

        assert reference.id == updated_reference.id
        assert updated_reference.label == "positive"
        assert db.query(TagReferenceTrack).count() == 1
    finally:
        db.close()


def test_negative_after_positive_switches_label():
    TestingSessionLocal = make_test_db()
    db = TestingSessionLocal()

    try:
        tag, track = create_tag_and_track(db)

        reference = add_or_update_tag_reference_track(
            db=db,
            tag_id=tag.id,
            track_id=track.id,
            label="positive",
        )
        updated_reference = add_or_update_tag_reference_track(
            db=db,
            tag_id=tag.id,
            track_id=track.id,
            label="negative",
        )

        assert reference.id == updated_reference.id
        assert updated_reference.label == "negative"
        assert db.query(TagReferenceTrack).count() == 1
    finally:
        db.close()


def test_removing_reference_works():
    TestingSessionLocal = make_test_db()
    db = TestingSessionLocal()

    try:
        tag, track = create_tag_and_track(db)
        add_or_update_tag_reference_track(
            db=db,
            tag_id=tag.id,
            track_id=track.id,
            label="positive",
        )

        removed = remove_tag_reference_track(
            db=db,
            tag_id=tag.id,
            track_id=track.id,
        )

        assert removed is True
        assert db.query(TagReferenceTrack).count() == 0
    finally:
        db.close()


def test_listing_references_for_tag_works():
    TestingSessionLocal = make_test_db()
    db = TestingSessionLocal()

    try:
        tag, track = create_tag_and_track(db)
        add_or_update_tag_reference_track(
            db=db,
            tag_id=tag.id,
            track_id=track.id,
            label="positive",
        )

        references = list_reference_tracks_for_tag(db, tag.id)

        assert len(references) == 1
        assert references[0].tag_id == tag.id
        assert references[0].track_id == track.id
    finally:
        db.close()


def test_listing_references_for_track_works():
    TestingSessionLocal = make_test_db()
    db = TestingSessionLocal()

    try:
        tag, track = create_tag_and_track(db)
        add_or_update_tag_reference_track(
            db=db,
            tag_id=tag.id,
            track_id=track.id,
            label="positive",
        )

        references = list_reference_tracks_for_track(db, track.id)

        assert len(references) == 1
        assert references[0].tag_id == tag.id
        assert references[0].track_id == track.id
    finally:
        db.close()


def test_missing_tag_id_fails_safely():
    TestingSessionLocal = make_test_db()
    db = TestingSessionLocal()

    try:
        _, track = create_tag_and_track(db)

        with pytest.raises(ValueError):
            add_or_update_tag_reference_track(
                db=db,
                tag_id=999,
                track_id=track.id,
                label="positive",
            )

        assert db.query(TagReferenceTrack).count() == 0
    finally:
        db.close()


def test_missing_track_id_fails_safely():
    TestingSessionLocal = make_test_db()
    db = TestingSessionLocal()

    try:
        tag, _ = create_tag_and_track(db)

        with pytest.raises(ValueError):
            add_or_update_tag_reference_track(
                db=db,
                tag_id=tag.id,
                track_id=999,
                label="positive",
            )

        assert db.query(TagReferenceTrack).count() == 0
    finally:
        db.close()
