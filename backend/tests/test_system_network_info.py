from app.core.config import settings
from app.services import network_info


def set_network_mode(monkeypatch, *, lan_mode: bool, token: str | None = None, port: int = 8000):
    monkeypatch.setattr(settings, "demo_mode", False)
    monkeypatch.setattr(settings, "app_lan_mode", lan_mode)
    monkeypatch.setattr(settings, "backend_host", "0.0.0.0" if lan_mode else "127.0.0.1")
    monkeypatch.setattr(settings, "backend_port", port)
    monkeypatch.setattr(settings, "api_auth_token", token)


def test_get_lan_ipv4_addresses_filters_invalid_addresses():
    assert network_info.get_lan_ipv4_addresses(
        [
            "127.0.0.1",
            "169.254.10.20",
            "0.0.0.0",
            "::1",
            "192.168.1.25",
            "10.0.0.7",
            "192.168.1.25",
        ]
    ) == ["192.168.1.25", "10.0.0.7"]


def test_network_info_local_mode_response_shape(client, monkeypatch):
    set_network_mode(monkeypatch, lan_mode=False, token=None, port=8123)
    monkeypatch.setattr(
        network_info,
        "discover_local_ipv4_addresses",
        lambda: ["192.168.1.25", "10.0.0.7"],
    )

    response = client.get("/system/network-info")

    assert response.status_code == 200
    body = response.json()
    assert body == {
        "demo_mode": False,
        "lan_mode": False,
        "backend_host": "127.0.0.1",
        "backend_port": 8123,
        "local_url": "http://localhost:8123",
        "lan_urls": [],
        "api_token_configured": False,
    }
    assert "api_auth_token" not in body


def test_network_info_lan_mode_requires_token(client, monkeypatch):
    set_network_mode(monkeypatch, lan_mode=True, token="lan-token", port=8000)

    response = client.get("/system/network-info")

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid or missing API token."


def test_network_info_lan_mode_rejects_invalid_token(client, monkeypatch):
    set_network_mode(monkeypatch, lan_mode=True, token="lan-token", port=8000)

    response = client.get(
        "/system/network-info",
        headers={"Authorization": "Bearer wrong-token"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid or missing API token."


def test_network_info_lan_mode_returns_filtered_urls_and_port(
    client,
    monkeypatch,
):
    set_network_mode(monkeypatch, lan_mode=True, token="lan-token", port=9001)
    monkeypatch.setattr(
        network_info,
        "discover_local_ipv4_addresses",
        lambda: [
            "127.0.0.1",
            "169.254.10.20",
            "0.0.0.0",
            "192.168.1.25",
            "10.0.0.7",
            "192.168.1.25",
        ],
    )

    response = client.get(
        "/system/network-info",
        headers={"Authorization": "Bearer lan-token"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["demo_mode"] is False
    assert body["lan_mode"] is True
    assert body["backend_host"] == "0.0.0.0"
    assert body["backend_port"] == 9001
    assert body["local_url"] == "http://localhost:9001"
    assert body["lan_urls"] == [
        "http://192.168.1.25:9001",
        "http://10.0.0.7:9001",
    ]
    assert body["api_token_configured"] is True
    assert "lan-token" not in response.text
