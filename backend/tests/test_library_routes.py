from fastapi.testclient import TestClient
from app.main import app

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