from app.models.playlist import Playlist
from app.routes import playlist as playlist_route


def test_create_playlist_trims_name(client):
    response = client.post("/playlists", json={"name": "  Road Mix  "})

    assert response.status_code == 200
    assert response.json()["name"] == "Road Mix"


def test_create_playlist_rejects_empty_name(client):
    response = client.post("/playlists", json={"name": "   "})

    assert response.status_code == 422


def test_create_playlist_rejects_too_long_name(client):
    response = client.post("/playlists", json={"name": "a" * 121})

    assert response.status_code == 422


def test_rename_playlist_rejects_empty_name(client, db_session):
    playlist = Playlist(name="Old Name")
    db_session.add(playlist)
    db_session.commit()
    db_session.refresh(playlist)

    response = client.patch(f"/playlists/{playlist.id}", json={"name": "   "})

    assert response.status_code == 422


def test_reorder_playlist_rejects_oversized_list(client):
    response = client.patch(
        "/playlists/1/reorder",
        json={"playlist_track_ids": list(range(1, 1002))},
    )

    assert response.status_code == 422


def test_reorder_playlist_rejects_non_positive_ids(client):
    response = client.patch(
        "/playlists/1/reorder",
        json={"playlist_track_ids": [1, 0, -2]},
    )

    assert response.status_code == 422


def test_create_playlist_unexpected_error_hides_raw_exception(client, monkeypatch):
    private_path = "C:/Private/Music/song.mp3"

    def fail_add_playlist(*_args, **_kwargs):
        raise RuntimeError(f"database failed near {private_path}")

    monkeypatch.setattr(playlist_route, "add_playlist", fail_add_playlist)

    response = client.post("/playlists", json={"name": "Road Mix"})

    assert response.status_code == 500
    assert response.json()["detail"] == "Failed to create playlist"
    assert private_path not in response.text
    assert "database failed" not in response.text
