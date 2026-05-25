from app.models.track import Track


PNG_BYTES = b"\x89PNG\r\n\x1a\n"
JPEG_BYTES = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00"
WEBP_BYTES = b"RIFF\x0c\x00\x00\x00WEBPVP8 "


def make_track(db_session, tmp_path):
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
        user_edited=False,
    )
    db_session.add(track)
    db_session.commit()
    db_session.refresh(track)
    return track


def test_upload_track_art_accepts_image_mime_type(
    client,
    db_session,
    tmp_path,
    monkeypatch,
):
    art_dir = tmp_path / "track_art"
    monkeypatch.setattr("app.services.art.ART_DIR", art_dir)
    track = make_track(db_session, tmp_path)

    response = client.post(
        f"/tracks/{track.id}/art",
        files={"file": ("cover.png", PNG_BYTES, "image/png")},
    )

    assert response.status_code == 200
    assert response.json()["art_path"] == f"/static/track_art/track_{track.id}.png"
    assert (art_dir / f"track_{track.id}.png").exists()

    db_session.refresh(track)
    assert track.art_path == str(art_dir / f"track_{track.id}.png")

    art_response = client.get(f"/tracks/{track.id}/art")
    assert art_response.status_code == 200
    assert art_response.content == PNG_BYTES


def test_upload_track_art_accepts_jpeg_bytes(
    client,
    db_session,
    tmp_path,
    monkeypatch,
):
    art_dir = tmp_path / "track_art"
    monkeypatch.setattr("app.services.art.ART_DIR", art_dir)
    track = make_track(db_session, tmp_path)

    response = client.post(
        f"/tracks/{track.id}/art",
        files={"file": ("cover.jpg", JPEG_BYTES, "image/jpeg")},
    )

    assert response.status_code == 200
    assert response.json()["art_path"] == f"/static/track_art/track_{track.id}.jpg"
    assert (art_dir / f"track_{track.id}.jpg").read_bytes() == JPEG_BYTES


def test_upload_track_art_accepts_webp_bytes(
    client,
    db_session,
    tmp_path,
    monkeypatch,
):
    art_dir = tmp_path / "track_art"
    monkeypatch.setattr("app.services.art.ART_DIR", art_dir)
    track = make_track(db_session, tmp_path)

    response = client.post(
        f"/tracks/{track.id}/art",
        files={"file": ("cover.webp", WEBP_BYTES, "image/webp")},
    )

    assert response.status_code == 200
    assert response.json()["art_path"] == f"/static/track_art/track_{track.id}.webp"
    assert (art_dir / f"track_{track.id}.webp").read_bytes() == WEBP_BYTES


def test_upload_track_art_rejects_non_image_mime_type(
    client,
    db_session,
    tmp_path,
    monkeypatch,
):
    """
    Current behavior:
    - non-image content types are rejected
    """
    monkeypatch.setattr("app.services.art.ART_DIR", tmp_path / "track_art")
    track = make_track(db_session, tmp_path)

    response = client.post(
        f"/tracks/{track.id}/art",
        files={"file": ("notes.txt", b"not an image", "text/plain")},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid image type. Use JPG, PNG, or WebP."


def test_upload_track_art_rejects_fake_png_with_image_mime_type(
    client,
    db_session,
    tmp_path,
    monkeypatch,
):
    art_dir = tmp_path / "track_art"
    monkeypatch.setattr("app.services.art.ART_DIR", art_dir)
    track = make_track(db_session, tmp_path)

    response = client.post(
        f"/tracks/{track.id}/art",
        files={"file": ("fake.png", b"not actually image data", "image/png")},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid image content. Use JPG, PNG, or WebP."
    assert not (art_dir / f"track_{track.id}.png").exists()


def test_upload_track_art_rejects_mismatched_content_type(
    client,
    db_session,
    tmp_path,
    monkeypatch,
):
    art_dir = tmp_path / "track_art"
    monkeypatch.setattr("app.services.art.ART_DIR", art_dir)
    track = make_track(db_session, tmp_path)

    response = client.post(
        f"/tracks/{track.id}/art",
        files={"file": ("cover.png", JPEG_BYTES, "image/png")},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Image content does not match the declared type."
    assert not (art_dir / f"track_{track.id}.png").exists()


def test_upload_track_art_ignores_filename_path_traversal(
    client,
    db_session,
    tmp_path,
    monkeypatch,
):
    """
    Hardened behavior:
    - uploaded artwork storage uses a generated filename, not the user filename
    """
    art_dir = tmp_path / "track_art"
    monkeypatch.setattr("app.services.art.ART_DIR", art_dir)
    track = make_track(db_session, tmp_path)

    response = client.post(
        f"/tracks/{track.id}/art",
        files={"file": ("../../evil.png", PNG_BYTES, "image/png")},
    )

    assert response.status_code == 200
    assert (art_dir / f"track_{track.id}.png").exists()
    assert not (tmp_path / "evil.png").exists()


def test_upload_track_art_enforces_size_limit(
    client,
    db_session,
    tmp_path,
    monkeypatch,
):
    art_dir = tmp_path / "track_art"
    monkeypatch.setattr("app.services.art.ART_DIR", art_dir)
    monkeypatch.setattr("app.services.art.settings.upload_max_bytes", 4)
    track = make_track(db_session, tmp_path)

    response = client.post(
        f"/tracks/{track.id}/art",
        files={"file": ("cover.png", b"too-large", "image/png")},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Uploaded file is too large."


def test_upload_track_art_enforces_default_size_limit(
    client,
    db_session,
    tmp_path,
    monkeypatch,
):
    art_dir = tmp_path / "track_art"
    monkeypatch.setattr("app.services.art.ART_DIR", art_dir)
    track = make_track(db_session, tmp_path)

    response = client.post(
        f"/tracks/{track.id}/art",
        files={
            "file": (
                "cover.png",
                PNG_BYTES + b"0" * (5 * 1024 * 1024),
                "image/png",
            )
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Uploaded file is too large."
    assert str(art_dir) not in response.text


def test_upload_track_art_unexpected_error_hides_raw_exception(
    client,
    db_session,
    tmp_path,
    monkeypatch,
):
    private_path = tmp_path / "C_Private_Music_song.mp3"
    private_path.write_bytes(b"not a directory")
    monkeypatch.setattr("app.services.art.ART_DIR", private_path)
    track = make_track(db_session, tmp_path)

    response = client.post(
        f"/tracks/{track.id}/art",
        files={"file": ("cover.png", PNG_BYTES, "image/png")},
    )

    assert response.status_code == 500
    assert response.json()["detail"] == "Failed to upload artwork"
    assert str(private_path) not in response.text
    assert "not a directory" not in response.text
