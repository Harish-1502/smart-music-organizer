from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
BACKEND_DATA = BACKEND_ROOT / "data"
TRACK_ART_DIR = BACKEND_DATA / "track_art"


def test_static_does_not_serve_database_file(client):
    BACKEND_DATA.mkdir(parents=True, exist_ok=True)
    db_path = BACKEND_DATA / "app.db"
    created_for_test = False

    if not db_path.exists():
        db_path.write_bytes(b"private database canary")
        created_for_test = True

    try:
        response = client.get("/static/app.db")

        assert response.status_code == 404
    finally:
        if created_for_test and db_path.exists():
            db_path.unlink()


def test_static_track_art_still_serves_managed_artwork(client):
    artwork_path = TRACK_ART_DIR / "track_2.jpg"

    assert artwork_path.is_file()

    response = client.get("/static/track_art/track_2.jpg")

    assert response.status_code == 200
    assert response.content == artwork_path.read_bytes()
