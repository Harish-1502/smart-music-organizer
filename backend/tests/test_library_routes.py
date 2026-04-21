from fastapi.testclient import TestClient
from app.main import app
from app.models.track import Track
from app.services.scanner import reset_scan_state, scan_state

client = TestClient(app)

def test_get_scan_status():
    response = client.get("/library/scan_status")
    assert response.status_code == 200

    data = response.json()
    assert "status" in data
    assert "files_seen" in data

def test_post_scan_invalid_folder():
    response = client.post("/library/scan", json={
        "folder_path": "Z:\\does_not_exist"
    })

    assert response.status_code == 400
    assert "Folder does not exist" in response.json()["detail"]

    from app.models.track import Track
from app.services.scanner import scan_state

def test_clear_library(client, db_session):
    # Add fake tracks first
    track1 = Track(
        file_path="C:/Music/song1.mp3",
        file_name="song1.mp3",
        extension=".mp3",
        folder_path="C:/Music",
    )
    track2 = Track(
        file_path="C:/Music/song2.flac",
        file_name="song2.flac",
        extension=".flac",
        folder_path="C:/Music",
    )

    db_session.add_all([track1, track2])
    db_session.commit()

    # Set scan_state to non-default values to make sure reset works
    scan_state["status"] = "completed"
    scan_state["current_file"] = "C:/Music/song2.flac"
    scan_state["files_seen"] = 5
    scan_state["supported_found"] = 2
    scan_state["inserted"] = 2
    scan_state["duplicates"] = 1
    scan_state["failed"] = 1
    scan_state["last_error"] = "some error"

    # Call the route
    response = client.delete("/library/clear")

    assert response.status_code == 200

    data = response.json()
    assert data["message"] == "Library cleared"
    assert data["deleted_tracks"] == 2

    # Confirm DB is empty
    tracks = db_session.query(Track).all()
    assert len(tracks) == 0

    # Confirm scan_state reset
    assert scan_state["status"] == "idle"
    assert scan_state["current_file"] is None
    assert scan_state["files_seen"] == 0
    assert scan_state["supported_found"] == 0
    assert scan_state["inserted"] == 0
    assert scan_state["duplicates"] == 0
    assert scan_state["failed"] == 0
    assert scan_state["last_error"] is None

def test_post_scan_valid_folder_starts_scan(client, tmp_path, monkeypatch):
    """
    Test:
    - User posts a valid folder path to /library/scan

    Expected result:
    - API returns 200
    - response contains success message
    """
    reset_scan_state()

    music_dir = tmp_path / "Music"
    music_dir.mkdir()

    def fake_run_scan_library(_folder_path):
        return "Scan started"

    monkeypatch.setattr("app.routes.library.run_scan_library", fake_run_scan_library)

    response = client.post(
        "/library/scan",
        json={"folder_path": str(music_dir)},
    )

    assert response.status_code == 200
    assert response.json()["message"] == "Scan started"


def test_post_scan_invalid_folder_returns_400(client):
    """
    Test:
    - User posts a folder path that does not exist

    Expected result:
    - API returns 400
    """
    response = client.post(
        "/library/scan",
        json={"folder_path": "Z:/does_not_exist"},
    )

    assert response.status_code == 400


def test_get_scan_status_returns_expected_keys(client):
    """
    Test:
    - User requests current scan status

    Expected result:
    - API returns 200
    - response contains expected scan state keys
    """
    response = client.get("/library/scan_status")

    assert response.status_code == 200

    body = response.json()
    assert "status" in body
    assert "current_file" in body
    assert "files_seen" in body
    assert "supported_found" in body
    assert "inserted" in body
    assert "duplicates" in body
    assert "failed" in body
    assert "user_edited" in body
    assert "last_error" in body


def test_clear_library_deletes_tracks_and_resets_scan_state(client, db_session):
    """
    Test:
    - Tracks exist in DB
    - User calls /library/clear

    Expected result:
    - all tracks deleted
    - scan state reset
    """
    from app.models.track import Track

    track = Track(
        file_path="C:/music/song.mp3",
        file_name="song.mp3",
        extension=".mp3",
        folder_path="C:/music",
        title="Title",
        artist="Artist",
        album="Album",
        scanned_title="Title",
        scanned_artist="Artist",
        scanned_album="Album",
        display_title="Title",
        display_artist="Artist",
        display_album="Album",
        duration=123,
        metadata_source="tag",
        art_path=None,
        user_edited=False,
    )
    db_session.add(track)
    db_session.commit()

    response = client.delete("/library/clear")

    assert response.status_code == 200
    assert response.json()["deleted_tracks"] >= 1

    remaining = db_session.query(Track).count()
    assert remaining == 0