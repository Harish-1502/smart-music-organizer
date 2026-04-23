from app.models.track import Track


def make_track(db_session, **overrides):
    """
    Helper to create a track row for filtering tests.
    """
    track = Track(
        file_path=overrides.get("file_path", "C:/music/default.mp3"),
        file_name=overrides.get("file_name", "default.mp3"),
        extension=overrides.get("extension", ".mp3"),
        folder_path=overrides.get("folder_path", "C:/music"),

        # legacy compatibility fields
        title=overrides.get("title", "Default Title"),
        artist=overrides.get("artist", "Default Artist"),
        album=overrides.get("album", "Default Album"),

        # scanned fields
        scanned_title=overrides.get("scanned_title", "Default Title"),
        scanned_artist=overrides.get("scanned_artist", "Default Artist"),
        scanned_album=overrides.get("scanned_album", "Default Album"),

        # display fields
        display_title=overrides.get("display_title", "Default Title"),
        display_artist=overrides.get("display_artist", "Default Artist"),
        display_album=overrides.get("display_album", "Default Album"),

        duration=overrides.get("duration", 120.0),
        metadata_source=overrides.get("metadata_source", "tag"),
        art_path=overrides.get("art_path", None),
        user_edited=overrides.get("user_edited", False),
    )

    db_session.add(track)
    db_session.commit()
    db_session.refresh(track)
    return track


def test_artist_exact_returns_only_exact_artist_matches(client, db_session):
    """
    Test:
    - Two similar artist names exist:
        - Drake
        - Drake Bell
    - Request uses artist_exact=Drake

    Input:
    - GET /tracks?artist_exact=Drake

    Expected result:
    - Only tracks with display_artist exactly equal to "Drake" are returned
    - "Drake Bell" should NOT be included
    """
    make_track(
        db_session,
        file_path="C:/music/drake1.mp3",
        file_name="drake1.mp3",
        display_title="Track 1",
        display_artist="Drake",
        display_album="Album A",
        title="Track 1",
        artist="Drake",
        album="Album A",
    )
    make_track(
        db_session,
        file_path="C:/music/drake2.mp3",
        file_name="drake2.mp3",
        display_title="Track 2",
        display_artist="Drake Bell",
        display_album="Album B",
        title="Track 2",
        artist="Drake Bell",
        album="Album B",
    )

    response = client.get("/tracks", params={"exact_artist": "Drake"})

    assert response.status_code == 200
    body = response.json()

    assert body["total_items"] == 1
    assert len(body["items"]) == 1
    assert body["items"][0]["display_artist"] == "Drake"
    assert body["items"][0]["display_title"] == "Track 1"


def test_artist_partial_filter_still_matches_similar_artists(client, db_session):
    """
    Test:
    - Two similar artist names exist:
        - Drake
        - Drake Bell
    - Request uses partial artist filter artist=Drake

    Input:
    - GET /tracks?artist=Drake

    Expected result:
    - Both matching tracks are returned because partial matching is still allowed
    """
    make_track(
        db_session,
        file_path="C:/music/drake1.mp3",
        file_name="drake1.mp3",
        display_title="Track 1",
        display_artist="Drake",
        display_album="Album A",
        title="Track 1",
        artist="Drake",
        album="Album A",
    )
    make_track(
        db_session,
        file_path="C:/music/drake2.mp3",
        file_name="drake2.mp3",
        display_title="Track 2",
        display_artist="Drake Bell",
        display_album="Album B",
        title="Track 2",
        artist="Drake Bell",
        album="Album B",
    )

    response = client.get("/tracks", params={"artist": "Drake"})

    assert response.status_code == 200
    body = response.json()

    assert body["total_items"] == 2
    artists = sorted(item["display_artist"] for item in body["items"])
    assert artists == ["Drake", "Drake Bell"]


def test_album_exact_returns_only_exact_album_matches(client, db_session):
    """
    Test:
    - Two similar album names exist:
        - Greatest Hits
        - Greatest Hits Remastered
    - Request uses album_exact=Greatest Hits

    Input:
    - GET /tracks?album_exact=Greatest Hits

    Expected result:
    - Only tracks with display_album exactly equal to "Greatest Hits" are returned
    - "Greatest Hits Remastered" should NOT be included
    """
    make_track(
        db_session,
        file_path="C:/music/hits1.mp3",
        file_name="hits1.mp3",
        display_title="Track 1",
        display_artist="Artist A",
        display_album="Greatest Hits",
        title="Track 1",
        artist="Artist A",
        album="Greatest Hits",
    )
    make_track(
        db_session,
        file_path="C:/music/hits2.mp3",
        file_name="hits2.mp3",
        display_title="Track 2",
        display_artist="Artist B",
        display_album="Greatest Hits Remastered",
        title="Track 2",
        artist="Artist B",
        album="Greatest Hits Remastered",
    )

    response = client.get("/tracks", params={"exact_album": "Greatest Hits"})

    assert response.status_code == 200
    body = response.json()

    assert body["total_items"] == 1
    assert len(body["items"]) == 1
    assert body["items"][0]["display_album"] == "Greatest Hits"
    assert body["items"][0]["display_title"] == "Track 1"


