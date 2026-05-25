import builtins
import importlib
import sys
import types

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.track import Track
from app.models.track_tag import TrackTag
from app.services.tagging.tag_candidates import TagCandidate


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


def make_track(db):
    track = Track(
        file_path="S:/Music/rap_song.mp3",
        file_name="rap_song.mp3",
        extension=".mp3",
        folder_path="S:/Music",
        display_title="rap song",
        duration=180,
    )
    db.add(track)
    db.commit()
    db.refresh(track)

    return track


def test_importing_tag_inference_does_not_require_sentence_transformers(
    monkeypatch,
):
    original_import = builtins.__import__

    def blocked_import(name, *args, **kwargs):
        if name == "sentence_transformers" or name.startswith(
            "sentence_transformers."
        ):
            raise ModuleNotFoundError("blocked sentence_transformers import")

        return original_import(name, *args, **kwargs)

    for module_name in [
        "sentence_transformers",
        "app.services.tag_inference",
        "app.services.tagging.auto_apply",
        "app.services.embeddings.embedding_service",
        "app.services.embeddings.tag_embedding_matcher",
    ]:
        monkeypatch.delitem(sys.modules, module_name, raising=False)

    monkeypatch.setattr(builtins, "__import__", blocked_import)

    module = importlib.import_module("app.services.tag_inference")

    assert hasattr(module, "infer_track_tag_candidates")


def test_infer_track_tag_candidates_does_not_import_or_call_embeddings():
    from app.services import tag_inference

    assert not hasattr(tag_inference, "generate_embedding_tag_candidates")

    track = types.SimpleNamespace(
        display_title="lofi study beat",
        display_artist=None,
        display_album=None,
        title=None,
        artist=None,
        album=None,
        scanned_title=None,
        scanned_artist=None,
        scanned_album=None,
        file_name="lofi_study_beat.mp3",
        folder_path="S:/Music",
        duration=180,
        bpm=None,
        bpm_confidence=None,
        energy_label=None,
        energy_confidence=None,
    )

    candidates = tag_inference.infer_track_tag_candidates(track)

    assert candidates
    assert all(candidate.source == "rule" for candidate in candidates)


def test_apply_inferred_tags_ignores_embedding_candidates_above_threshold(
    monkeypatch,
):
    from app.services import tag_inference

    TestingSessionLocal = make_test_db()
    db = TestingSessionLocal()

    try:
        track = make_track(db)

        monkeypatch.setattr(
            tag_inference,
            "infer_track_tag_candidates",
            lambda _track: [
                TagCandidate(
                    tag_name="rap",
                    confidence=0.99,
                    source="embedding",
                )
            ],
        )

        applied_tags = tag_inference.apply_inferred_tags(db, track)
        db.commit()

        assert applied_tags == []
        assert db.query(TrackTag).count() == 0
    finally:
        db.close()


def test_scanner_does_not_call_embedding_candidates(monkeypatch, tmp_path, db_session):
    called = False

    def fail_if_called(_track):
        nonlocal called
        called = True
        raise AssertionError("scanner should not call embeddings")

    fake_embedding_matcher = types.ModuleType(
        "app.services.embeddings.tag_embedding_matcher"
    )
    fake_embedding_matcher.generate_embedding_tag_candidates = fail_if_called

    monkeypatch.setitem(
        sys.modules,
        "app.services.embeddings.tag_embedding_matcher",
        fake_embedding_matcher,
    )

    monkeypatch.delitem(sys.modules, "app.services.tag_inference", raising=False)
    monkeypatch.delitem(sys.modules, "app.services.scanner", raising=False)

    importlib.import_module("app.services.tag_inference")
    scanner = importlib.import_module("app.services.scanner")

    music_file = tmp_path / "song.mp3"
    music_file.write_bytes(b"fake audio bytes")

    def fake_extract_metadata(_path):
        return {
            "title": "Song",
            "artist": "Artist",
            "album": "Album",
            "duration": 180,
            "metadata_source": "tag",
        }

    monkeypatch.setattr(
        "app.services.scan_track_metadata.extract_metadata",
        fake_extract_metadata,
    )
    monkeypatch.setattr(
        "app.services.scan_track_metadata.detect_album_art",
        lambda _path: None,
    )
    monkeypatch.setattr(scanner, "analyze_track_audio", lambda _db, _track: None)

    scanner.scan_library(tmp_path, db_session)

    assert called is False
    assert db_session.query(Track).count() == 1
