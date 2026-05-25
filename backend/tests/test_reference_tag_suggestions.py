from app.models.tag import Tag
from app.models.tag_reference_track import TagReferenceTrack
from app.models.track import Track
from app.models.track_tag import TrackTag
from app.services.tagging import reference_tag_scorer
from app.services.tagging.reference_tag_scorer import (
    suggest_tracks_for_tag_from_references,
)


def create_tag(db_session, name="workout", category="activity"):
    tag = Tag(name=name, category=category)
    db_session.add(tag)
    db_session.commit()
    db_session.refresh(tag)

    return tag


def create_track(
    db_session,
    title,
    *,
    bpm=None,
    energy_score=None,
    duration=None,
):
    track = Track(
        file_path=f"S:/Music/{title}.mp3",
        file_name=f"{title}.mp3",
        extension=".mp3",
        folder_path="S:/Music",
        display_title=title,
        display_artist="Artist",
        bpm=bpm,
        energy_score=energy_score,
        duration=duration,
    )
    db_session.add(track)
    db_session.commit()
    db_session.refresh(track)

    return track


def add_reference(db_session, tag, track, label):
    reference = TagReferenceTrack(
        tag_id=tag.id,
        track_id=track.id,
        label=label,
    )
    db_session.add(reference)
    db_session.commit()
    db_session.refresh(reference)

    return reference


def add_track_tag(db_session, tag, track):
    track_tag = TrackTag(
        track_id=track.id,
        tag_id=tag.id,
        source="manual",
        confidence=1.0,
    )
    db_session.add(track_tag)
    db_session.commit()
    db_session.refresh(track_tag)

    return track_tag


def create_reference_setup(db_session):
    tag = create_tag(db_session)
    positive = create_track(
        db_session,
        "positive",
        bpm=120,
        energy_score=0.8,
        duration=200,
    )
    add_reference(db_session, tag, positive, "positive")

    return tag, positive


def test_suggestions_are_sorted_by_ranking_score_descending(db_session):
    tag, _positive = create_reference_setup(db_session)
    high = create_track(db_session, "high", bpm=120, energy_score=0.8, duration=200)
    medium = create_track(db_session, "medium", bpm=130, energy_score=0.75, duration=210)
    low = create_track(db_session, "low", bpm=180, energy_score=0.2, duration=300)

    suggestions = suggest_tracks_for_tag_from_references(
        db_session,
        tag.id,
        min_score=0.0,
    )

    assert [suggestion.track_id for suggestion in suggestions] == [
        high.id,
        medium.id,
        low.id,
    ]
    assert suggestions[0].ranking_score >= suggestions[1].ranking_score
    assert suggestions[1].ranking_score >= suggestions[2].ranking_score


def test_suggestions_respect_limit(db_session):
    tag, _positive = create_reference_setup(db_session)
    create_track(db_session, "first", bpm=120, energy_score=0.8, duration=200)
    create_track(db_session, "second", bpm=121, energy_score=0.8, duration=200)

    suggestions = suggest_tracks_for_tag_from_references(
        db_session,
        tag.id,
        limit=1,
        min_score=0.0,
    )

    assert len(suggestions) == 1


def test_suggestions_respect_min_score(db_session):
    tag, _positive = create_reference_setup(db_session)
    high = create_track(db_session, "high", bpm=120, energy_score=0.8, duration=200)
    create_track(db_session, "medium", bpm=130, energy_score=0.75, duration=210)

    suggestions = suggest_tracks_for_tag_from_references(
        db_session,
        tag.id,
        min_score=0.95,
    )

    assert [suggestion.track_id for suggestion in suggestions] == [high.id]


def test_suggestions_filter_min_score_by_match_not_ranking(db_session):
    tag, _positive = create_reference_setup(db_session)
    negative = create_track(
        db_session,
        "negative",
        bpm=120,
        energy_score=0.8,
        duration=200,
    )
    candidate = create_track(
        db_session,
        "candidate",
        bpm=120,
        energy_score=0.8,
        duration=200,
    )
    add_reference(db_session, tag, negative, "negative")

    suggestions = suggest_tracks_for_tag_from_references(
        db_session,
        tag.id,
        min_score=0.95,
        include_embeddings=False,
    )

    assert [suggestion.track_id for suggestion in suggestions] == [candidate.id]
    assert suggestions[0].match_score == 1.0
    assert suggestions[0].ranking_score < suggestions[0].match_score


