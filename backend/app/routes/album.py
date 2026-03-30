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
            Track.album,
            Track.artist,
            func.count(Track.id).label("track_count")
        )
        .filter(Track.album.isnot(None))
        .filter(Track.album != "")
        .group_by(Track.album, Track.artist)
        .order_by(Track.album.asc())
        .all()
    )

    return [
        {
            "album": album,
            "artist": artist,
            "track_count": track_count,
        }
        for album, artist, track_count in results
    ]