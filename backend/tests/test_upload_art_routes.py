from app.models.track import Track


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
    """
    Current behavior:
    - upload validation accepts files based on UploadFile.content_type
    - accepted artwork is written to ART_DIR and track.art_path is updated
    """
    art_dir = tmp_path / "track_art"
    monkeypatch.setattr("app.services.art.ART_DIR", art_dir)
    track = make_track(db_session, tmp_path)

    response = client.post(
        f"/tracks/{track.id}/art",
        files={"file": ("cover.png", b"\x89PNG\r\n\x1a\n", "image/png")},
    )

    assert response.status_code == 200
    assert response.json()["art_path"] == f"/static/track_art/track_{track.id}.png"
    assert (art_dir / f"track_{track.id}.png").exists()

    db_session.refresh(track)
    assert track.art_path == str(art_dir / f"track_{track.id}.png")


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


def test_upload_track_art_accepts_non_image_bytes_with_image_mime_current_security_risk(
    client,
    db_session,
    tmp_path,
    monkeypatch,
):
    """
    Security-risk characterization:
    - current validation trusts MIME type and does not verify image bytes
    """
    art_dir = tmp_path / "track_art"
    monkeypatch.setattr("app.services.art.ART_DIR", art_dir)
    track = make_track(db_session, tmp_path)

    response = client.post(
        f"/tracks/{track.id}/art",
        files={"file": ("fake.png", b"not actually image data", "image/png")},
    )

    assert response.status_code == 200
    assert (art_dir / f"track_{track.id}.png").read_bytes() == b"not actually image data"
