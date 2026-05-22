from app.routes import library as library_route
from app.models.track import Track


def make_track_with_art(db_session, tmp_path, art_path):
    audio_path = tmp_path / "song.mp3"
    audio_path.write_bytes(b"fake audio")

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


def test_library_art_returns_existing_stored_track_art_path(client, db_session, tmp_path):
    """
    Current behavior:
    - scanned artwork can live beside an audio file outside managed artwork dirs
    - compatibility is preserved when the path is stored as Track.art_path
    """
    image_path = tmp_path / "cover.jpg"
    image_bytes = b"fake image bytes"
    image_path.write_bytes(image_bytes)
    make_track_with_art(db_session, tmp_path, image_path)

    response = client.get("/library/art", params={"path": str(image_path)})

    assert response.status_code == 200
    assert response.content == image_bytes


def test_library_art_enabled_by_default_allows_managed_existing_path(
    client,
    tmp_path,
    monkeypatch,
):
    """
    Feature flag behavior:
    - ENABLE_LEGACY_ART_PATH_ROUTE defaults enabled, preserving current behavior
    """
    managed_dir = tmp_path / "managed"
    managed_dir.mkdir()
    monkeypatch.setattr(library_route.settings, "managed_static_dirs", [managed_dir])
    monkeypatch.setattr(library_route.settings, "managed_artwork_dir", managed_dir / "art")
    image_path = managed_dir / "cover-default.jpg"
    image_bytes = b"default enabled image bytes"
    image_path.write_bytes(image_bytes)

    response = client.get("/library/art", params={"path": str(image_path)})

    assert response.status_code == 200
    assert response.content == image_bytes


def test_library_art_returns_403_when_legacy_path_route_disabled(
    client,
    tmp_path,
    monkeypatch,
):
    """
    Feature flag behavior:
    - disabling ENABLE_LEGACY_ART_PATH_ROUTE blocks the raw path route
    """
    image_path = tmp_path / "cover-disabled.jpg"
    image_path.write_bytes(b"should not be returned")
    monkeypatch.setattr(
        library_route.settings,
        "enable_legacy_art_path_route",
        False,
    )

    response = client.get("/library/art", params={"path": str(image_path)})

    assert response.status_code == 403
    assert response.json()["detail"] == "Legacy artwork path access is disabled."


def test_library_art_returns_404_for_missing_path(client, tmp_path):
    """
    Current behavior:
    - missing raw filesystem paths return 404
    """
    missing_path = tmp_path / "missing.jpg"

    response = client.get("/library/art", params={"path": str(missing_path)})

    assert response.status_code == 404
    assert response.json()["detail"] == "Image not found"


def test_library_art_blocks_arbitrary_existing_local_file(
    client,
    tmp_path,
):
    """
    Hardened behavior:
    - the endpoint is named for artwork
    - arbitrary local files are no longer returned
    """
    arbitrary_file = tmp_path / "not-managed.jpg"
    file_bytes = b"this is not artwork"
    arbitrary_file.write_bytes(file_bytes)

    response = client.get("/library/art", params={"path": str(arbitrary_file)})

    assert response.status_code == 403
    assert response.json()["detail"] == "Artwork path is not allowed"


def test_library_art_blocks_parent_directory_path_traversal(
    client,
    tmp_path,
):
    """
    Hardened behavior:
    - paths containing '..' are blocked before file access
    """
    nested_dir = tmp_path / "nested"
    nested_dir.mkdir()
    secret_file = tmp_path / "secret.jpg"
    secret_bytes = b"reachable through parent traversal"
    secret_file.write_bytes(secret_bytes)

    traversal_path = nested_dir / ".." / secret_file.name

    response = client.get("/library/art", params={"path": str(traversal_path)})

    assert response.status_code == 403
    assert response.json()["detail"] == "Parent directory references are not allowed."
