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
            Track.display_artist,
            func.count(Track.id).label("track_count")
        )
        .filter(Track.display_artist.isnot(None))
        .filter(Track.display_artist != "")
        .group_by(Track.display_artist)
        .order_by(Track.display_artist.asc())
        .all()
    )

    return [
        {
            "artist": display_artist,
            "track_count": track_count,
        }
        for display_artist, track_count in results
    ]