from fastapi.testclient import TestClient
from app.main import app
from app.models.track import Track
from app.services.scanner import scan_state

client = TestClient(app)

def test_get_scan_status():
    response = client.get("/library/scan-status")
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