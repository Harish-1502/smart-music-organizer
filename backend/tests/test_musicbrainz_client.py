import pytest

from app.models.track import Track
from app.services.musicbrainz_client import (
    MusicBrainzLookupError,
    find_recording_id_by_text,
    fetch_recording_details,
)


def test_find_recording_id_by_text_returns_recording_id(monkeypatch):
    track = Track(
        id=1,
        display_title="Blinding Lights",
        display_artist="The Weeknd",
        display_album="After Hours",
    )

    def fake_sleep(seconds):
        return None

    def fake_search_recordings(query, limit, strict):
        return {
            "recording-list": [
                {"id": "mbid-123", "title": "Blinding Lights"}
            ]
        }

    monkeypatch.setattr("app.services.musicbrainz_client.time.sleep", fake_sleep)
    monkeypatch.setattr(
        "app.services.musicbrainz_client.musicbrainzngs.search_recordings",
        fake_search_recordings,
    )

    result = find_recording_id_by_text(track)

    assert result == "mbid-123"


def test_find_recording_id_by_text_returns_none_when_no_recordings(monkeypatch):
    track = Track(
        id=1,
        display_title="Unknown Song",
        display_artist="Unknown Artist",
    )

    def fake_sleep(seconds):
        return None

    def fake_search_recordings(query, limit, strict):
        return {"recording-list": []}

    monkeypatch.setattr("app.services.musicbrainz_client.time.sleep", fake_sleep)
    monkeypatch.setattr(
        "app.services.musicbrainz_client.musicbrainzngs.search_recordings",
        fake_search_recordings,
    )

    result = find_recording_id_by_text(track)

    assert result is None


def test_find_recording_id_by_text_returns_none_when_identity_missing(monkeypatch):
    track = Track(
        id=1,
        display_title="Blinding Lights",
        display_artist=None,
    )

    was_called = False

    def fake_search_recordings(query, limit, strict):
        nonlocal was_called
        was_called = True
        return {"recording-list": [{"id": "mbid-123"}]}

    monkeypatch.setattr(
        "app.services.musicbrainz_client.musicbrainzngs.search_recordings",
        fake_search_recordings,
    )

    result = find_recording_id_by_text(track)

    assert result is None
    assert was_called is False


def test_find_recording_id_by_text_raises_lookup_error_on_api_exception(monkeypatch):
    track = Track(
        id=1,
        display_title="Blinding Lights",
        display_artist="The Weeknd",
    )

    def fake_sleep(seconds):
        return None

    def fake_search_recordings(query, limit, strict):
        raise Exception("network down")

    monkeypatch.setattr("app.services.musicbrainz_client.time.sleep", fake_sleep)
    monkeypatch.setattr(
        "app.services.musicbrainz_client.musicbrainzngs.search_recordings",
        fake_search_recordings,
    )

    with pytest.raises(MusicBrainzLookupError):
        find_recording_id_by_text(track)


def test_fetch_recording_details_returns_recording_dict(monkeypatch):
    def fake_sleep(seconds):
        return None

    def fake_get_recording_by_id(recording_id, includes):
        return {
            "recording": {
                "id": recording_id,
                "genre-list": [
                    {"name": "hip-hop", "count": 20}
                ],
            }
        }

    monkeypatch.setattr("app.services.musicbrainz_client.time.sleep", fake_sleep)
    monkeypatch.setattr(
        "app.services.musicbrainz_client.musicbrainzngs.get_recording_by_id",
        fake_get_recording_by_id,
    )

    result = fetch_recording_details("mbid-123")

    assert result["id"] == "mbid-123"
    assert result["genre-list"][0]["name"] == "hip-hop"


def test_fetch_recording_details_raises_lookup_error_on_api_exception(monkeypatch):
    def fake_sleep(seconds):
        return None

    def fake_get_recording_by_id(recording_id, includes):
        raise Exception("server error")

    monkeypatch.setattr("app.services.musicbrainz_client.time.sleep", fake_sleep)
    monkeypatch.setattr(
        "app.services.musicbrainz_client.musicbrainzngs.get_recording_by_id",
        fake_get_recording_by_id,
    )

    with pytest.raises(MusicBrainzLookupError):
        fetch_recording_details("mbid-123")