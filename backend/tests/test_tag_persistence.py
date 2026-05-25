from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.tag import Tag
from app.services.tag_persistence import (
    ensure_controlled_tag_exists,
    get_tag_by_name,
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


def test_get_tag_by_name_returns_existing_tag():
    TestingSessionLocal = make_test_db()
    db = TestingSessionLocal()

    try:
        existing = Tag(name="chill", category="mood")
        db.add(existing)
        db.commit()

        tag = get_tag_by_name(db, "chill")

        assert tag is not None
        assert tag.id == existing.id
        assert tag.name == "chill"
    finally:
        db.close()


def test_ensure_controlled_tag_exists_returns_existing_tag():
    TestingSessionLocal = make_test_db()
    db = TestingSessionLocal()

    try:
        existing = Tag(name="chill", category="mood")
        db.add(existing)
        db.commit()

        tag = ensure_controlled_tag_exists(db, "chill")

        assert tag is not None
        assert tag.id == existing.id
        assert db.query(Tag).count() == 1
    finally:
        db.close()


def test_ensure_controlled_tag_exists_creates_known_rule_tag_without_commit():
    TestingSessionLocal = make_test_db()
    db = TestingSessionLocal()

    try:
        tag = ensure_controlled_tag_exists(db, "chill")

        assert tag is not None
        assert tag.id is not None
        assert tag.name == "chill"
        assert tag.category == "mood"
        assert db.query(Tag).filter(Tag.name == "chill").first() is tag
    finally:
        db.close()


def test_ensure_controlled_tag_exists_returns_none_for_unknown_tag():
    TestingSessionLocal = make_test_db()
    db = TestingSessionLocal()

    try:
        tag = ensure_controlled_tag_exists(db, "not_a_controlled_tag")

        assert tag is None
        assert db.query(Tag).count() == 0
    finally:
        db.close()
