from datetime import datetime, timezone
from sqlalchemy import func
from app.models.playlist import Playlist
from app.models.playlistTrack import PlaylistTrack
from app.models.track import Track

def add_playlist(db, name: str) -> Playlist:
    # Remove extra spaces from the playlist name
    clean_name = name.strip()

    # Reject empty names like "" or "   "
    if not clean_name:
        raise ValueError("Playlist name cannot be empty")

    # Check if another playlist already has this name, ignoring case
    existing_playlist = (
        db.query(Playlist)
        .filter(func.lower(Playlist.name) == clean_name.lower())
        .first()
    )

    # If found, do not create a duplicate playlist name
    if existing_playlist:
        raise ValueError("Playlist with this name already exists")

    try:
        # Create a new Playlist object
        new_playlist = Playlist(name=clean_name)

        # Add it to the database session
        db.add(new_playlist)

        # Save changes to the database
        db.commit()

        # Reload it so id/created_at/updated_at are available
        db.refresh(new_playlist)

        # Return the created playlist
        return new_playlist

    except Exception:
        # Undo database changes if anything fails
        db.rollback()
        raise

def remove_playlist(db, playlist_id: int) -> None:
    # Find the playlist by id
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()

    # If it does not exist, stop
    if not playlist:
        raise ValueError("Playlist not found")

    try:
        # Delete playlist
        # Because of cascade, its PlaylistTrack rows should also be deleted
        db.delete(playlist)

        # Save deletion
        db.commit()

    except Exception:
        # Undo if delete fails
        db.rollback()
        raise

def rename_playlist(db, playlist_id: int, new_name: str) -> Playlist:
    # Find playlist being renamed
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()

    # Stop if playlist does not exist
    if not playlist:
        raise ValueError("Playlist not found")

    # Clean new name
    clean_name = new_name.strip()

    # Reject empty new name
    if not clean_name:
        raise ValueError("Playlist name cannot be empty")

    # Check if another playlist already has this name
    # Important: exclude the current playlist itself
    name_exists = (
        db.query(Playlist)
        .filter(func.lower(Playlist.name) == clean_name.lower())
        .filter(Playlist.id != playlist_id)
        .first()
    )

    # If another playlist uses the name, reject it
    if name_exists:
        raise ValueError("Playlist with this name already exists")

    try:
        # Update playlist name
        playlist.name = clean_name

        # Manually update timestamp because renaming changes playlist
        playlist.updated_at = datetime.now(timezone.utc)

        # Save changes
        db.commit()

        # Reload updated playlist
        db.refresh(playlist)

        # Return updated playlist
        return playlist

    except Exception:
        # Undo if update fails
        db.rollback()
        raise
    
def add_tracks_to_playlist(db, track_ids: list[int], playlist_id: int) -> list[PlaylistTrack]:
    # Find playlist
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()

    # Stop if playlist does not exist
    if not playlist:
        raise ValueError("Playlist not found")

    # Reject empty input
    if not track_ids:
        raise ValueError("No tracks provided")

    # Load all tracks that match the requested track ids
    found_tracks = db.query(Track).filter(Track.id.in_(track_ids)).all()

    # Convert found tracks into a set of ids
    found_track_ids = {track.id for track in found_tracks}

    # Find which requested ids were not found
    missing_track_ids = set(track_ids) - found_track_ids

    # Stop if any requested track does not exist
    if missing_track_ids:
        raise ValueError(f"Tracks not found: {sorted(missing_track_ids)}")

    # Load current playlist entries
    existing_playlist_tracks = (
        db.query(PlaylistTrack)
        .filter(PlaylistTrack.playlist_id == playlist_id)
        .all()
    )

    # Find current highest position
    max_position = max(
        (playlist_track.position for playlist_track in existing_playlist_tracks),
        default=0,
    )

    # Store new PlaylistTrack rows here
    new_playlist_tracks = []

    # For each track id requested
    for track_id in track_ids:
        # Move position forward by 1
        max_position += 1

        # Create a playlist entry
        # Duplicates are allowed, so no duplicate check happens here
        new_playlist_track = PlaylistTrack(
            playlist_id=playlist_id,
            track_id=track_id,
            position=max_position,
        )

        # Add new row object to list
        new_playlist_tracks.append(new_playlist_track)

    try:
        # Add all new playlist entries to DB session
        db.add_all(new_playlist_tracks)

        # Update playlist timestamp because contents changed
        playlist.updated_at = datetime.now(timezone.utc)

        # Save all inserts at once
        db.commit()

        # Refresh each new row so id/added_at are available
        for playlist_track in new_playlist_tracks:
            db.refresh(playlist_track)

        # Return created playlist entries
        return new_playlist_tracks

    except Exception:
        # Undo if insert fails
        db.rollback()
        raise

