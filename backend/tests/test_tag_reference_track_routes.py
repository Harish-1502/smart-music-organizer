from app.models.tag import Tag
from app.models.tag_reference_track import TagReferenceTrack
from app.models.track import Track
from app.models.track_tag import TrackTag


def create_tag(db_session, name="workout", category="activity"):
    tag = Tag(name=name, category=category)
    db_session.add(tag)
    db_session.commit()
    db_session.refresh(tag)

    return tag


def create_track(
    db_session,
    title="Reference Song",
    artist="Reference Artist",
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
        display_artist=artist,
        bpm=bpm,
        energy_score=energy_score,
        duration=duration,
    )
    db_session.add(track)
    db_session.commit()
    db_session.refresh(track)

    return track


def test_get_returns_references_for_tag(client, db_session):
    tag = create_tag(db_session)
    track = create_track(db_session)
    reference = TagReferenceTrack(
        tag_id=tag.id,
        track_id=track.id,
        label="positive",
        source="manual_reference",
    )
    db_session.add(reference)
    db_session.commit()

    response = client.get(f"/tags/{tag.id}/reference-tracks")

    assert response.status_code == 200

    data = response.json()

    assert len(data) == 1
    assert data[0]["id"] == reference.id
    assert data[0]["tag_id"] == tag.id
    assert data[0]["track_id"] == track.id
    assert data[0]["label"] == "positive"
    assert data[0]["source"] == "manual_reference"
    assert data[0]["track_title"] == "Reference Song"
    assert data[0]["track_artist"] == "Reference Artist"
    assert data[0]["track_file_name"] == "Reference Song.mp3"
    assert data[0]["created_at"] is not None


def test_post_creates_positive_reference(client, db_session):
    tag = create_tag(db_session)
    track = create_track(db_session)

    response = client.post(
        f"/tags/{tag.id}/reference-tracks",
        json={"track_id": track.id, "label": "positive"},
    )

    assert response.status_code == 200

    data = response.json()

    assert data["tag_id"] == tag.id
    assert data["track_id"] == track.id
    assert data["label"] == "positive"
    assert data["source"] == "manual_reference"
    assert db_session.query(TagReferenceTrack).count() == 1


def test_post_creates_negative_reference(client, db_session):
    tag = create_tag(db_session)
    track = create_track(db_session)

    response = client.post(
        f"/tags/{tag.id}/reference-tracks",
        json={
            "track_id": track.id,
            "label": "negative",
            "source": "manual_reference",
        },
    )

    assert response.status_code == 200
    assert response.json()["label"] == "negative"
    assert db_session.query(TagReferenceTrack).count() == 1


def test_post_invalid_label_returns_422(client, db_session):
    tag = create_tag(db_session)
    track = create_track(db_session)

    response = client.post(
        f"/tags/{tag.id}/reference-tracks",
        json={"track_id": track.id, "label": "maybe"},
    )

    assert response.status_code == 422
    assert db_session.query(TagReferenceTrack).count() == 0


