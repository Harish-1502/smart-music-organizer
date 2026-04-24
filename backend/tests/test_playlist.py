import pytest

from app.models.playlist import Playlist
from app.models.playlistTrack import PlaylistTrack
from app.models.track import Track

from app.services.playlist import (
    add_playlist,
    remove_playlist,
    rename_playlist,
    add_tracks_to_playlist,
    remove_tracks_from_playlist,
    reorder_playlist_tracks,
)


def create_track(db_session, title="Song", artist="Artist", album="Album"):
    track = Track(
        file_path=f"/fake/{title}.mp3",
        file_name=f"{title}.mp3",
        extension=".mp3",
        folder_path="/fake",
        title=title,
        artist=artist,
        album=album,
    )
    db_session.add(track)
    db_session.commit()
    db_session.refresh(track)
    return track


def test_add_playlist_with_valid_name(db_session):
    playlist = add_playlist(db_session, "Gym Mix")

    assert playlist.id is not None
    assert playlist.name == "Gym Mix"


def test_add_playlist_with_empty_name_fails(db_session):
    with pytest.raises(ValueError, match="Playlist name cannot be empty"):
        add_playlist(db_session, "   ")


def test_add_playlist_with_duplicate_name_fails(db_session):
    add_playlist(db_session, "Gym Mix")

    with pytest.raises(ValueError, match="Playlist with this name already exists"):
        add_playlist(db_session, "gym mix")


def test_rename_playlist(db_session):
    playlist = add_playlist(db_session, "Old Name")

    renamed = rename_playlist(db_session, playlist.id, "New Name")

    assert renamed.name == "New Name"


def test_rename_playlist_to_duplicate_name_fails(db_session):
    playlist_1 = add_playlist(db_session, "Gym")
    playlist_2 = add_playlist(db_session, "Chill")

    with pytest.raises(ValueError, match="Playlist with this name already exists"):
        rename_playlist(db_session, playlist_2.id, "Gym")


def test_delete_playlist(db_session):
    playlist = add_playlist(db_session, "Delete Me")

    remove_playlist(db_session, playlist.id)

    deleted = db_session.query(Playlist).filter(Playlist.id == playlist.id).first()
    assert deleted is None


def test_add_one_track_to_playlist(db_session):
    playlist = add_playlist(db_session, "Gym")
    track = create_track(db_session, title="Song A")

    playlist_tracks = add_tracks_to_playlist(db_session, [track.id], playlist.id)

    assert len(playlist_tracks) == 1
    assert playlist_tracks[0].track_id == track.id
    assert playlist_tracks[0].position == 1


def test_add_many_tracks_to_playlist(db_session):
    playlist = add_playlist(db_session, "Gym")
    track_1 = create_track(db_session, title="Song A")
    track_2 = create_track(db_session, title="Song B")
    track_3 = create_track(db_session, title="Song C")

    playlist_tracks = add_tracks_to_playlist(
        db_session,
        [track_1.id, track_2.id, track_3.id],
        playlist.id,
    )

    assert len(playlist_tracks) == 3
    assert [pt.position for pt in playlist_tracks] == [1, 2, 3]


def test_add_duplicate_tracks_is_allowed(db_session):
    playlist = add_playlist(db_session, "Gym")
    track = create_track(db_session, title="Song A")

    playlist_tracks = add_tracks_to_playlist(db_session, [track.id, track.id], playlist.id)

    assert len(playlist_tracks) == 2
    assert playlist_tracks[0].track_id == track.id
    assert playlist_tracks[1].track_id == track.id
    assert playlist_tracks[0].id != playlist_tracks[1].id


def test_add_tracks_with_empty_list_fails(db_session):
    playlist = add_playlist(db_session, "Gym")

    with pytest.raises(ValueError, match="No tracks provided"):
        add_tracks_to_playlist(db_session, [], playlist.id)


def test_add_missing_track_fails(db_session):
    playlist = add_playlist(db_session, "Gym")

    with pytest.raises(ValueError, match="Tracks not found"):
        add_tracks_to_playlist(db_session, [999], playlist.id)