def remove_tracks_from_playlist(db, playlist_track_ids: list[int], playlist_id: int) -> None:
    # Find playlist
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()

    # Stop if playlist does not exist
    if not playlist:
        raise ValueError("Playlist not found")

    # Reject empty input
    if not playlist_track_ids:
        raise ValueError("No playlist tracks provided")

    # Load only playlist entries that:
    # 1. belong to this playlist
    # 2. have ids inside playlist_track_ids
    rows_to_delete = (
        db.query(PlaylistTrack)
        .filter(
            PlaylistTrack.playlist_id == playlist_id,
            PlaylistTrack.id.in_(playlist_track_ids),
        )
        .all()
    )

    # Convert found rows into ids
    found_ids = {row.id for row in rows_to_delete}

    # Convert requested ids into a set
    requested_ids = set(playlist_track_ids)

    # If found ids do not match requested ids, some ids were invalid
    if found_ids != requested_ids:
        missing_ids = requested_ids - found_ids
        raise ValueError(f"Playlist tracks not found: {sorted(missing_ids)}")

    try:
        # Delete only the selected playlist-track rows
        for row in rows_to_delete:
            db.delete(row)

        # Push deletion into the DB transaction before re-querying
        db.flush()

        # Load remaining playlist entries in current order
        remaining_rows = (
            db.query(PlaylistTrack)
            .filter(PlaylistTrack.playlist_id == playlist_id)
            .order_by(PlaylistTrack.position.asc())
            .all()
        )

        # Renumber remaining rows to 1, 2, 3...
        for index, row in enumerate(remaining_rows, start=1):
            row.position = index

        # Update playlist timestamp because contents changed
        playlist.updated_at = datetime.now(timezone.utc)

        # Save deletion + renumbering together
        db.commit()

    except Exception:
        # Undo if anything fails
        db.rollback()
        raise

def reorder_playlist_tracks(db, playlist_id: int, playlist_track_ids: list[int]) -> None:
    # Find playlist
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()

    # Stop if playlist does not exist
    if not playlist:
        raise ValueError("Playlist not found")

    # Load all playlist entries for this playlist
    existing_tracks = (
        db.query(PlaylistTrack)
        .filter(PlaylistTrack.playlist_id == playlist_id)
        .all()
    )

    # Store existing playlist-track ids
    existing_track_ids = {track.id for track in existing_tracks}

    # Store requested playlist-track ids
    requested_track_ids = set(playlist_track_ids)

    # Check for duplicate ids in the reorder request
    if len(playlist_track_ids) != len(requested_track_ids):
        raise ValueError("Reorder list contains duplicate playlist track IDs")

    # Check that request contains exactly the current playlist entries
    if requested_track_ids != existing_track_ids:
        missing_ids = existing_track_ids - requested_track_ids
        extra_ids = requested_track_ids - existing_track_ids

        raise ValueError(
            f"Invalid reorder list. Missing: {sorted(missing_ids)}, extra: {sorted(extra_ids)}"
        )

    # Build dictionary so the code does not query inside the loop
    # Key = PlaylistTrack.id, Value = PlaylistTrack row
    track_by_id = {track.id: track for track in existing_tracks}

    try:
        # Rewrite position based on new order
        for index, playlist_track_id in enumerate(playlist_track_ids, start=1):
            track_by_id[playlist_track_id].position = index

        # Update playlist timestamp because order changed
        playlist.updated_at = datetime.now(timezone.utc)

        # Save all position changes together
        db.commit()

    except Exception:
        # Undo if reorder fails
        db.rollback()
        raise