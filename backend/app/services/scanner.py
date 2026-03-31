from pathlib import Path
from backend.app.core.database import SessionLocal
from sqlalchemy.orm import Session
from app.models.track import Track
from app.services.metadata import extract_metadata
from app.services.art import detect_album_art
from app.utils.normalize import apply_normalized_fields
import threading

# All support audio files
SUPPORTED_EXTENSIONS = {".mp3", ".flac", ".wav", ".m4a", ".aac", ".ogg"}

# internal scan data for send to front-end
scan_state = {
    "status": "idle",
    "current_file": None,
    "files_seen": 0,
    "supported_found": 0,
    "inserted": 0,
    "duplicates": 0,
    "failed": 0,
    "last_error": None,
}

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
        "last_error": None,
    })

# Ensure file is a supported audio file
def is_supported_audio_file(path: Path) -> bool:
    return path.suffix.lower() in SUPPORTED_EXTENSIONS

# Ensure scanning happens in the right folder
def validate_folder(folder_path: str) -> Path:
    path = Path(folder_path)
    if not path.exists():
        raise ValueError("Folder does not exist.")
    if not path.is_dir():
        raise ValueError("Provided path is not a folder.")
    return path


def scan_library(folder_path: str):
    """
    Scans all file in the folder and saves them in the database.
    Does extension check, file check, folder check and checks for
    duplicates by using its full path.
    """

    # validate path
    root = validate_folder(folder_path)

    reset_scan_state()
    

    # Create DB session
    db = SessionLocal()

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

            existing = db.query(Track).filter(Track.file_path == normalized_file_path).first()

            # print("Before:")
            # print(scan_state)
            # Duplicate check
            if existing:
                scan_state["duplicates"] += 1
                continue          
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

            # print("After:")
            # print(scan_state)

            scanned_artist = metadata["artist"]
            scanned_album = metadata["album"]
            scanned_title = metadata["title"]

            try:
                track = Track(
                    file_path=normalized_file_path,
                    file_name=resolved_path.name,
                    extension=resolved_path.suffix.lower(),
                    folder_path=normalized_folder_path,

                    # old fields kept temporarily for compatibility
                    title=scanned_title,
                    artist=scanned_artist,
                    album=scanned_album,

                    # new scanner-owned fields
                    scanned_title=scanned_title,
                    scanned_artist=scanned_artist,
                    scanned_album=scanned_album,

                    # display fields start equal to scanned fields
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
                db.commit()
                db.refresh(track)
                scan_state["inserted"] += 1
            except Exception as exc:
                db.rollback()
                scan_state["failed"] += 1
                scan_state["last_error"] = f"Insert failed for {normalized_file_path}: {exc}"

        # End of scanning
        scan_state["status"] = "completed"
        scan_state["current_file"] = None
        
    except Exception as exc:
        scan_state["status"] = "failed"
        scan_state["last_error"] = f"Scan failed: {exc}"
        scan_state["current_file"] = None
        raise

    finally:
        db.close()

# This function would be to create a thread for the scan and run it in the background, allowing the API to remain responsive.
def run_scan_library(folder_path: str) -> str:
    # Check if a scan is already running
    if scan_state["status"] == "scanning":
        # return message saying that it's already running
        return "Scan already in progress"

    # Create a new thread
    try:
        scan_thread = threading.Thread(target=scan_library, args = (folder_path,),daemon=True)

        scan_state["status"] = "scanning"
        # Start it
        scan_thread.start() 
        return "Scan started"
    
    except Exception as exc:
        raise ValueError(f"Failed to start scan: {exc}")
    
   