def test_post_missing_tag_returns_404(client, db_session):
    track = create_track(db_session)

    response = client.post(
        "/tags/999/reference-tracks",
        json={"track_id": track.id, "label": "positive"},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Tag not found"
    assert db_session.query(TagReferenceTrack).count() == 0


def test_post_missing_track_returns_404(client, db_session):
    tag = create_tag(db_session)

    response = client.post(
        f"/tags/{tag.id}/reference-tracks",
        json={"track_id": 999, "label": "positive"},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Track not found"
    assert db_session.query(TagReferenceTrack).count() == 0


def test_post_same_track_and_tag_updates_existing_reference(client, db_session):
    tag = create_tag(db_session)
    track = create_track(db_session)

    first_response = client.post(
        f"/tags/{tag.id}/reference-tracks",
        json={"track_id": track.id, "label": "positive"},
    )
    second_response = client.post(
        f"/tags/{tag.id}/reference-tracks",
        json={
            "track_id": track.id,
            "label": "negative",
            "source": "changed_mind",
        },
    )

    assert first_response.status_code == 200
    assert second_response.status_code == 200

    first_data = first_response.json()
    second_data = second_response.json()

    assert first_data["id"] == second_data["id"]
    assert second_data["label"] == "negative"
    assert second_data["source"] == "manual_reference"
    assert db_session.query(TagReferenceTrack).count() == 1


def test_post_ignores_arbitrary_manual_reference_source(client, db_session):
    tag = create_tag(db_session)
    track = create_track(db_session)

    response = client.post(
        f"/tags/{tag.id}/reference-tracks",
        json={
            "track_id": track.id,
            "label": "positive",
            "source": "not_a_controlled_source",
        },
    )

    assert response.status_code == 200

    data = response.json()
    saved_reference = db_session.query(TagReferenceTrack).one()

    assert data["source"] == "manual_reference"
    assert saved_reference.source == "manual_reference"


def test_delete_removes_reference(client, db_session):
    tag = create_tag(db_session)
    track = create_track(db_session)
    reference = TagReferenceTrack(
        tag_id=tag.id,
        track_id=track.id,
        label="positive",
    )
    db_session.add(reference)
    db_session.commit()

    response = client.delete(
        f"/tags/{tag.id}/reference-tracks",
        params={"track_id": track.id},
    )

    assert response.status_code == 200
    assert response.json() == {
        "message": "Tag reference track removed",
        "tag_id": tag.id,
        "track_id": track.id,
    }
    assert db_session.query(TagReferenceTrack).count() == 0


def test_delete_missing_reference_returns_404(client, db_session):
    tag = create_tag(db_session)
    track = create_track(db_session)

    response = client.delete(
        f"/tags/{tag.id}/reference-tracks",
        params={"track_id": track.id},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Tag reference track not found"


def test_get_reference_suggestions_returns_score_fields_and_reasons(client, db_session):
    tag = create_tag(db_session)
    positive = create_track(
        db_session,
        title="Royalty (Wiguez & Alltair Remix)",
        artist="Egzod",
        bpm=120,
        energy_score=0.8,
        duration=200,
    )
    candidate = create_track(
        db_session,
        title="Candidate",
        bpm=120,
        energy_score=0.8,
        duration=200,
    )
    reference = TagReferenceTrack(
        tag_id=tag.id,
        track_id=positive.id,
        label="positive",
    )
    db_session.add(reference)
    db_session.commit()

    response = client.get(
        f"/tags/{tag.id}/reference-suggestions",
        params={"min_score": 0.0},
    )

    assert response.status_code == 200

    data = response.json()

    assert len(data) == 1
    assert data[0]["track_id"] == candidate.id
    assert data[0]["tag_id"] == tag.id
    assert data[0]["title"] == "Candidate"
    assert data[0]["file_name"] == "Candidate.mp3"
    assert data[0]["final_score"] == 1.0
    assert data[0]["positive_score"] == 1.0
    assert data[0]["negative_score"] == 0.0
    assert data[0]["reasons"]
    assert any(
        "Royalty (Wiguez & Alltair Remix)" in reason
        for reason in data[0]["reasons"]
    )
    assert data[0]["positive_matches"][0]["track_id"] == positive.id
    assert data[0]["positive_matches"][0]["title"] == (
        "Royalty (Wiguez & Alltair Remix)"
    )
    assert data[0]["positive_matches"][0]["artist"] == "Egzod"
    assert data[0]["positive_matches"][0]["label"] == "positive"
    assert data[0]["negative_matches"] == []


def test_get_reference_suggestions_missing_tag_returns_404(client):
    response = client.get("/tags/999/reference-suggestions")

    assert response.status_code == 404


def test_accept_batch_applies_tag_to_all_selected_tracks(client, db_session):
    tag = create_tag(db_session)
    first = create_track(db_session, title="Accept First")
    second = create_track(db_session, title="Accept Second")

    response = client.post(
        f"/tags/{tag.id}/reference-suggestions/accept-batch",
        json={"track_ids": [first.id, second.id]},
    )

    assert response.status_code == 200
    assert response.json()["accepted_count"] == 2
    assert response.json()["track_ids"] == [first.id, second.id]

    saved_track_tags = (
        db_session.query(TrackTag)
        .filter(TrackTag.tag_id == tag.id)
        .order_by(TrackTag.track_id.asc())
        .all()
    )

    assert [track_tag.track_id for track_tag in saved_track_tags] == [
        first.id,
        second.id,
    ]
    assert all(
        track_tag.source == "accepted_suggestion"
        for track_tag in saved_track_tags
    )
    assert all(track_tag.confidence == 1.0 for track_tag in saved_track_tags)


def test_accept_batch_stores_positive_reference_rows(client, db_session):
    tag = create_tag(db_session)
    first = create_track(db_session, title="Positive First")
    second = create_track(db_session, title="Positive Second")

    response = client.post(
        f"/tags/{tag.id}/reference-suggestions/accept-batch",
        json={"track_ids": [first.id, second.id]},
    )

    assert response.status_code == 200

    references = (
        db_session.query(TagReferenceTrack)
        .filter(TagReferenceTrack.tag_id == tag.id)
        .order_by(TagReferenceTrack.track_id.asc())
        .all()
    )

    assert [reference.track_id for reference in references] == [
        first.id,
        second.id,
    ]
    assert all(reference.label == "positive" for reference in references)
    assert all(
        reference.source == "accepted_suggestion"
        for reference in references
    )


def test_accept_batch_does_not_duplicate_track_tags(client, db_session):
    tag = create_tag(db_session)
    track = create_track(db_session, title="Already Tagged")
    existing_track_tag = TrackTag(
        tag_id=tag.id,
        track_id=track.id,
        source="manual",
        confidence=1.0,
    )
    db_session.add(existing_track_tag)
    db_session.commit()

    response = client.post(
        f"/tags/{tag.id}/reference-suggestions/accept-batch",
        json={"track_ids": [track.id]},
    )

    assert response.status_code == 200
    assert db_session.query(TrackTag).filter(TrackTag.tag_id == tag.id).count() == 1
    assert db_session.query(TrackTag).first().source == "manual"


def test_accept_after_previous_negative_switches_to_positive(client, db_session):
    tag = create_tag(db_session)
    track = create_track(db_session, title="Was Negative")
    reference = TagReferenceTrack(
        tag_id=tag.id,
        track_id=track.id,
        label="negative",
        source="rejected_suggestion",
    )
    db_session.add(reference)
    db_session.commit()

    response = client.post(
        f"/tags/{tag.id}/reference-suggestions/accept-batch",
        json={"track_ids": [track.id]},
    )

    assert response.status_code == 200

    saved_reference = db_session.query(TagReferenceTrack).one()

    assert saved_reference.id == reference.id
    assert saved_reference.label == "positive"
    assert saved_reference.source == "accepted_suggestion"


def test_reject_batch_does_not_apply_tags(client, db_session):
    tag = create_tag(db_session)
    first = create_track(db_session, title="Reject First")
    second = create_track(db_session, title="Reject Second")

    response = client.post(
        f"/tags/{tag.id}/reference-suggestions/reject-batch",
        json={"track_ids": [first.id, second.id]},
    )

    assert response.status_code == 200
    assert response.json()["rejected_count"] == 2
    assert response.json()["track_ids"] == [first.id, second.id]
    assert db_session.query(TrackTag).count() == 0


def test_reject_batch_stores_negative_reference_rows(client, db_session):
    tag = create_tag(db_session)
    first = create_track(db_session, title="Negative First")
    second = create_track(db_session, title="Negative Second")

    response = client.post(
        f"/tags/{tag.id}/reference-suggestions/reject-batch",
        json={"track_ids": [first.id, second.id]},
    )

    assert response.status_code == 200

    references = (
        db_session.query(TagReferenceTrack)
        .filter(TagReferenceTrack.tag_id == tag.id)
        .order_by(TagReferenceTrack.track_id.asc())
        .all()
    )

    assert [reference.track_id for reference in references] == [
        first.id,
        second.id,
    ]
    assert all(reference.label == "negative" for reference in references)
    assert all(
        reference.source == "rejected_suggestion"
        for reference in references
    )


def test_reject_after_previous_positive_switches_to_negative(client, db_session):
    tag = create_tag(db_session)
    track = create_track(db_session, title="Was Positive")
    reference = TagReferenceTrack(
        tag_id=tag.id,
        track_id=track.id,
        label="positive",
        source="accepted_suggestion",
    )
    db_session.add(reference)
    db_session.commit()

    response = client.post(
        f"/tags/{tag.id}/reference-suggestions/reject-batch",
        json={"track_ids": [track.id]},
    )

    assert response.status_code == 200

    saved_reference = db_session.query(TagReferenceTrack).one()

    assert saved_reference.id == reference.id
    assert saved_reference.label == "negative"
    assert saved_reference.source == "rejected_suggestion"


def test_reference_suggestion_batch_missing_tag_returns_404(client, db_session):
    track = create_track(db_session, title="Missing Tag Batch")

    response = client.post(
        "/tags/999/reference-suggestions/accept-batch",
        json={"track_ids": [track.id]},
    )

    assert response.status_code == 404


def test_reference_suggestion_batch_missing_track_returns_404(client, db_session):
    tag = create_tag(db_session)

    response = client.post(
        f"/tags/{tag.id}/reference-suggestions/reject-batch",
        json={"track_ids": [999]},
    )

    assert response.status_code == 404


def test_reference_suggestion_batch_empty_track_ids_returns_422(client, db_session):
    tag = create_tag(db_session)

    response = client.post(
        f"/tags/{tag.id}/reference-suggestions/accept-batch",
        json={"track_ids": []},
    )

    assert response.status_code == 422
