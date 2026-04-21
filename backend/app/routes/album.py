from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.track import Track

router = APIRouter(prefix="/albums", tags=["albums"])


@router.get("")
def get_albums(db: Session = Depends(get_db)):
    results = (
        db.query(
            Track.display_album,
            Track.display_artist,
            func.count(Track.id).label("track_count")
        )
        .filter(Track.display_album.isnot(None))
        .filter(Track.display_album != "")
        .group_by(Track.display_album, Track.display_artist)
        .order_by(Track.display_album.asc())
        .all()
    )

    return [
        {
            "album": display_album,
            "artist": display_artist,
            "track_count": track_count,
        }
        for display_album, display_artist, track_count in results
    ]