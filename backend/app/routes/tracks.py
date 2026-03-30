from math import ceil

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.track import Track
from app.schemas.track import PaginatedTracks

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

    query = db.query(Track)
    print("base query created")

    if search:
        search_term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Track.title.ilike(search_term),
                Track.artist.ilike(search_term),
                Track.album.ilike(search_term),
            )
        )   
        print("search applied")

    if artist:
        query = query.filter(Track.artist == artist.strip())

    if album:
        query = query.filter(Track.album == album.strip())

    if extension:
        query = query.filter(Track.extension == extension)

    allowed_sort_fields = {
        "title": Track.title,
        "artist": Track.artist,
        "album": Track.album,
        "duration": Track.duration,
    }

    sort_column = allowed_sort_fields.get(sort_by, Track.title)

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