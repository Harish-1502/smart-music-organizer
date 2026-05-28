from app.models.track import Track
from app.core.config import settings


def set_lan_auth(monkeypatch, *, enabled: bool, token: str | None = None):
    monkeypatch.setattr(settings, "app_lan_mode", enabled)
    monkeypatch.setattr(settings, "api_auth_token", token)


def make_track_with_art(db_session, tmp_path):
    audio_path = tmp_path / "song.mp3"
    art_path = tmp_path / "cover.jpg"
    audio_path.write_bytes(b"fake audio")
    art_path.write_bytes(b"fake art")

    track = Track(
        file_path=str(audio_path),
        file_name="song.mp3",
        extension=".mp3",
        folder_path=str(tmp_path),
        title="Song",
        artist="Artist",
        album="Album",
        display_title="Song",
        display_artist="Artist",
        display_album="Album",
        metadata_source="test",
        art_path=str(art_path),
        user_edited=False,
    )
    db_session.add(track)
    db_session.commit()
    db_session.refresh(track)
    return track


def test_local_mode_does_not_require_api_token(client, monkeypatch):
    set_lan_auth(monkeypatch, enabled=False, token=None)

    response = client.get("/library/scan_status")

    assert response.status_code == 200


def test_lan_mode_rejects_missing_api_token(client, monkeypatch):
    set_lan_auth(monkeypatch, enabled=True, token="private-test-token")

    response = client.get("/library/scan_status")

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid or missing API token."
    assert "private-test-token" not in response.text


def test_lan_mode_rejects_wrong_api_token(client, monkeypatch):
    set_lan_auth(monkeypatch, enabled=True, token="private-test-token")

    response = client.get(
        "/library/scan_status",
        headers={"Authorization": "Bearer wrong-token"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid or missing API token."
    assert "private-test-token" not in response.text


def test_lan_mode_allows_correct_bearer_token(client, monkeypatch):
    set_lan_auth(monkeypatch, enabled=True, token="private-test-token")

    response = client.get(
        "/library/scan_status",
        headers={"Authorization": "Bearer private-test-token"},
    )

    assert response.status_code == 200


def test_lan_mode_allows_query_token_for_browser_media_requests(
    client,
    monkeypatch,
):
    set_lan_auth(monkeypatch, enabled=True, token="private-test-token")

    response = client.get("/tracks/999999/stream?api_token=private-test-token")

    assert response.status_code == 404


def test_lan_mode_allows_query_token_for_track_art_requests(
    client,
    db_session,
    tmp_path,
    monkeypatch,
):
    set_lan_auth(monkeypatch, enabled=True, token="private-test-token")
    track = make_track_with_art(db_session, tmp_path)

    response = client.get(f"/tracks/{track.id}/art?api_token=private-test-token")

    assert response.status_code == 200
    assert response.content == b"fake art"


def test_lan_mode_rejects_stream_without_token(client, monkeypatch):
    set_lan_auth(monkeypatch, enabled=True, token="private-test-token")

    response = client.get("/tracks/999999/stream")

    assert response.status_code == 401
