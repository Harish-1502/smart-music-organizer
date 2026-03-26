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
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = db.query(Track)

    # Search
    if search:
        search_term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Track.title.ilike(search_term),
                Track.artist.ilike(search_term),
                Track.album.ilike(search_term),
            )
        )

    # Safe sorting
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

    # Count before pagination
    total_items = query.count()
    total_pages = ceil(total_items / page_size) if total_items > 0 else 1

    # Pagination
    offset = (page - 1) * page_size
    tracks = query.offset(offset).limit(page_size).all()

    return PaginatedTracks(
        items=tracks,
        page=page,
        page_size=page_size,
        total_items=total_items,
        total_pages=total_pages,
    )