from app.models.playlist import Playlist
from app.models.playlistTrack import PlaylistTrack
from app.models.tag import Tag
from app.models.track import Track
from app.models.track_tag import TrackTag
from app.schemas import public_paths


def make_track(db_session, tmp_path, *, title="Song", art_path=None):
    audio_path = tmp_path / f"{title}.mp3"
    audio_path.write_bytes(b"fake audio")

    track = Track(
        file_path=str(audio_path),
        file_name=audio_path.name,
        extension=".mp3",
        folder_path=str(tmp_path),
        title=title,
        artist="Artist",
        album="Album",
        display_title=title,
        display_artist="Artist",
        display_album="Album",
        duration=180,
        metadata_source="test",
        art_path=str(art_path) if art_path is not None else None,
        user_edited=False,
    )
    db_session.add(track)
    db_session.commit()
    db_session.refresh(track)
    return track, audio_path


def test_tracks_response_exposes_paths_by_default(
    client,
    db_session,
    tmp_path,
    monkeypatch,
):
    monkeypatch.setattr(public_paths.settings, "expose_local_paths", True)
    art_path = tmp_path / "cover.jpg"
    art_path.write_bytes(b"cover")
    track, audio_path = make_track(db_session, tmp_path, art_path=art_path)

    response = client.get("/tracks")

    assert response.status_code == 200
    item = response.json()["items"][0]
    assert item["file_path"] == str(audio_path)
    assert item["folder_path"] == str(tmp_path)
    assert item["art_path"] == str(art_path)
    assert item["id"] == track.id


def test_tracks_response_hides_local_paths_when_disabled(
    client,
    db_session,
    tmp_path,
    monkeypatch,
):
    monkeypatch.setattr(public_paths.settings, "expose_local_paths", False)
    art_path = tmp_path / "cover.jpg"
    art_path.write_bytes(b"cover")
    make_track(db_session, tmp_path, art_path=art_path)

    response = client.get("/tracks")

    assert response.status_code == 200
    item = response.json()["items"][0]
    assert item["file_path"] is None
    assert item["folder_path"] is None
    assert item["art_path"] is None


def test_playback_still_works_when_local_paths_are_hidden(
    client,
    db_session,
    tmp_path,
    monkeypatch,
):
    monkeypatch.setattr(public_paths.settings, "expose_local_paths", False)
    track, audio_path = make_track(db_session, tmp_path)

    tracks_response = client.get("/tracks")
    assert tracks_response.json()["items"][0]["file_path"] is None

    stream_response = client.get(f"/tracks/{track.id}/stream")

    assert stream_response.status_code == 200
    assert stream_response.content == audio_path.read_bytes()


def test_track_art_endpoint_still_works_when_local_paths_are_hidden(
    client,
    db_session,
    tmp_path,
    monkeypatch,
):
    monkeypatch.setattr(public_paths.settings, "expose_local_paths", False)
    art_path = tmp_path / "cover.jpg"
    art_bytes = b"cover bytes"
    art_path.write_bytes(art_bytes)
    track, _audio_path = make_track(db_session, tmp_path, art_path=art_path)

    tracks_response = client.get("/tracks")
    assert tracks_response.json()["items"][0]["art_path"] is None

    art_response = client.get(f"/tracks/{track.id}/art")

    assert art_response.status_code == 200
    assert art_response.content == art_bytes


def test_playlist_detail_hides_raw_art_path_when_local_paths_are_hidden(
    client,
    db_session,
    tmp_path,
    monkeypatch,
):
    monkeypatch.setattr(public_paths.settings, "expose_local_paths", False)
    art_path = tmp_path / "playlist-cover.jpg"
    art_path.write_bytes(b"cover")
    track, _audio_path = make_track(db_session, tmp_path, art_path=art_path)
    playlist = Playlist(name="Road Mix")
    db_session.add(playlist)
    db_session.commit()
    db_session.refresh(playlist)
    db_session.add(
        PlaylistTrack(
            playlist_id=playlist.id,
            track_id=track.id,
            position=1,
        )
    )
    db_session.commit()

    response = client.get(f"/playlists/{playlist.id}")

    assert response.status_code == 200
    assert response.json()["tracks"][0]["art_path"] is None


def test_ai_playlist_response_hides_raw_art_path_when_local_paths_are_hidden(
    client,
    db_session,
    tmp_path,
    monkeypatch,
):
    monkeypatch.setattr(public_paths.settings, "expose_local_paths", False)
    art_path = tmp_path / "ai-cover.jpg"
    art_path.write_bytes(b"cover")
    track, _audio_path = make_track(
        db_session,
        tmp_path,
        title="Chill Study",
        art_path=art_path,
    )
    tag = Tag(name="chill", category="mood")
    db_session.add(tag)
    db_session.flush()
    db_session.add(
        TrackTag(
            track_id=track.id,
            tag_id=tag.id,
            source="manual",
            confidence=1.0,
        )
    )
    db_session.commit()

    response = client.post(
        "/ai_playlists/generate",
        json={"prompt": "chill study playlist", "limit": 10},
    )

    assert response.status_code == 200
    assert response.json()["tracks"][0]["art_path"] is None
