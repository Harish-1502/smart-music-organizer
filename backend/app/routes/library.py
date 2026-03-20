from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.library import LibraryScanRequest
from app.services.scanner import scan_library, scan_state, reset_scan_state
from app.models.track import Track

router = APIRouter(prefix="/library", tags=["library"])

@router.post("/scan")
def start_library_scan(payload: LibraryScanRequest, db: Session = Depends(get_db)):
    try:
        scan_library(payload.folder_path, db)
        return {"message": "Scan completed"}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Scan failed: {exc}")

@router.get("/scan-status")
def get_scan_status():
    return scan_state

@router.delete("/clear")
def clear_library(db: Session = Depends(get_db)):
    deleted = db.query(Track).delete()
    db.commit()
    reset_scan_state()

    return {
        "message": "Library cleared",
        "deleted_tracks": deleted,
    }