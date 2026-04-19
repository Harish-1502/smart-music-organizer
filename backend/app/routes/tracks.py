from fastapi import HTTPException
from math import ceil

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.track import Track
from app.schemas.track import PaginatedTracks, TrackUpdateRequest

router = APIRouter(prefix="/tracks", tags=["tracks"])

@router.get("", response_model=PaginatedTracks)
def get_tracks(
    search: str | None = Query(default=None),
    sort_by: str = Query(default="title"),
    order: str = Query(default="asc"),
    artist: str | None = Query(default=None),
    album: str | None = Query(default=None),
    extension: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    db: Session = Depends(get_db),
):
    print("GET /tracks called")
    print(f"Query params - search: {search}, sort_by: {sort_by}, order: {order}, artist: {artist}, album: {album}, extension: {extension}, page: {page}, page_size: {page_size}")
    query = db.query(Track)
    print("base query created")

    if search:
        search_term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Track.display_title.ilike(search_term),
                Track.display_artist.ilike(search_term),
                Track.display_album.ilike(search_term),
            )
        )   
        print("search applied")

    if artist:
        query = query.filter(Track.display_artist.ilike(f"%{artist.strip()}%"))
        print(query)

    if album:
        query = query.filter(Track.display_album.ilike(f"%{album.strip()}%"))

    if extension:
        query = query.filter(Track.extension == extension)

    allowed_sort_fields = {
        "title": Track.display_title,
        "artist": Track.display_artist,
        "album": Track.display_album,
        "duration": Track.duration,
    }

    sort_column = allowed_sort_fields.get(sort_by, Track.display_title)

    if order.lower() == "desc":
        query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(sort_column.asc())

    print("before count")
    total_items = query.count()
    print("after count", total_items)

    total_pages = ceil(total_items / page_size) if total_items > 0 else 1

    offset = (page - 1) * page_size
    print("before fetch")
    tracks = query.offset(offset).limit(page_size).all()
    print("after fetch", len(tracks))

    return PaginatedTracks(
        items=tracks,
        page=page,
        page_size=page_size,
        total_items=total_items,
        total_pages=total_pages,
    )

@router.patch("/{track_id}", response_model=TrackUpdateRequest)
def update_track(track_id: int, data: TrackUpdateRequest, db: Session = Depends(get_db)):
    track = db.query(Track).filter(Track.id == track_id).first()
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    
    track.user_edited = True

    if data.title is not None:
        track.title = data.title
        track.display_title = data.title
    if data.artist is not None:
        track.artist = data.artist
        track.display_artist = data.artist
    if data.album is not None:
        track.album = data.album
        track.display_album = data.album

    try:
        db.commit()
        db.refresh(track)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update track: {e}")
    
    return TrackUpdateRequest(
        title=track.title,
        artist=track.artist,
        album=track.album,
    )