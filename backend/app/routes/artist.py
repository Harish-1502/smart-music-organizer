from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.track import Track

router = APIRouter(prefix="/artists", tags=["artists"])


@router.get("")
def get_artists(db: Session = Depends(get_db)):
    results = (
        db.query(
            Track.artist,
            func.count(Track.id).label("track_count")
        )
        .filter(Track.artist.isnot(None))
        .filter(Track.artist != "")
        .group_by(Track.artist)
        .order_by(Track.artist.asc())
        .all()
    )

    return [
        {
            "artist": artist,
            "track_count": track_count,
        }
        for artist, track_count in results
    ]