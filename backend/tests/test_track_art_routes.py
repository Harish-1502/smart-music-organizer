from app.models.track import Track


def make_track(db_session, tmp_path, art_path=None):
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
        art_path=str(art_path) if art_path is not None else None,
        user_edited=False,
    )
    db_session.add(track)
    db_session.commit()
    db_session.refresh(track)
    return track


def test_get_track_art_returns_valid_track_art_by_id(client, db_session, tmp_path):
    art_path = tmp_path / "cover.jpg"
    art_bytes = b"track artwork bytes"
    art_path.write_bytes(art_bytes)
    track = make_track(db_session, tmp_path, art_path=art_path)

    response = client.get(f"/tracks/{track.id}/art")

    assert response.status_code == 200
    assert response.content == art_bytes


def test_get_track_art_returns_404_for_missing_track(client):
    response = client.get("/tracks/999999/art")

    assert response.status_code == 404
    assert response.json()["detail"] == "Track not found"


def test_get_track_art_returns_404_when_track_has_no_artwork(
    client,
    db_session,
    tmp_path,
):
    track = make_track(db_session, tmp_path, art_path=None)

    response = client.get(f"/tracks/{track.id}/art")

    assert response.status_code == 404
    assert response.json()["detail"] == "Artwork not found"


def test_get_track_art_returns_404_when_artwork_file_is_missing(
    client,
    db_session,
    tmp_path,
):
    missing_art_path = tmp_path / "missing.jpg"
    track = make_track(db_session, tmp_path, art_path=missing_art_path)

    response = client.get(f"/tracks/{track.id}/art")

    assert response.status_code == 404
    assert response.json()["detail"] == "Artwork not found"


def test_get_track_art_ignores_arbitrary_query_path(
    client,
    db_session,
    tmp_path,
):
    track_art_path = tmp_path / "track-cover.jpg"
    track_art_bytes = b"correct artwork"
    track_art_path.write_bytes(track_art_bytes)
    arbitrary_path = tmp_path / "other-cover.jpg"
    arbitrary_path.write_bytes(b"wrong artwork")
    track = make_track(db_session, tmp_path, art_path=track_art_path)

    response = client.get(
        f"/tracks/{track.id}/art",
        params={"path": str(arbitrary_path)},
    )

    assert response.status_code == 200
    assert response.content == track_art_bytes


def test_get_track_art_blocks_parent_directory_reference_in_stored_path(
    client,
    db_session,
    tmp_path,
):
    nested_dir = tmp_path / "nested"
    nested_dir.mkdir()
    art_path = tmp_path / "cover.jpg"
    art_path.write_bytes(b"should not be served through traversal")
    track = make_track(db_session, tmp_path, art_path=nested_dir / ".." / art_path.name)

    response = client.get(f"/tracks/{track.id}/art")

    assert response.status_code == 403
    assert response.json()["detail"] == "Parent directory references are not allowed."


def test_get_track_art_blocks_unsupported_artwork_extension(
    client,
    db_session,
    tmp_path,
):
    art_path = tmp_path / "cover.gif"
    art_path.write_bytes(b"gif bytes")
    track = make_track(db_session, tmp_path, art_path=art_path)

    response = client.get(f"/tracks/{track.id}/art")

    assert response.status_code == 403
    assert response.json()["detail"] == "Artwork path is not allowed"
