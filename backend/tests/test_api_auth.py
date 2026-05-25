from app.core.config import settings


def set_lan_auth(monkeypatch, *, enabled: bool, token: str | None = None):
    monkeypatch.setattr(settings, "app_lan_mode", enabled)
    monkeypatch.setattr(settings, "api_auth_token", token)


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


def test_lan_mode_rejects_stream_without_token(client, monkeypatch):
    set_lan_auth(monkeypatch, enabled=True, token="private-test-token")

    response = client.get("/tracks/999999/stream")

    assert response.status_code == 401
