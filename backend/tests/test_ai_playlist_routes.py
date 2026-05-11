from app.models.tag import Tag
from app.models.track import Track
from app.models.track_tag import TrackTag
from app.routes import ai_playlists as ai_playlists_route
from app.services.prompt_parser import parse_prompt


def create_tagged_track(db_session, tmp_path, tag_names):
    audio_path = tmp_path / "chill-study.mp3"
    audio_path.write_bytes(b"fake audio")

    track = Track(
        file_path=str(audio_path),
        file_name="chill-study.mp3",
        extension=".mp3",
        folder_path=str(tmp_path),
        title="Chill Study",
        artist="Test Artist",
        album="Test Album",
        display_title="Chill Study",
        display_artist="Test Artist",
        display_album="Test Album",
        duration=180,
        metadata_source="test",
        user_edited=False,
    )
    db_session.add(track)
    db_session.flush()

    for tag_name in tag_names:
        tag = Tag(name=tag_name, category="test")
        db_session.add(tag)
        db_session.flush()
        db_session.add(
            TrackTag(
                track_id=track.id,
                tag_id=tag.id,
                source="manual",
                confidence=1.0,
            )
        )

    db_session.commit()
    db_session.refresh(track)
    return track


def test_ai_playlist_prompt_parser_service_current_behavior():
    """
    Current behavior:
    - prompt parsing exists as a service, not as a registered route
    """
    parsed = parse_prompt("chill study playlist under 45 minutes")

    assert parsed["duration_max_minutes"] == 45
    assert parsed["energy"] == "low"
    assert "study" in parsed["use_cases"]
    assert "chill" in parsed["moods"]


def test_ai_playlist_parse_route_is_not_registered_current_behavior(client):
    """
    Current behavior:
    - there is no /ai_playlists/parse endpoint registered
    """
    response = client.post(
        "/ai_playlists/parse",
        json={"prompt": "chill study playlist"},
    )

    assert response.status_code == 404


def test_generate_ai_playlist_creates_playlist_when_tagged_tracks_match(
    client,
    db_session,
    tmp_path,
):
    """
    Current behavior:
    - /ai_playlists/generate parses the prompt, finds tagged tracks,
      creates a playlist, and returns the generated playlist details
    """
    track = create_tagged_track(db_session, tmp_path, ["chill", "study"])

    response = client.post(
        "/ai_playlists/generate",
        json={"prompt": "chill study playlist under 45 minutes", "limit": 10},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["playlist_id"] is not None
    assert body["playlist_name"] == "Chill Study Under 45 Minutes Mix"
    assert body["parsed_rules"]["include_tags"]
    assert [item["id"] for item in body["tracks"]] == [track.id]


def test_generate_ai_playlist_returns_403_when_feature_flag_disabled(
    client,
    monkeypatch,
):
    """
    Feature flag behavior:
    - disabling ENABLE_AI_PLAYLISTS blocks the route before generation
    """
    monkeypatch.setattr(
        ai_playlists_route.settings,
        "enable_ai_playlists",
        False,
    )

    response = client.post(
        "/ai_playlists/generate",
        json={"prompt": "chill study playlist", "limit": 10},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "AI playlist generation is disabled."


def test_generate_ai_playlist_empty_prompt_returns_400(client):
    """
    Current behavior:
    - empty prompts are rejected by the parser and returned as HTTP 400
    """
    response = client.post(
        "/ai_playlists/generate",
        json={"prompt": "", "limit": 10},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Prompt cannot be empty."


def test_generate_ai_playlist_short_prompt_is_accepted_by_backend_current_behavior(
    client,
    db_session,
    tmp_path,
):
    """
    Current behavior:
    - the frontend rejects very short prompts, but the backend does not
      enforce a minimum prompt length when matching tracks exist
    """
    track = create_tagged_track(db_session, tmp_path, ["chill"])

    response = client.post(
        "/ai_playlists/generate",
        json={"prompt": "chill", "limit": 10},
    )

    assert response.status_code == 200
    assert [item["id"] for item in response.json()["tracks"]] == [track.id]
