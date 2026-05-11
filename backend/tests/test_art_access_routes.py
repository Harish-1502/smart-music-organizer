from app.routes import library as library_route


def test_library_art_returns_existing_image_path(client, tmp_path):
    """
    Current behavior:
    - /library/art accepts a raw filesystem path
    - existing files are returned directly
    """
    image_path = tmp_path / "cover.jpg"
    image_bytes = b"fake image bytes"
    image_path.write_bytes(image_bytes)

    response = client.get("/library/art", params={"path": str(image_path)})

    assert response.status_code == 200
    assert response.content == image_bytes


def test_library_art_enabled_by_default_allows_existing_path(client, tmp_path):
    """
    Feature flag behavior:
    - ENABLE_LEGACY_ART_PATH_ROUTE defaults enabled, preserving current behavior
    """
    image_path = tmp_path / "cover-default.jpg"
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


def test_library_art_allows_arbitrary_existing_local_file_current_security_risk(
    client,
    tmp_path,
):
    """
    Security-risk characterization:
    - the endpoint is named for artwork
    - current behavior returns any existing local file path, not only images
    """
    arbitrary_file = tmp_path / "not_art.txt"
    file_bytes = b"this is not artwork"
    arbitrary_file.write_bytes(file_bytes)

    response = client.get("/library/art", params={"path": str(arbitrary_file)})

    assert response.status_code == 200
    assert response.content == file_bytes


def test_library_art_allows_parent_directory_path_traversal_current_security_risk(
    client,
    tmp_path,
):
    """
    Security-risk characterization:
    - paths containing '..' are accepted when they resolve to an existing file
    """
    nested_dir = tmp_path / "nested"
    nested_dir.mkdir()
    secret_file = tmp_path / "secret.txt"
    secret_bytes = b"reachable through parent traversal"
    secret_file.write_bytes(secret_bytes)

    traversal_path = nested_dir / ".." / secret_file.name

    response = client.get("/library/art", params={"path": str(traversal_path)})

    assert response.status_code == 200
    assert response.content == secret_bytes