def test_suggestions_sort_by_ranking_score_before_match_score(db_session):
    tag, _positive = create_reference_setup(db_session)
    negative = create_track(
        db_session,
        "negative",
        bpm=130,
        energy_score=0.8,
        duration=200,
    )
    clean = create_track(
        db_session,
        "clean",
        bpm=120,
        energy_score=0.8,
        duration=200,
    )
    ambiguous = create_track(
        db_session,
        "ambiguous",
        bpm=130,
        energy_score=0.8,
        duration=200,
    )
    add_reference(db_session, tag, negative, "negative")

    suggestions = suggest_tracks_for_tag_from_references(
        db_session,
        tag.id,
        min_score=0.0,
        include_embeddings=False,
    )

    assert [suggestion.track_id for suggestion in suggestions] == [
        clean.id,
        ambiguous.id,
    ]
    assert suggestions[0].ranking_score > suggestions[1].ranking_score


def test_suggestions_exclude_tracks_already_tagged_with_tag(db_session):
    tag, _positive = create_reference_setup(db_session)
    tagged = create_track(db_session, "tagged", bpm=120, energy_score=0.8, duration=200)
    candidate = create_track(db_session, "candidate", bpm=121, energy_score=0.8, duration=200)
    add_track_tag(db_session, tag, tagged)

    suggestions = suggest_tracks_for_tag_from_references(
        db_session,
        tag.id,
        min_score=0.0,
    )

    assert [suggestion.track_id for suggestion in suggestions] == [candidate.id]


def test_suggestions_exclude_positive_reference_tracks(db_session):
    tag, positive = create_reference_setup(db_session)
    candidate = create_track(db_session, "candidate", bpm=120, energy_score=0.8, duration=200)

    suggestions = suggest_tracks_for_tag_from_references(
        db_session,
        tag.id,
        min_score=0.0,
    )

    assert positive.id not in [suggestion.track_id for suggestion in suggestions]
    assert [suggestion.track_id for suggestion in suggestions] == [candidate.id]


def test_suggestions_exclude_negative_reference_tracks(db_session):
    tag, _positive = create_reference_setup(db_session)
    negative = create_track(db_session, "negative", bpm=80, energy_score=0.1, duration=400)
    candidate = create_track(db_session, "candidate", bpm=120, energy_score=0.8, duration=200)
    add_reference(db_session, tag, negative, "negative")

    suggestions = suggest_tracks_for_tag_from_references(
        db_session,
        tag.id,
        min_score=0.0,
    )

    assert negative.id not in [suggestion.track_id for suggestion in suggestions]
    assert [suggestion.track_id for suggestion in suggestions] == [candidate.id]


def test_suggestions_return_empty_list_when_no_positive_references_exist(db_session):
    tag = create_tag(db_session)
    create_track(db_session, "candidate", bpm=120, energy_score=0.8, duration=200)

    suggestions = suggest_tracks_for_tag_from_references(db_session, tag.id)

    assert suggestions == []


def test_suggestions_include_reasons_and_score_fields(db_session):
    tag, _positive = create_reference_setup(db_session)
    candidate = create_track(db_session, "candidate", bpm=120, energy_score=0.8, duration=200)

    suggestions = suggest_tracks_for_tag_from_references(
        db_session,
        tag.id,
        min_score=0.0,
    )

    assert len(suggestions) == 1
    suggestion = suggestions[0]
    assert suggestion.track_id == candidate.id
    assert suggestion.tag_id == tag.id
    assert suggestion.final_score == 1.0
    assert suggestion.match_score == 1.0
    assert suggestion.conflict_score == 0.0
    assert suggestion.ranking_score == suggestion.final_score
    assert suggestion.status == "strong"
    assert suggestion.positive_score == 1.0
    assert suggestion.negative_score == 0.0
    assert suggestion.reasons
    assert suggestion.positive_matches[0].title == "positive"
    assert any("positive" in reason for reason in suggestion.reasons)


def test_suggestions_preload_embeddings_in_one_batch(monkeypatch, db_session):
    calls = []

    def fake_encode_texts(texts):
        calls.append(list(texts))
        return [[1.0, 0.0] for _text in texts]

    monkeypatch.setattr(
        reference_tag_scorer,
        "_encode_embedding_texts",
        fake_encode_texts,
    )

    tag, _positive = create_reference_setup(db_session)
    first = create_track(
        db_session,
        "first",
        bpm=120,
        energy_score=0.8,
        duration=200,
    )
    second = create_track(
        db_session,
        "second",
        bpm=121,
        energy_score=0.8,
        duration=200,
    )

    suggestions = suggest_tracks_for_tag_from_references(
        db_session,
        tag.id,
        min_score=0.0,
        include_embeddings=True,
    )

    assert {suggestion.track_id for suggestion in suggestions} == {
        first.id,
        second.id,
    }
    assert len(calls) == 1
    assert len(calls[0]) == 3
