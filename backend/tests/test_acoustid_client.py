import pytest
import acoustid

from app.models.track import Track
from app.services.acoustid_client import (
    AcoustIDLookupError,
    find_recording_id_by_fingerprint,
)


def test_find_recording_id_by_fingerprint_raises_when_api_key_missing(monkeypatch):
    monkeypatch.delenv("ACOUSTID_API_KEY", raising=False)

    track = Track(
        id=1,
        file_path="S:/Music/test.mp3",
    )

    with pytest.raises(AcoustIDLookupError):
        find_recording_id_by_fingerprint(track)


def test_find_recording_id_by_fingerprint_returns_none_when_file_path_missing(monkeypatch):
    monkeypatch.setenv("ACOUSTID_API_KEY", "fake-key")

    track = Track(
        id=1,
        file_path=None,
    )

    result = find_recording_id_by_fingerprint(track)

    assert result == (None, None)


def test_find_recording_id_by_fingerprint_returns_confident_match(monkeypatch):
    monkeypatch.setenv("ACOUSTID_API_KEY", "fake-key")

    track = Track(
        id=1,
        file_path="S:/Music/test.mp3",
    )

    def fake_fingerprint_file(file_path):
        return 180, "fake-fingerprint"

    def fake_lookup(apikey, fingerprint, duration, meta):
        return {
            "results": [
                {
                    "score": 0.92,
                    "recordings": [
                        {
                            "id": "mbid-123",
                            "title": "Real Song",
                            "artists": [{"name": "Real Artist"}],
                        }
                    ],
                }
            ]
        }

    monkeypatch.setattr(
        "app.services.acoustid_client.acoustid.fingerprint_file",
        fake_fingerprint_file,
    )
    monkeypatch.setattr(
        "app.services.acoustid_client.acoustid.lookup",
        fake_lookup,
    )

    recording_id, recording = find_recording_id_by_fingerprint(track)

    assert recording_id == "mbid-123"
    assert recording["title"] == "Real Song"
    assert recording["artists"][0]["name"] == "Real Artist"


def test_find_recording_id_by_fingerprint_returns_none_for_low_confidence(monkeypatch):
    monkeypatch.setenv("ACOUSTID_API_KEY", "fake-key")

    track = Track(
        id=1,
        file_path="S:/Music/test.mp3",
    )

    def fake_fingerprint_file(file_path):
        return 180, "fake-fingerprint"

    def fake_lookup(apikey, fingerprint, duration, meta):
        return {
            "results": [
                {
                    "score": 0.4,
                    "recordings": [
                        {"id": "mbid-123", "title": "Low Confidence Song"}
                    ],
                }
            ]
        }

    monkeypatch.setattr(
        "app.services.acoustid_client.acoustid.fingerprint_file",
        fake_fingerprint_file,
    )
    monkeypatch.setattr(
        "app.services.acoustid_client.acoustid.lookup",
        fake_lookup,
    )

    result = find_recording_id_by_fingerprint(track)

    assert result == (None, None)


def test_find_recording_id_by_fingerprint_returns_none_when_no_results(monkeypatch):
    monkeypatch.setenv("ACOUSTID_API_KEY", "fake-key")

    track = Track(
        id=1,
        file_path="S:/Music/test.mp3",
    )

    def fake_fingerprint_file(file_path):
        return 180, "fake-fingerprint"

    def fake_lookup(apikey, fingerprint, duration, meta):
        return {"results": []}

    monkeypatch.setattr(
        "app.services.acoustid_client.acoustid.fingerprint_file",
        fake_fingerprint_file,
    )
    monkeypatch.setattr(
        "app.services.acoustid_client.acoustid.lookup",
        fake_lookup,
    )

    result = find_recording_id_by_fingerprint(track)

    assert result == (None, None)


def test_find_recording_id_by_fingerprint_raises_when_fingerprint_generation_fails(monkeypatch):
    monkeypatch.setenv("ACOUSTID_API_KEY", "fake-key")

    track = Track(
        id=1,
        file_path="S:/Music/test.mp3",
    )

    def fake_fingerprint_file(file_path):
        raise acoustid.FingerprintGenerationError("fpcalc failed")

    monkeypatch.setattr(
        "app.services.acoustid_client.acoustid.fingerprint_file",
        fake_fingerprint_file,
    )

    with pytest.raises(AcoustIDLookupError) as error:
        find_recording_id_by_fingerprint(track)

    assert "fpcalc" in str(error.value).lower()


def test_find_recording_id_by_fingerprint_raises_when_lookup_fails(monkeypatch):
    monkeypatch.setenv("ACOUSTID_API_KEY", "fake-key")

    track = Track(
        id=1,
        file_path="S:/Music/test.mp3",
    )

    def fake_fingerprint_file(file_path):
        return 180, "fake-fingerprint"

    def fake_lookup(apikey, fingerprint, duration, meta):
        raise Exception("bad request")

    monkeypatch.setattr(
        "app.services.acoustid_client.acoustid.fingerprint_file",
        fake_fingerprint_file,
    )
    monkeypatch.setattr(
        "app.services.acoustid_client.acoustid.lookup",
        fake_lookup,
    )

    with pytest.raises(AcoustIDLookupError):
        find_recording_id_by_fingerprint(track)