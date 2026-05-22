from app.models.tag import Tag
from app.models.tag_reference_track import TagReferenceTrack
from app.models.track import Track


def create_tag(db_session, name, category="activity"):
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


def create_global_suggestion_setup(db_session):
    workout = create_tag(db_session, "workout")
    study = create_tag(db_session, "study")
    chill = create_tag(db_session, "chill")

    workout_reference = create_track(
        db_session,
        "workout-reference",
        bpm=120,
        energy_score=0.8,
        duration=200,
    )
    study_reference = create_track(
        db_session,
        "study-reference",
        bpm=80,
        energy_score=0.2,
        duration=240,
    )
    chill_negative = create_track(
        db_session,
        "chill-negative",
        bpm=70,
        energy_score=0.1,
        duration=220,
    )

    add_reference(db_session, workout, workout_reference, "positive")
    add_reference(db_session, study, study_reference, "positive")
    add_reference(db_session, chill, chill_negative, "negative")

    workout_candidate = create_track(
        db_session,
        "workout-candidate",
        bpm=120,
        energy_score=0.8,
        duration=200,
    )
    study_candidate = create_track(
        db_session,
        "study-candidate",
        bpm=85,
        energy_score=0.3,
        duration=250,
    )
    low_candidate = create_track(
        db_session,
        "low-candidate",
        bpm=180,
        energy_score=0.0,
        duration=500,
    )

    return {
        "workout": workout,
        "study": study,
        "chill": chill,
        "workout_candidate": workout_candidate,
        "study_candidate": study_candidate,
        "low_candidate": low_candidate,
    }


def test_global_reference_suggestions_return_suggestions_across_multiple_tags(
    client,
    db_session,
):
    setup = create_global_suggestion_setup(db_session)

    response = client.get(
        "/reference-suggestions",
        params={"min_score": 0.65},
    )

    assert response.status_code == 200

    data = response.json()
    pairs = {
        (suggestion["tag_id"], suggestion["track_id"])
        for suggestion in data
    }

    assert (
        setup["workout"].id,
        setup["workout_candidate"].id,
    ) in pairs
    assert (
        setup["study"].id,
        setup["study_candidate"].id,
    ) in pairs


def test_global_reference_suggestions_include_tag_name(client, db_session):
    setup = create_global_suggestion_setup(db_session)

    response = client.get(
        "/reference-suggestions",
        params={"min_score": 0.65},
    )

    assert response.status_code == 200

    data = response.json()
    workout_suggestion = next(
        suggestion
        for suggestion in data
        if suggestion["tag_id"] == setup["workout"].id
        and suggestion["track_id"] == setup["workout_candidate"].id
    )

    assert workout_suggestion["tag_name"] == "workout"


def test_global_reference_suggestions_sort_by_final_score_descending(
    client,
    db_session,
):
    create_global_suggestion_setup(db_session)

    response = client.get(
        "/reference-suggestions",
        params={"min_score": 0.65},
    )

    assert response.status_code == 200

    scores = [
        suggestion["final_score"]
        for suggestion in response.json()
    ]

    assert scores == sorted(scores, reverse=True)


def test_global_reference_suggestions_respect_global_limit(client, db_session):
    create_global_suggestion_setup(db_session)

    response = client.get(
        "/reference-suggestions",
        params={"limit": 1, "min_score": 0.65},
    )

    assert response.status_code == 200
    assert len(response.json()) == 1


def test_global_reference_suggestions_respect_min_score(client, db_session):
    setup = create_global_suggestion_setup(db_session)

    response = client.get(
        "/reference-suggestions",
        params={"min_score": 0.95},
    )

    assert response.status_code == 200

    data = response.json()
    assert [
        suggestion["track_id"]
        for suggestion in data
    ] == [setup["workout_candidate"].id]


def test_global_reference_suggestions_skip_tags_without_positive_references(
    client,
    db_session,
):
    setup = create_global_suggestion_setup(db_session)

    response = client.get(
        "/reference-suggestions",
        params={"min_score": 0.0},
    )

    assert response.status_code == 200

    tag_ids = {
        suggestion["tag_id"]
        for suggestion in response.json()
    }

    assert setup["chill"].id not in tag_ids


def test_global_reference_suggestions_preserve_per_tag_suggestion_response(
    client,
    db_session,
):
    setup = create_global_suggestion_setup(db_session)

    response = client.get(
        f"/tags/{setup['workout'].id}/reference-suggestions",
        params={"min_score": 0.65},
    )

    assert response.status_code == 200

    data = response.json()

    assert data
    assert "tag_name" not in data[0]
    assert any(
        suggestion["track_id"] == setup["workout_candidate"].id
        for suggestion in data
    )