def test_album_partial_filter_still_matches_similar_albums(client, db_session):
    """
    Test:
    - Two similar album names exist:
        - Greatest Hits
        - Greatest Hits Remastered
    - Request uses partial album filter album=Greatest Hits

    Input:
    - GET /tracks?album=Greatest Hits

    Expected result:
    - Both tracks are returned because partial matching is still allowed
    """
    make_track(
        db_session,
        file_path="C:/music/hits1.mp3",
        file_name="hits1.mp3",
        display_title="Track 1",
        display_artist="Artist A",
        display_album="Greatest Hits",
        title="Track 1",
        artist="Artist A",
        album="Greatest Hits",
    )
    make_track(
        db_session,
        file_path="C:/music/hits2.mp3",
        file_name="hits2.mp3",
        display_title="Track 2",
        display_artist="Artist B",
        display_album="Greatest Hits Remastered",
        title="Track 2",
        artist="Artist B",
        album="Greatest Hits Remastered",
    )

    response = client.get("/tracks", params={"album": "Greatest Hits"})

    assert response.status_code == 200
    body = response.json()

    assert body["total_items"] == 2
    albums = sorted(item["display_album"] for item in body["items"])
    assert albums == ["Greatest Hits", "Greatest Hits Remastered"]


def test_album_exact_and_artist_exact_together_return_correct_grouped_album(client, db_session):
    """
    Test:
    - Two tracks share the same album name but belong to different artists:
        - Album: Greatest Hits, Artist: Queen
        - Album: Greatest Hits, Artist: Foo Fighters
    - Request uses both album_exact and artist_exact

    Input:
    - GET /tracks?album_exact=Greatest Hits&artist_exact=Queen

    Expected result:
    - Only Queen's "Greatest Hits" track(s) are returned
    - Foo Fighters track(s) with the same album name are excluded
    """
    make_track(
        db_session,
        file_path="C:/music/queen_hits.mp3",
        file_name="queen_hits.mp3",
        display_title="Bohemian Rhapsody",
        display_artist="Queen",
        display_album="Greatest Hits",
        title="Bohemian Rhapsody",
        artist="Queen",
        album="Greatest Hits",
    )
    make_track(
        db_session,
        file_path="C:/music/foo_hits.mp3",
        file_name="foo_hits.mp3",
        display_title="Everlong",
        display_artist="Foo Fighters",
        display_album="Greatest Hits",
        title="Everlong",
        artist="Foo Fighters",
        album="Greatest Hits",
    )

    response = client.get(
        "/tracks",
        params={
            "exact_album": "Greatest Hits",
            "exact_artist": "Queen",
        },
    )

    assert response.status_code == 200
    body = response.json()

    assert body["total_items"] == 1
    assert len(body["items"]) == 1
    assert body["items"][0]["display_artist"] == "Queen"
    assert body["items"][0]["display_album"] == "Greatest Hits"
    assert body["items"][0]["display_title"] == "Bohemian Rhapsody"


def test_exact_filters_take_priority_over_partial_filters(client, db_session):
    """
    Test:
    - Similar artist values exist
    - Request includes both artist_exact and artist

    Input:
    - GET /tracks?artist_exact=Drake&artist=Bell

    Expected result:
    - Exact filter should take priority
    - Only exact artist "Drake" should be returned
    - Partial artist filter should not override the exact filter
    """
    make_track(
        db_session,
        file_path="C:/music/drake1.mp3",
        file_name="drake1.mp3",
        display_title="Track 1",
        display_artist="Drake",
        display_album="Album A",
        title="Track 1",
        artist="Drake",
        album="Album A",
    )
    make_track(
        db_session,
        file_path="C:/music/drake2.mp3",
        file_name="drake2.mp3",
        display_title="Track 2",
        display_artist="Drake Bell",
        display_album="Album B",
        title="Track 2",
        artist="Drake Bell",
        album="Album B",
    )

    response = client.get(
        "/tracks",
        params={
            "exact_artist": "Drake",
            "artist": "Bell",
        },
    )

    assert response.status_code == 200
    body = response.json()

    assert body["total_items"] == 1
    assert len(body["items"]) == 1
    assert body["items"][0]["display_artist"] == "Drake"