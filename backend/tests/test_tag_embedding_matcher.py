import sys
import types
from dataclasses import dataclass

import numpy as np


class FakeSentenceTransformer:
    def __init__(self, model_name):
        self.model_name = model_name

    def encode(self, texts, normalize_embeddings=True):
        return np.ones((len(texts), 2))


fake_sentence_transformers = types.ModuleType("sentence_transformers")
fake_sentence_transformers.SentenceTransformer = FakeSentenceTransformer
sys.modules.setdefault("sentence_transformers", fake_sentence_transformers)

from app.services.embeddings.embedding_models import TrackEmbeddingInput
from app.services.embeddings import tag_embedding_matcher
from app.services.embeddings.tag_embedding_matcher import (
    build_track_embedding_text,
    generate_embedding_tag_candidates,
)


@dataclass(frozen=True)
class FakeTagCandidate:
    tag_name: str
    confidence: float
    source: str = "rule"
    reason: str | None = None


def test_build_track_embedding_text_includes_track_fields_and_existing_tags():
    track = TrackEmbeddingInput(
        title="Midnight Drive",
        artist="Test Artist",
        album="Night Roads",
        filename="midnight_drive.mp3",
        folder_path="S:/Music/Night",
        existing_tags=["driving", "chill"],
        bpm=124.0,
        energy_label="medium",
        loudness=-8.5,
    )

    text = build_track_embedding_text(track)

    assert "Midnight Drive" in text
    assert "Test Artist" in text
    assert "Night Roads" in text
    assert "midnight_drive.mp3" in text
    assert "S:/Music/Night" in text
    assert "driving" in text
    assert "chill" in text
    assert "124.0" in text
    assert "medium" in text
    assert "-8.5" in text


def test_generate_embedding_tag_candidates_returns_tag_candidates(monkeypatch):
    def fake_encode_texts(texts):
        return np.ones((len(texts), 2))

    monkeypatch.setattr(tag_embedding_matcher, "encode_texts", fake_encode_texts)
    monkeypatch.setattr(tag_embedding_matcher, "TagCandidate", FakeTagCandidate)

    track = TrackEmbeddingInput(title="lofi study beat")
    candidates = generate_embedding_tag_candidates(track)

    assert candidates
    assert all(isinstance(candidate, FakeTagCandidate) for candidate in candidates)
    assert all(candidate.source == "embedding" for candidate in candidates)
    assert all(candidate.reason for candidate in candidates)


def test_generate_embedding_tag_candidates_returns_empty_list_for_empty_track(monkeypatch):
    def fail_encode_texts(texts):
        raise AssertionError("encode_texts should not be called for empty input")

    monkeypatch.setattr(tag_embedding_matcher, "encode_texts", fail_encode_texts)

    assert generate_embedding_tag_candidates(TrackEmbeddingInput()) == []
