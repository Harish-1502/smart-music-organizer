from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.playlist import Playlist
from app.models.playlistTrack import PlaylistTrack
from app.schemas.playlist import (
    PlaylistCreateRequest,
    PlaylistRenameRequest,
    PlaylistReorderRequest,
    PlaylistAddTrackRequest,
    PlaylistResponse,
    PlaylistTrackResponse,
    PlaylistDetailResponse
)
from app.services.playlist import (
    add_playlist,
    remove_playlist,
    rename_playlist,
    add_tracks_to_playlist,
    remove_tracks_from_playlist,
    reorder_playlist_tracks
)

router = APIRouter(prefix="/playlists", tags=["playlist"])

@router.post("", response_model=PlaylistResponse)
def create_playlist(request: PlaylistCreateRequest, db: Session = Depends(get_db)):
    try:
        playlist = add_playlist(db, request.name)
        return PlaylistResponse(
            id=playlist.id,
            name=playlist.name,
            created_at=playlist.created_at,
            updated_at=playlist.updated_at,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
@router.get("", response_model=list[PlaylistResponse])
def get_playlists(db: Session = Depends(get_db)):
    playlists = db.query(Playlist).order_by(Playlist.created_at.desc()).all()
    return playlists
    
@router.get("/{playlist_id}", response_model=PlaylistDetailResponse)
def get_playlist_detail(playlist_id: int, db: Session = Depends(get_db)):
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()

    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    playlist_tracks = (
        db.query(PlaylistTrack)
        .filter(PlaylistTrack.playlist_id == playlist_id)
        .order_by(PlaylistTrack.position.asc())
        .all()
    )

    tracks_response = []

    for playlist_track in playlist_tracks:
        track = playlist_track.track

        tracks_response.append(
            PlaylistTrackResponse(
                playlist_track_id=playlist_track.id,
                track_id=playlist_track.track_id,
                position=playlist_track.position,
                added_at=playlist_track.added_at,
                title=track.title,
                artist=track.artist,
                album=track.album,
            )
        )

    return PlaylistDetailResponse(
        id=playlist.id,
        name=playlist.name,
        created_at=playlist.created_at,
        updated_at=playlist.updated_at,
        tracks=tracks_response,
    )

@router.delete("/{playlist_id}")
def delete_playlist(playlist_id: int, db: Session = Depends(get_db)):
    try:
        remove_playlist(db, playlist_id)
        return {"result": "Playlist deleted successfully"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.patch("/{playlist_id}", response_model=PlaylistResponse)
def update_playlist_name(
    playlist_id: int,
    request: PlaylistRenameRequest,
    db: Session = Depends(get_db),
):
    try:
        return rename_playlist(db, playlist_id, request.name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
@router.post("/{playlist_id}/tracks", response_model=list[PlaylistTrackResponse])
def add_track_to_playlist(
    playlist_id: int,
    request: PlaylistAddTrackRequest,
    db: Session = Depends(get_db),
):
    try:
        playlist_tracks = add_tracks_to_playlist(
            db=db,
            track_ids=[request.track_id],
            playlist_id=playlist_id,
        )

        response = []

        for playlist_track in playlist_tracks:
            track = playlist_track.track

            response.append(
                PlaylistTrackResponse(
                    playlist_track_id=playlist_track.id,
                    track_id=playlist_track.track_id,
                    position=playlist_track.position,
                    added_at=playlist_track.added_at,
                    title=track.title,
                    artist=track.artist,
                    album=track.album,
                )
            )

        return response

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
@router.delete("/{playlist_id}/tracks/{playlist_track_id}")
def delete_track_from_playlist(
    playlist_id: int,
    playlist_track_id: int,
    db: Session = Depends(get_db),
):
    try:
        remove_tracks_from_playlist(
            db=db,
            playlist_track_ids=[playlist_track_id],
            playlist_id=playlist_id,
        )

        return {"result": "Track removed from playlist successfully"}

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{playlist_id}/reorder")
def reorder_playlist(
    playlist_id: int,
    request: PlaylistReorderRequest,
    db: Session = Depends(get_db),
):
    try:
        reorder_playlist_tracks(
            db=db,
            playlist_id=playlist_id,
            playlist_track_ids=request.playlist_track_ids,
        )

        return {"result": "Playlist reordered successfully"}

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))