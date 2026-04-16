import pytest
from app.models.track import Track


def make_track(db_session, **overrides):
    """
    Helper to create a track for route tests.
    """
    track = Track(
        file_path=overrides.get("file_path", "C:/music/song.mp3"),
        file_name=overrides.get("file_name", "song.mp3"),
        extension=overrides.get("extension", ".mp3"),
        folder_path=overrides.get("folder_path", "C:/music"),
        title=overrides.get("title", "Old Title"),
        artist=overrides.get("artist", "Old Artist"),
        album=overrides.get("album", "Old Album"),
        scanned_title=overrides.get("scanned_title", "Old Title"),
        scanned_artist=overrides.get("scanned_artist", "Old Artist"),
        scanned_album=overrides.get("scanned_album", "Old Album"),
        display_title=overrides.get("display_title", "Old Title"),
        display_artist=overrides.get("display_artist", "Old Artist"),
        display_album=overrides.get("display_album", "Old Album"),
        duration=overrides.get("duration", 120),
        metadata_source=overrides.get("metadata_source", "tag"),
        art_path=overrides.get("art_path", None),
        user_edited=overrides.get("user_edited", False),
    )
    db_session.add(track)
    db_session.commit()
    db_session.refresh(track)
    return track


def test_patch_track_updates_only_provided_fields(client, db_session):
    """
    Test:
    - User edits only the artist field

    Expected result:
    - artist changes
    - title stays the same
    - album stays the same
    - user_edited becomes True
    """
    track = make_track(db_session)

    response = client.patch(
        f"/tracks/{track.id}",
        json={"artist": "New Artist"},
    )

    assert response.status_code == 200

    db_session.refresh(track)
    assert track.title == "Old Title"
    assert track.artist == "New Artist"
    assert track.album == "Old Album"
    assert track.user_edited is True


def test_patch_track_updates_display_fields_too(client, db_session):
    """
    Test:
    - User edits title, artist, and album

    Expected result:
    - compatibility fields update
    - display_* fields also update
    - user_edited becomes True
    """
    track = make_track(db_session)

    response = client.patch(
        f"/tracks/{track.id}",
        json={
            "title": "User Title",
            "artist": "User Artist",
            "album": "User Album",
        },
    )

    assert response.status_code == 200

    db_session.refresh(track)
    assert track.title == "User Title"
    assert track.artist == "User Artist"
    assert track.album == "User Album"

    assert track.display_title == "User Title"
    assert track.display_artist == "User Artist"
    assert track.display_album == "User Album"

    assert track.user_edited is True


def test_patch_track_returns_404_for_missing_track(client):
    """
    Test:
    - User tries to edit a track ID that does not exist

    Expected result:
    - API returns 404
    """
    response = client.patch(
        "/tracks/999999",
        json={"title": "Does Not Matter"},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Track not found"


def test_patch_track_with_empty_payload_does_not_crash(client, db_session):
    """
    Test:
    - User sends an empty PATCH payload

    Expected result:
    - route does not crash
    - existing values stay the same
    - depending on your implementation, user_edited may still become True
    """
    track = make_track(db_session)

    response = client.patch(f"/tracks/{track.id}", json={})

    assert response.status_code == 200

    db_session.refresh(track)
    assert track.title == "Old Title"
    assert track.artist == "Old Artist"
    assert track.album == "Old Album"