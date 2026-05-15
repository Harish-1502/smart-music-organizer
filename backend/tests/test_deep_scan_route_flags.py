from types import SimpleNamespace

from app.models.track import Track
from app.routes import tracks as tracks_route


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


def test_deep_scan_route_enabled_by_default_calls_scan_function(
    client,
    db_session,
    tmp_path,
    monkeypatch,
):
    """
    Feature flag behavior:
    - ENABLE_DEEP_SCAN defaults enabled, preserving current route behavior
    - the expensive scan function is patched so the route test is deterministic
    """
    track = make_track(db_session, tmp_path)

    def fake_deep_scan_track(_db, scanned_track):
        return SimpleNamespace(
            track_id=scanned_track.id,
            method_used=None,
            musicbrainz_recording_id=None,
            warnings=[],
            applied_tags=[],
        )

    monkeypatch.setattr(tracks_route, "deep_scan_track", fake_deep_scan_track)

    response = client.post(f"/tracks/{track.id}/deep-scan")

    assert response.status_code == 200
    assert response.json() == {
        "track_id": track.id,
        "method_used": None,
        "musicbrainz_recording_id": None,
        "warnings": [],
        "applied_tags": [],
    }


def test_deep_scan_route_returns_403_when_feature_flag_disabled(
    client,
    monkeypatch,
):
    """
    Feature flag behavior:
    - disabling ENABLE_DEEP_SCAN blocks the route before DB lookup or scan work
    """
    monkeypatch.setattr(tracks_route.settings, "enable_deep_scan", False)

    response = client.post("/tracks/999999/deep-scan")

    assert response.status_code == 403
    assert response.json()["detail"] == "Deep scan is disabled."


def test_deep_scan_route_unexpected_error_hides_raw_exception(
    client,
    db_session,
    tmp_path,
    monkeypatch,
):
    track = make_track(db_session, tmp_path)
    private_path = "C:/Private/Music/song.mp3"

    def fail_deep_scan_track(*_args, **_kwargs):
        raise RuntimeError(f"fingerprint failed for {private_path}")

    monkeypatch.setattr(tracks_route, "deep_scan_track", fail_deep_scan_track)

    response = client.post(f"/tracks/{track.id}/deep-scan")

    assert response.status_code == 500
    assert response.json()["detail"] == "Failed to deep scan track"
    assert private_path not in response.text
    assert "fingerprint failed" not in response.text
