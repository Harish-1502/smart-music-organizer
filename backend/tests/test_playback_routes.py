from app.models.track import Track


def make_track(db_session, file_path, **overrides):
    track = Track(
        file_path=str(file_path),
        file_name=overrides.get("file_name", "song.mp3"),
        extension=overrides.get("extension", ".mp3"),
        folder_path=overrides.get("folder_path", str(file_path.parent)),
        title=overrides.get("title", "Song"),
        artist=overrides.get("artist", "Artist"),
        album=overrides.get("album", "Album"),
        display_title=overrides.get("display_title", "Song"),
        display_artist=overrides.get("display_artist", "Artist"),
        display_album=overrides.get("display_album", "Album"),
        metadata_source=overrides.get("metadata_source", "test"),
        user_edited=overrides.get("user_edited", False),
    )
    db_session.add(track)
    db_session.commit()
    db_session.refresh(track)
    return track


def test_stream_track_returns_existing_audio_file(client, db_session, tmp_path):
    """
    Current behavior:
    - /tracks/{track_id}/stream serves the DB-stored file_path when it exists
    """
    audio_path = tmp_path / "song.mp3"
    audio_bytes = b"fake audio bytes"
    audio_path.write_bytes(audio_bytes)
    track = make_track(db_session, audio_path)

    response = client.get(f"/tracks/{track.id}/stream")

    assert response.status_code == 200
    assert response.content == audio_bytes


def test_stream_track_returns_404_for_missing_track(client):
    """
    Current behavior:
    - missing track ids return 404
    """
    response = client.get("/tracks/999999/stream")

    assert response.status_code == 404
    assert response.json()["detail"] == "Track not found"


def test_stream_track_returns_404_when_track_file_is_missing(
    client,
    db_session,
    tmp_path,
):
    """
    Current behavior:
    - a track row whose file_path no longer exists returns 404
    """
    missing_audio_path = tmp_path / "missing.mp3"
    track = make_track(db_session, missing_audio_path)

    response = client.get(f"/tracks/{track.id}/stream")

    assert response.status_code == 404
    assert response.json()["detail"] == "Audio file not found"
