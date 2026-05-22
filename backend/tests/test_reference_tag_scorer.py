from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.tag import Tag
from app.models.tag_reference_track import TagReferenceTrack
from app.models.track import Track
from app.models.track_tag import TrackTag
from app.services.tagging import reference_tag_scorer
from app.services.tagging.reference_scoring_profiles import (
    DEFAULT_FEATURE_SCALES,
    DEFAULT_REFERENCE_SCORING_PROFILE,
    REFERENCE_SCORING_PROFILES,
    ReferenceScoringProfile,
    get_reference_scoring_profile,
)
from app.services.tagging.reference_tag_scorer import (
    _track_audio_similarity,
    classify_reference_suggestion,
    score_track_against_tag_references,
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


def create_tag(db, name="workout"):
    tag = Tag(name=name, category="activity")
    db.add(tag)
    db.flush()

    return tag


def create_track(
    db,
    name,
    *,
    artist="Artist",
    bpm=None,
    energy_score=None,
    duration=None,
):
    track = Track(
        file_path=f"S:/Music/{name}.mp3",
        file_name=f"{name}.mp3",
        extension=".mp3",
        folder_path="S:/Music",
        display_title=name,
        display_artist=artist,
        bpm=bpm,
        energy_score=energy_score,
        duration=duration,
    )
    db.add(track)
    db.flush()

    return track


def add_reference(db, tag, track, label):
    reference = TagReferenceTrack(
        tag_id=tag.id,
        track_id=track.id,
        label=label,
    )
    db.add(reference)
    db.flush()

    return reference


def fake_embedding_encoder(texts):
    vectors = []

    for text in texts:
        normalized_text = text.lower()

        if "candidate" in normalized_text:
            vectors.append([1.0, 0.0])
        elif "positive" in normalized_text:
            vectors.append([1.0, 0.0])
        elif "negative" in normalized_text:
            vectors.append([1.0, 0.0])
        else:
            vectors.append([0.0, 1.0])

    return vectors


def test_no_positive_references_returns_score_zero_with_reason():
    TestingSessionLocal = make_test_db()
    db = TestingSessionLocal()

    try:
        tag = create_tag(db)
        candidate = create_track(db, "candidate", bpm=120, energy_score=0.8)
        negative = create_track(db, "negative", bpm=120, energy_score=0.8)
        add_reference(db, tag, negative, "negative")

        score = score_track_against_tag_references(db, candidate.id, tag.id)

        assert score.positive_score == 0.0
        assert score.final_score == 0.0
        assert "No positive references found" in score.reasons
    finally:
        db.close()


def test_reference_scoring_works_without_embeddings(monkeypatch):
    TestingSessionLocal = make_test_db()
    db = TestingSessionLocal()

    def fail_if_called(_texts):
        raise AssertionError("embeddings should not be used unless enabled")

    monkeypatch.setattr(
        reference_tag_scorer,
        "_encode_embedding_texts",
        fail_if_called,
    )

    try:
        tag = create_tag(db)
        candidate = create_track(db, "candidate", bpm=120, energy_score=0.8)
        positive = create_track(db, "positive", bpm=120, energy_score=0.8)
        add_reference(db, tag, positive, "positive")

        score = score_track_against_tag_references(db, candidate.id, tag.id)

        assert score.final_score > 0.9
    finally:
        db.close()


def test_close_positive_reference_increases_final_score():
    TestingSessionLocal = make_test_db()
    db = TestingSessionLocal()

    try:
        tag = create_tag(db)
        candidate = create_track(
            db,
            "candidate",
            bpm=120,
            energy_score=0.8,
            duration=200,
        )
        positive = create_track(
            db,
            "positive",
            artist="Reference Artist",
            bpm=122,
            energy_score=0.82,
            duration=205,
        )
        add_reference(db, tag, positive, "positive")

        score = score_track_against_tag_references(db, candidate.id, tag.id)

        assert score.positive_score > 0.9
        assert score.final_score > 0.9
        assert any(
            reason.startswith('Closest positive reference: "positive"')
            for reason in score.reasons
        )
        assert score.positive_matches[0].track_id == positive.id
        assert score.positive_matches[0].title == "positive"
        assert score.positive_matches[0].artist == "Reference Artist"
    finally:
        db.close()


def test_embedding_similarity_can_increase_score_for_close_positive_reference(
    monkeypatch,
):
    TestingSessionLocal = make_test_db()
    db = TestingSessionLocal()

    monkeypatch.setattr(
        reference_tag_scorer,
        "_encode_embedding_texts",
        fake_embedding_encoder,
    )

    try:
        tag = create_tag(db)
        candidate = create_track(db, "candidate")
        positive = create_track(db, "positive")
        add_reference(db, tag, positive, "positive")

        audio_only_score = score_track_against_tag_references(
            db,
            candidate.id,
            tag.id,
            include_embeddings=False,
        )
        score = score_track_against_tag_references(
            db,
            candidate.id,
            tag.id,
            include_embeddings=True,
        )

        assert audio_only_score.final_score == 0.0
        assert score.final_score > audio_only_score.final_score
        assert any(
            reason.startswith("Embedding positive similarity contributed")
            for reason in score.reasons
        )
    finally:
        db.close()


def test_closest_positive_match_uses_blended_similarity(monkeypatch):
    TestingSessionLocal = make_test_db()
    db = TestingSessionLocal()

    def fake_blended_encoder(texts):
        vectors = []

        for text in texts:
            normalized_text = text.lower()

            if "candidate" in normalized_text:
                vectors.append([1.0, 0.0])
            elif "semantic-positive" in normalized_text:
                vectors.append([1.0, 0.0])
            else:
                vectors.append([0.0, 1.0])

        return vectors

    monkeypatch.setattr(
        reference_tag_scorer,
        "_encode_embedding_texts",
        fake_blended_encoder,
    )

    try:
        tag = create_tag(db, name="workout")
        candidate = create_track(
            db,
            "candidate",
            bpm=100,
            energy_score=0.5,
            duration=200,
        )
        audio_positive = create_track(
            db,
            "audio-positive",
            bpm=100,
            energy_score=0.5,
            duration=200,
        )
        semantic_positive = create_track(
            db,
            "semantic-positive",
            bpm=180,
            energy_score=0.0,
            duration=600,
        )
        add_reference(db, tag, audio_positive, "positive")
        add_reference(db, tag, semantic_positive, "positive")

        score = score_track_against_tag_references(
            db,
            candidate.id,
            tag.id,
            top_k=1,
            include_embeddings=True,
        )

        closest_positive = score.positive_matches[0]

        assert closest_positive.track_id == semantic_positive.id
        assert closest_positive.title == "semantic-positive"
        assert closest_positive.similarity > closest_positive.audio_similarity
        assert closest_positive.embedding_similarity == 1.0
        assert any(
            reason.startswith(
                'Closest positive reference: "semantic-positive"'
            )
            for reason in score.reasons
        )
    finally:
        db.close()


def test_close_negative_reference_lowers_final_score():
    TestingSessionLocal = make_test_db()
    db = TestingSessionLocal()

    try:
        tag = create_tag(db)
        candidate = create_track(
            db,
            "candidate",
            bpm=120,
            energy_score=0.8,
            duration=200,
        )
        positive = create_track(
            db,
            "positive",
            bpm=120,
            energy_score=0.8,
            duration=200,
        )
        negative = create_track(
            db,
            "negative",
            artist="Skip Artist",
            bpm=121,
            energy_score=0.8,
            duration=202,
        )
        add_reference(db, tag, positive, "positive")
        add_reference(db, tag, negative, "negative")

        score = score_track_against_tag_references(db, candidate.id, tag.id)

        assert score.positive_score > 0.95
        assert score.negative_score > 0.95
        assert score.final_score < score.positive_score
        assert any(
            reason.startswith('Closest negative reference: "negative"')
            for reason in score.reasons
        )
        assert score.negative_matches[0].track_id == negative.id
        assert score.negative_matches[0].title == "negative"
        assert score.negative_matches[0].artist == "Skip Artist"
    finally:
        db.close()


def test_embedding_similarity_can_lower_score_for_close_negative_reference(
    monkeypatch,
):
    TestingSessionLocal = make_test_db()
    db = TestingSessionLocal()

    monkeypatch.setattr(
        reference_tag_scorer,
        "_encode_embedding_texts",
        fake_embedding_encoder,
    )

    try:
        tag = create_tag(db)
        candidate = create_track(db, "candidate")
        positive = create_track(db, "positive")
        negative = create_track(db, "negative")
        add_reference(db, tag, positive, "positive")
        add_reference(db, tag, negative, "negative")

        score = score_track_against_tag_references(
            db,
            candidate.id,
            tag.id,
            include_embeddings=True,
        )

        assert score.positive_score > 0.0
        assert score.negative_score > 0.0
        assert score.final_score < score.positive_score
        assert any(
            reason.startswith("Embedding negative similarity contributed")
            for reason in score.reasons
        )
    finally:
        db.close()


def test_top_k_is_used_instead_of_averaging_all_examples():
    TestingSessionLocal = make_test_db()
    db = TestingSessionLocal()

    try:
        tag = create_tag(db)
        candidate = create_track(
            db,
            "candidate",
            bpm=100,
            energy_score=0.5,
            duration=200,
        )
        close = create_track(db, "close", bpm=100, energy_score=0.5, duration=200)
        near = create_track(db, "near", bpm=110, energy_score=0.5, duration=200)
        far = create_track(db, "far", bpm=180, energy_score=0.0, duration=600)
        add_reference(db, tag, close, "positive")
        add_reference(db, tag, near, "positive")
        add_reference(db, tag, far, "positive")

        score = score_track_against_tag_references(
            db,
            candidate.id,
            tag.id,
            top_k=2,
        )

        assert score.positive_score > 0.9
        assert "Compared against 3 positive references" in score.reasons
    finally:
        db.close()


def test_weighted_audio_similarity_respects_feature_weights():
    profile = get_reference_scoring_profile("high_energy")
    candidate = Track(
        file_path="S:/Music/candidate.mp3",
        file_name="candidate.mp3",
        extension=".mp3",
        folder_path="S:/Music",
        bpm=120,
        energy_score=1.0,
        duration=180,
    )
    candidate.loudness_db = -5.0
    reference = Track(
        file_path="S:/Music/reference.mp3",
        file_name="reference.mp3",
        extension=".mp3",
        folder_path="S:/Music",
        bpm=120,
        energy_score=0.0,
        duration=999,
    )
    reference.loudness_db = -5.0

    score = _track_audio_similarity(candidate, reference, profile)

    assert score == 0.45


def test_audio_similarity_uses_bpm_energy_loudness_and_duration():
    profile = get_reference_scoring_profile("unknown")
    candidate = Track(
        file_path="S:/Music/candidate.mp3",
        file_name="candidate.mp3",
        extension=".mp3",
        folder_path="S:/Music",
        bpm=120,
        energy_score=1.0,
        duration=180,
    )
    candidate.loudness_db = -10.0
    reference = Track(
        file_path="S:/Music/reference.mp3",
        file_name="reference.mp3",
        extension=".mp3",
        folder_path="S:/Music",
        bpm=160,
        energy_score=0.0,
        duration=360,
    )
    reference.loudness_db = -40.0

    score = _track_audio_similarity(candidate, reference, profile)

    assert score == 0.0


def test_match_conflict_and_ranking_scores_are_reported():
    TestingSessionLocal = make_test_db()
    db = TestingSessionLocal()

    try:
        tag = create_tag(db, name="study")
        candidate = create_track(db, "candidate", bpm=120, energy_score=0.5)
        positive = create_track(db, "positive", bpm=120, energy_score=0.5)
        negative = create_track(db, "negative", bpm=120, energy_score=0.5)
        add_reference(db, tag, positive, "positive")
        add_reference(db, tag, negative, "negative")

        score = score_track_against_tag_references(
            db,
            candidate.id,
            tag.id,
            include_embeddings=False,
        )

        assert score.match_score == 1.0
        assert score.conflict_score == 1.0
        assert score.ranking_score == 0.7
        assert score.status == "review"
        assert score.positive_score == 1.0
        assert score.negative_score == 1.0
        assert score.final_score == score.ranking_score
    finally:
        db.close()


def test_classify_reference_suggestion_statuses():
    assert classify_reference_suggestion(0.80, 0.20) == "strong"
    assert classify_reference_suggestion(0.80, 0.70) == "review"
    assert classify_reference_suggestion(0.60, 0.80) == "conflict"
    assert classify_reference_suggestion(0.40, 0.0) == "weak"


def test_profile_top_k_is_used_when_top_k_is_not_explicit(monkeypatch):
    TestingSessionLocal = make_test_db()
    db = TestingSessionLocal()

    custom_profile = ReferenceScoringProfile(
        audio_weight=DEFAULT_REFERENCE_SCORING_PROFILE.audio_weight,
        embedding_weight=DEFAULT_REFERENCE_SCORING_PROFILE.embedding_weight,
        negative_weight=DEFAULT_REFERENCE_SCORING_PROFILE.negative_weight,
        conflict_ranking_weight=(
            DEFAULT_REFERENCE_SCORING_PROFILE.conflict_ranking_weight
        ),
        top_k=1,
        feature_scales=DEFAULT_FEATURE_SCALES,
        feature_weights=DEFAULT_REFERENCE_SCORING_PROFILE.feature_weights,
    )
    monkeypatch.setitem(REFERENCE_SCORING_PROFILES, "custom_topk", custom_profile)

    try:
        tag = create_tag(db, name="custom_topk")
        candidate = create_track(db, "candidate", bpm=120, energy_score=0.8)
        close = create_track(db, "close", bpm=120, energy_score=0.8)
        near = create_track(db, "near", bpm=125, energy_score=0.8)
        add_reference(db, tag, close, "positive")
        add_reference(db, tag, near, "positive")

        score = score_track_against_tag_references(
            db,
            candidate.id,
            tag.id,
            include_embeddings=False,
        )

        assert len(score.positive_matches) == 1
        assert score.positive_matches[0].title == "close"
    finally:
        db.close()


def test_explicit_top_k_overrides_profile_top_k(monkeypatch):
    TestingSessionLocal = make_test_db()
    db = TestingSessionLocal()

    custom_profile = ReferenceScoringProfile(
        audio_weight=DEFAULT_REFERENCE_SCORING_PROFILE.audio_weight,
        embedding_weight=DEFAULT_REFERENCE_SCORING_PROFILE.embedding_weight,
        negative_weight=DEFAULT_REFERENCE_SCORING_PROFILE.negative_weight,
        conflict_ranking_weight=(
            DEFAULT_REFERENCE_SCORING_PROFILE.conflict_ranking_weight
        ),
        top_k=1,
        feature_scales=DEFAULT_FEATURE_SCALES,
        feature_weights=DEFAULT_REFERENCE_SCORING_PROFILE.feature_weights,
    )
    monkeypatch.setitem(REFERENCE_SCORING_PROFILES, "custom_topk", custom_profile)

    try:
        tag = create_tag(db, name="custom_topk")
        candidate = create_track(db, "candidate", bpm=120, energy_score=0.8)
        close = create_track(db, "close", bpm=120, energy_score=0.8)
        near = create_track(db, "near", bpm=125, energy_score=0.8)
        add_reference(db, tag, close, "positive")
        add_reference(db, tag, near, "positive")

        score = score_track_against_tag_references(
            db,
            candidate.id,
            tag.id,
            top_k=2,
            include_embeddings=False,
        )

        assert len(score.positive_matches) == 2
    finally:
        db.close()


def test_embedding_failure_falls_back_to_audio_only_scoring(monkeypatch):
    TestingSessionLocal = make_test_db()
    db = TestingSessionLocal()

    def fail_encoding(_texts):
        raise ModuleNotFoundError("sentence_transformers")

    monkeypatch.setattr(
        reference_tag_scorer,
        "_encode_embedding_texts",
        fail_encoding,
    )

    try:
        tag = create_tag(db)
        candidate = create_track(db, "candidate", bpm=120, energy_score=0.8)
        positive = create_track(db, "positive", bpm=120, energy_score=0.8)
        add_reference(db, tag, positive, "positive")

        score = score_track_against_tag_references(
            db,
            candidate.id,
            tag.id,
            include_embeddings=True,
        )

        assert score.final_score > 0.9
        assert "Embedding similarity unavailable; used audio-only scoring" in score.reasons
    finally:
        db.close()


def test_missing_audio_fields_do_not_crash():
    TestingSessionLocal = make_test_db()
    db = TestingSessionLocal()

    try:
        tag = create_tag(db)
        candidate = create_track(db, "candidate")
        positive = create_track(db, "positive")
        add_reference(db, tag, positive, "positive")

        score = score_track_against_tag_references(db, candidate.id, tag.id)

        assert score.positive_score == 0.0
        assert score.final_score == 0.0
    finally:
        db.close()


def test_embedding_scoring_does_not_write_track_tags_or_reference_rows(
    monkeypatch,
):
    TestingSessionLocal = make_test_db()
    db = TestingSessionLocal()

    monkeypatch.setattr(
        reference_tag_scorer,
        "_encode_embedding_texts",
        fake_embedding_encoder,
    )

    try:
        tag = create_tag(db)
        candidate = create_track(db, "candidate")
        positive = create_track(db, "positive")
        add_reference(db, tag, positive, "positive")

        score_track_against_tag_references(
            db,
            candidate.id,
            tag.id,
            include_embeddings=True,
        )

        assert db.query(TrackTag).count() == 0
        assert db.query(TagReferenceTrack).count() == 1
    finally:
        db.close()


def test_final_score_is_clamped_between_zero_and_one():
    TestingSessionLocal = make_test_db()
    db = TestingSessionLocal()

    try:
        tag = create_tag(db)
        candidate = create_track(
            db,
            "candidate",
            bpm=120,
            energy_score=0.8,
            duration=200,
        )
        positive = create_track(
            db,
            "positive",
            bpm=200,
            energy_score=0.0,
            duration=800,
        )
        negative = create_track(
            db,
            "negative",
            bpm=120,
            energy_score=0.8,
            duration=200,
        )
        add_reference(db, tag, positive, "positive")
        add_reference(db, tag, negative, "negative")

        score = score_track_against_tag_references(db, candidate.id, tag.id)

        assert 0.0 <= score.positive_score <= 1.0
        assert 0.0 <= score.negative_score <= 1.0
        assert score.final_score == 0.0
    finally:
        db.close()


def test_candidate_track_itself_is_ignored_if_already_reference_for_tag():
    TestingSessionLocal = make_test_db()
    db = TestingSessionLocal()

    try:
        tag = create_tag(db)
        candidate = create_track(
            db,
            "candidate",
            bpm=120,
            energy_score=0.8,
            duration=200,
        )
        add_reference(db, tag, candidate, "positive")

        score = score_track_against_tag_references(db, candidate.id, tag.id)

        assert score.positive_score == 0.0
        assert score.final_score == 0.0
        assert "No positive references found" in score.reasons
    finally:
        db.close()
