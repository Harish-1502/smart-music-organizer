import pytest

from app.models.track import Track
from app.core.config import settings


def set_lan_auth(monkeypatch, *, enabled: bool, token: str | None = None):
    monkeypatch.setattr(settings, "app_lan_mode", enabled)
    monkeypatch.setattr(
        settings,
        "backend_host",
        "0.0.0.0" if enabled else "127.0.0.1",
    )
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


LAN_GATED_ROUTE_CASES = [
    ("GET", "/library/scan_status", None, 200),
    ("POST", "/library/scan", {"folder_path": "Z:/does_not_exist"}, 400),
    ("DELETE", "/library/clear", {"confirm": "CLEAR LIBRARY"}, 200),
    ("PATCH", "/tracks/999999", {"title": "New Title"}, 404),
    ("POST", "/playlists", {"name": "Mix"}, 200),
    ("PATCH", "/playlists/999999", {"name": "Renamed Mix"}, 400),
    ("DELETE", "/playlists/999999", None, 404),
    ("PATCH", "/playlists/999999/reorder", {"playlist_track_ids": [1, 2]}, 400),
    (
        "POST",
        "/ai_playlists/generate",
        {"prompt": "chill study playlist", "limit": 10},
        404,
    ),
    ("POST", "/tracks/999999/deep-scan", None, 404),
    ("POST", "/tags", {"name": "genre", "category": "test"}, 200),
    (
        "POST",
        "/tags/999999/reference-suggestions/accept-batch",
        {"track_ids": [1]},
        404,
    ),
    (
        "POST",
        "/tags/999999/reference-suggestions/reject-batch",
        {"track_ids": [1]},
        404,
    ),
    ("GET", "/tracks/999999/stream", None, 404),
    ("GET", "/tracks/999999/art", None, 404),
]


@pytest.mark.parametrize(
    "method,path,payload,expected_status",
    LAN_GATED_ROUTE_CASES,
)
def test_lan_mode_requires_token_on_protected_routes(
    client,
    monkeypatch,
    method,
    path,
    payload,
    expected_status,
):
    set_lan_auth(monkeypatch, enabled=True, token="private-test-token")

    if path.endswith("/deep-scan"):
        monkeypatch.setattr(settings, "enable_deep_scan", True)

    request_kwargs = {"headers": {"Authorization": "Bearer private-test-token"}}

    if payload is not None:
        request_kwargs["json"] = payload

    response = client.request(method, path, **request_kwargs)

    assert response.status_code == expected_status


@pytest.mark.parametrize(
    "method,path,payload",
    [
        ("GET", "/library/scan_status", None),
        ("POST", "/library/scan", {"folder_path": "Z:/does_not_exist"}),
        ("DELETE", "/library/clear", {"confirm": "CLEAR LIBRARY"}),
        ("PATCH", "/tracks/999999", {"title": "New Title"}),
        ("POST", "/playlists", {"name": "Mix"}),
        ("POST", "/ai_playlists/generate", {"prompt": "chill study playlist", "limit": 10}),
        ("POST", "/tracks/999999/deep-scan", None),
    ],
)
def test_local_mode_allows_protected_routes_without_token(
    client,
    monkeypatch,
    method,
    path,
    payload,
):
    set_lan_auth(monkeypatch, enabled=False, token=None)

    request_kwargs = {}

    if payload is not None:
        request_kwargs["json"] = payload

    response = client.request(method, path, **request_kwargs)

    assert response.status_code != 401
