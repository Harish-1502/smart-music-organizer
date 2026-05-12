from pathlib import Path
from app.core.config import settings
from app.core.path_guard import (
    is_supported_audio_file,
    validate_scan_root,
)
from app.core.database import SessionLocal
from sqlalchemy.orm import Session
from app.models.track import Track
from app.services.metadata import extract_metadata
from app.services.art import detect_album_art
from app.services.tag_inference import apply_inferred_tags, refresh_inferred_tags
from app.utils.normalize import apply_normalized_fields
from app.services.track_audio_analysis import analyze_track_audio
import threading

# internal scan data for send to front-end
scan_state = {
    "status": "idle",
    "current_file": None,
    "files_seen": 0,
    "supported_found": 0,
    "inserted": 0,
    "duplicates": 0,
    "failed": 0,
    "user_edited": 0,
    "last_error": None,
}

thread_lock = threading.Lock()

# Reset internal scan checks before each scan
def reset_scan_state():
    scan_state.update({
        "status": "idle",
        "current_file": None,
        "files_seen": 0,
        "supported_found": 0,
        "inserted": 0,
        "duplicates": 0,
        "failed": 0,
        "user_edited": 0,
        "last_error": None,
    })

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

    print(f"\n[DEBUG scan_library:start] root={root_str}")
    print(f"[DEBUG scan_library:start] total_tracks_in_db={db.query(Track).count()}")
    print(
        f"[DEBUG scan_library:start] tracks_under_root="
        f"{db.query(Track).filter(Track.file_path.startswith(root_str)).count()}"
    )

    seen_paths = set()

    try:
        # All files and subfolders
        for path in root.rglob("*"):

            # File check
            if not path.is_file():
                continue

            scan_state["files_seen"] += 1
            scan_state["current_file"] = str(path)

            # Extension check
            if not is_supported_audio_file(path):
                continue

            scan_state["supported_found"] += 1

            # Gets the paths from route to cur directory
            resolved_path = path.resolve()
            normalized_file_path = str(resolved_path)
            normalized_folder_path = str(resolved_path.parent)

            seen_paths.add(normalized_file_path)

            existing = db.query(Track).filter(Track.file_path == normalized_file_path).first()

            metadata = {
                "title": None,
                "artist": None,
                "album": None,
                "duration": None,
                "metadata_source": "unknown",
            }
            art_path = None

            try:
                metadata = extract_metadata(resolved_path)
                art_path = detect_album_art(resolved_path)
            except Exception as e:
                scan_state["last_error"] = f"Metadata extraction failed for {normalized_file_path}: {e}"

            scanned_artist = metadata["artist"]
            scanned_album = metadata["album"]
            scanned_title = metadata["title"]

            if existing:
                scan_state["duplicates"] += 1
                changed = False

                changed |= update_if_changed(existing, "file_name", resolved_path.name)
                changed |= update_if_changed(existing, "extension", resolved_path.suffix.lower())
                changed |= update_if_changed(existing, "folder_path", normalized_folder_path)

                changed |= update_if_changed(existing, "scanned_title", scanned_title)
                changed |= update_if_changed(existing, "scanned_artist", scanned_artist)
                changed |= update_if_changed(existing, "scanned_album", scanned_album)

                changed |= update_if_changed(existing, "duration", metadata.get("duration"))
                changed |= update_if_changed(existing, "metadata_source", metadata.get("metadata_source", "unknown"))
                changed |= update_if_changed(existing, "art_path", art_path)

                if not existing.user_edited:
                    if existing.title != scanned_title:
                        existing.title = scanned_title
                        changed = True
                    if existing.artist != scanned_artist:
                        existing.artist = scanned_artist
                        changed = True
                    if existing.album != scanned_album:
                        existing.album = scanned_album
                        changed = True

                    if existing.display_title != scanned_title:
                        existing.display_title = scanned_title
                        changed = True
                    if existing.display_artist != scanned_artist:
                        existing.display_artist = scanned_artist
                        changed = True
                    if existing.display_album != scanned_album:
                        existing.display_album = scanned_album
                        changed = True
                else:
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
            # print("After:")
            # print(scan_state)

            
            try:
                track = Track(
                    file_path=normalized_file_path,
                    file_name=resolved_path.name,
                    extension=resolved_path.suffix.lower(),
                    folder_path=normalized_folder_path,

                    title=scanned_title,
                    artist=scanned_artist,
                    album=scanned_album,

                    scanned_title=scanned_title,
                    scanned_artist=scanned_artist,
                    scanned_album=scanned_album,

                    display_title=scanned_title,
                    display_artist=scanned_artist,
                    display_album=scanned_album,

                    duration=metadata.get("duration"),
                    metadata_source=metadata.get("metadata_source", "unknown"),
                    art_path=art_path,

                    user_edited=False,
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

        # after loop: remove tracks under this root that were not seen this scan
        print(
            f"[DEBUG scan_library:cleanup] supported_found={scan_state['supported_found']} "
            f"seen_paths={len(seen_paths)}"
        )
        if not seen_paths:
            print(
                f"[DEBUG scan_library:cleanup] WARNING seen_paths is empty for root={root_str}; "
                "cleanup will target every DB row whose file_path starts with this root"
            )

        stale_tracks = db.query(Track).filter(Track.file_path.startswith(root_str))
        if seen_paths:
            stale_tracks = stale_tracks.filter(~Track.file_path.in_(seen_paths))

        stale_list = stale_tracks.all()

        print(f"[DEBUG scan_library:cleanup] stale_count={len(stale_list)}")
        for track in stale_list[:10]:
            candidate = Path(track.file_path)
            real_inside_root = candidate == root or root in candidate.parents
            print(
                f"[DEBUG scan_library:cleanup] stale_candidate={track.file_path} "
                f"real_inside_root={real_inside_root}"
            )
            
        try:
            stale_query = db.query(Track).filter(Track.file_path.startswith(root_str))

            if seen_paths:
                stale_query = stale_query.filter(~Track.file_path.in_(seen_paths))

            deleted = stale_query.delete(synchronize_session=False)
            print(f"[DEBUG scan_library:cleanup] delete_returned={deleted}")
            db.commit()
            print(
                f"[DEBUG scan_library:cleanup] tracks_under_root_after="
                f"{db.query(Track).filter(Track.file_path.startswith(root_str)).count()}"
            )
        except Exception as exc:
            db.rollback()
            scan_state["failed"] += 1
            scan_state["last_error"] = f"Missing-file cleanup failed: {exc}"

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
    
def update_if_changed(obj, field_name, new_value):
    if getattr(obj, field_name) != new_value:
        setattr(obj, field_name, new_value)
        return True
    return False
