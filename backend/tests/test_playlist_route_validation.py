from app.models.playlist import Playlist


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
