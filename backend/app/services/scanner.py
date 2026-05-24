from pathlib import Path
import logging
import threading

from app.core.config import settings
from app.core.path_guard import (
    validate_scan_root,
)
from app.core.database import SessionLocal
from sqlalchemy.orm import Session
from app.models.track import Track
from app.services.tag_inference import apply_inferred_tags, refresh_inferred_tags
from app.utils.normalize import apply_normalized_fields
from app.services.track_audio_analysis import analyze_track_audio
from app.services.scan_state import reset_scan_state, scan_state
from app.services.scan_file_discovery import discover_audio_files
from app.services.scan_track_metadata import load_track_metadata_and_art
from app.services.scan_track_persistence import (
    apply_scanned_track_update,
    build_scanned_track,
)
from app.services.scan_stale_cleanup import cleanup_stale_tracks

logger = logging.getLogger(__name__)
thread_lock = threading.Lock()

# Ensure scanning happens in the right folder
def validate_folder(folder_path: str) -> Path:
    return validate_scan_root(folder_path, settings.allowed_scan_roots)


def scan_library(root: Path | str, db: Session):
    """
    Scans all files in the folder and saves them in the database.
    Does extension check, file check, folder check and checks for
    duplicates by using its full path.
    """
    root = Path(root)
    root = validate_folder(str(root))
    root_str = str(root.resolve())

    logger.debug("Starting library scan for root=%s", root_str)
    logger.debug("Total tracks in database before scan: %s", db.query(Track).count())
    logger.debug(
        "Tracks under scan root before scan: %s",
        db.query(Track).filter(Track.file_path.startswith(root_str)).count(),
    )

    seen_paths = set()

    try:
        def mark_file_seen(path: Path):
            scan_state["files_seen"] += 1
            scan_state["current_file"] = str(path)

        # All supported audio files from this folder and its subfolders
        for path in discover_audio_files(
            root,
            on_file_seen=mark_file_seen,
            allowed_roots=settings.allowed_scan_roots,
        ):
            scan_state["supported_found"] += 1

            # Gets the paths from route to cur directory
            resolved_path = path.resolve()
            normalized_file_path = str(resolved_path)
            normalized_folder_path = str(resolved_path.parent)

            seen_paths.add(normalized_file_path)

            existing = db.query(Track).filter(Track.file_path == normalized_file_path).first()

            metadata, art_path, metadata_error = load_track_metadata_and_art(resolved_path)
            if metadata_error:
                scan_state["last_error"] = f"Metadata extraction failed for {normalized_file_path}: {metadata_error}"

            if existing:
                scan_state["duplicates"] += 1
                changed = apply_scanned_track_update(
                    existing,
                    resolved_path,
                    normalized_folder_path,
                    metadata,
                    art_path,
                )

                if existing.user_edited:
                    scan_state["user_edited"] += 1

                if changed:
                    apply_normalized_fields(existing)
                    analyze_track_audio(db, existing)
                    refresh_inferred_tags(db, existing)
                    try:
                        db.commit()
                        db.refresh(existing)
                    except Exception as exc:
                        db.rollback()
                        scan_state["failed"] += 1
                        scan_state["last_error"] = f"Update failed for {normalized_file_path}: {exc}"

                continue
            try:
                track = build_scanned_track(
                    resolved_path,
                    normalized_file_path,
                    normalized_folder_path,
                    metadata,
                    art_path,
                )

                apply_normalized_fields(track)

                db.add(track)                
                db.flush()
                analyze_track_audio(db, track)                
                apply_inferred_tags(db, track)

                db.commit()
                db.refresh(track)
                scan_state["inserted"] += 1
            except Exception as exc:
                db.rollback()
                scan_state["failed"] += 1
                scan_state["last_error"] = f"Insert failed for {normalized_file_path}: {exc}"

        _deleted, cleanup_error = cleanup_stale_tracks(
            db,
            root,
            root_str,
            seen_paths,
            scan_state["supported_found"],
        )
        if cleanup_error:
            scan_state["failed"] += 1
            scan_state["last_error"] = f"Missing-file cleanup failed: {cleanup_error}"

        scan_state["status"] = "completed"
        scan_state["current_file"] = None

    except Exception as exc:
        scan_state["status"] = "failed"
        scan_state["last_error"] = f"Scan failed: {exc}"
        scan_state["current_file"] = None
        raise
    
def scan_library_worker(root: Path):
    db = SessionLocal()
    try:
        scan_library(root, db)
    finally:
        db.close()

# This function would be to create a thread for the scan and run it in the background, allowing the API to remain responsive.
def run_scan_library(folder_path: str) -> str:

    with thread_lock:
        # Check if a scan is already running
        if scan_state["status"] == "scanning":
            # return message saying that it's already running
            return "Scan already in progress"
    
        # validate path
        root = validate_folder(folder_path)

        reset_scan_state()
        scan_state["status"] = "scanning"
        
        # Create a new thread
        try:
            scan_thread = threading.Thread(target=scan_library_worker, args = (root,),daemon=True)

            # Start it
            scan_thread.start() 
            return "Scan started"
        
        except Exception as exc:
            reset_scan_state()
            raise ValueError(f"Failed to start scan: {exc}")
    
