from app.models.tag import Tag
from app.models.track import Track
from app.models.track_tag import TrackTag
from app.routes import ai_playlists as ai_playlists_route
from app.models.playlist import Playlist
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


def test_generate_ai_playlist_empty_prompt_returns_422(client):
    """
    Validation behavior:
    - empty prompts are rejected before generation
    """
    response = client.post(
        "/ai_playlists/generate",
        json={"prompt": "", "limit": 10},
    )

    assert response.status_code == 422


def test_generate_ai_playlist_short_prompt_returns_422(
    client,
):
    """
    Validation behavior:
    - backend now matches the frontend's minimum prompt length expectation
    """
    response = client.post(
        "/ai_playlists/generate",
        json={"prompt": "chill", "limit": 10},
    )

    assert response.status_code == 422


def test_generate_ai_playlist_too_long_prompt_returns_422(client):
    response = client.post(
        "/ai_playlists/generate",
        json={"prompt": "a" * 501, "limit": 10},
    )

    assert response.status_code == 422


def test_generate_ai_playlist_trims_prompt_before_validation(
    client,
    db_session,
    tmp_path,
):
    track = create_tagged_track(db_session, tmp_path, ["chill", "study"])

    response = client.post(
        "/ai_playlists/generate",
        json={"prompt": "   chill study playlist   ", "limit": 10},
    )

    assert response.status_code == 200
    assert response.json()["prompt"] == "chill study playlist"
    assert [item["id"] for item in response.json()["tracks"]] == [track.id]


def test_generate_ai_playlist_rolls_back_playlist_when_add_tracks_fails(
    client,
    db_session,
    tmp_path,
    monkeypatch,
):
    create_tagged_track(db_session, tmp_path, ["chill", "study"])
    private_path = "C:/Private/Music/song.mp3"

    def fail_add_tracks_to_playlist(*_args, **_kwargs):
        raise RuntimeError(f"forced add tracks failure near {private_path}")

    monkeypatch.setattr(
        ai_playlists_route,
        "add_tracks_to_playlist",
        fail_add_tracks_to_playlist,
    )

    response = client.post(
        "/ai_playlists/generate",
        json={"prompt": "chill study playlist", "limit": 10},
    )

    assert response.status_code == 500
    assert response.json()["detail"] == "Failed to generate playlist"
    assert private_path not in response.text
    assert "forced add tracks failure" not in response.text
    assert db_session.query(Playlist).count() == 0