def test_remove_one_track_renumbers_positions(db_session):
    playlist = add_playlist(db_session, "Gym")
    track_1 = create_track(db_session, title="Song A")
    track_2 = create_track(db_session, title="Song B")
    track_3 = create_track(db_session, title="Song C")

    playlist_tracks = add_tracks_to_playlist(
        db_session,
        [track_1.id, track_2.id, track_3.id],
        playlist.id,
    )

    remove_tracks_from_playlist(db_session, [playlist_tracks[1].id], playlist.id)

    remaining = (
        db_session.query(PlaylistTrack)
        .filter(PlaylistTrack.playlist_id == playlist.id)
        .order_by(PlaylistTrack.position.asc())
        .all()
    )

    assert len(remaining) == 2
    assert [row.position for row in remaining] == [1, 2]
    assert [row.track_id for row in remaining] == [track_1.id, track_3.id]


def test_remove_many_tracks_renumbers_positions(db_session):
    playlist = add_playlist(db_session, "Gym")
    track_1 = create_track(db_session, title="Song A")
    track_2 = create_track(db_session, title="Song B")
    track_3 = create_track(db_session, title="Song C")

    playlist_tracks = add_tracks_to_playlist(
        db_session,
        [track_1.id, track_2.id, track_3.id],
        playlist.id,
    )

    remove_tracks_from_playlist(
        db_session,
        [playlist_tracks[0].id, playlist_tracks[2].id],
        playlist.id,
    )

    remaining = (
        db_session.query(PlaylistTrack)
        .filter(PlaylistTrack.playlist_id == playlist.id)
        .order_by(PlaylistTrack.position.asc())
        .all()
    )

    assert len(remaining) == 1
    assert remaining[0].track_id == track_2.id
    assert remaining[0].position == 1


def test_remove_invalid_playlist_track_fails(db_session):
    playlist = add_playlist(db_session, "Gym")

    with pytest.raises(ValueError, match="Playlist tracks not found"):
        remove_tracks_from_playlist(db_session, [999], playlist.id)


def test_reorder_playlist_tracks(db_session):
    playlist = add_playlist(db_session, "Gym")
    track_1 = create_track(db_session, title="Song A")
    track_2 = create_track(db_session, title="Song B")
    track_3 = create_track(db_session, title="Song C")

    playlist_tracks = add_tracks_to_playlist(
        db_session,
        [track_1.id, track_2.id, track_3.id],
        playlist.id,
    )

    new_order = [
        playlist_tracks[2].id,
        playlist_tracks[0].id,
        playlist_tracks[1].id,
    ]

    reorder_playlist_tracks(db_session, playlist.id, new_order)

    reordered = (
        db_session.query(PlaylistTrack)
        .filter(PlaylistTrack.playlist_id == playlist.id)
        .order_by(PlaylistTrack.position.asc())
        .all()
    )

    assert [row.id for row in reordered] == new_order
    assert [row.position for row in reordered] == [1, 2, 3]


def test_reorder_with_duplicate_ids_fails(db_session):
    playlist = add_playlist(db_session, "Gym")
    track_1 = create_track(db_session, title="Song A")
    track_2 = create_track(db_session, title="Song B")

    playlist_tracks = add_tracks_to_playlist(db_session, [track_1.id, track_2.id], playlist.id)

    bad_order = [playlist_tracks[0].id, playlist_tracks[0].id]

    with pytest.raises(ValueError, match="duplicate playlist track IDs"):
        reorder_playlist_tracks(db_session, playlist.id, bad_order)


def test_reorder_with_missing_id_fails(db_session):
    playlist = add_playlist(db_session, "Gym")
    track_1 = create_track(db_session, title="Song A")
    track_2 = create_track(db_session, title="Song B")

    playlist_tracks = add_tracks_to_playlist(db_session, [track_1.id, track_2.id], playlist.id)

    bad_order = [playlist_tracks[0].id]

    with pytest.raises(ValueError, match="Invalid reorder list"):
        reorder_playlist_tracks(db_session, playlist.id, bad_order)