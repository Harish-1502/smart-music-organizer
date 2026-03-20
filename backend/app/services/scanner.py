from pathlib import Path
from sqlalchemy.orm import Session
from app.models.track import Track

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


def scan_library(folder_path : str, db: Session):
    """
    Scans all file in the folder and saves them in the database.
    Does extension check, file check, folder check and checks for
    duplicates in the same folder.
    """

    # validate path
    root = validate_folder(folder_path)

    reset_scan_state()
    scan_state["status"] = "scanning"

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

            # Gets the entire path from route to cur directory
            normalized_file_path = str(path.resolve())
            existing = db.query(Track).filter(Track.file_path == normalized_file_path).first()

            # print("Before:")
            # print(scan_state)
            # Duplicate check
            if existing:
                scan_state["duplicates"] += 1
                continue          

            # print("After:")
            # print(scan_state)
            try:
                track = Track(
                    file_path = normalized_file_path,
                    file_name = path.name,
                    extension = path.suffix.lower(),
                    folder_path = str(path.parent.resolve())
                )

                db.add(track)
                db.commit()
                scan_state["inserted"] += 1
            except Exception as exc:
                db.rollback()
                scan_state["failed"] += 1
                print(f"Insert failed for {normalized_file_path}: {exc}")

        # End of scanning
        scan_state["status"] = "completed"
        scan_state["current_file"] = None

    except Exception as exc:
        scan_state["status"] = "failed"
        scan_state["last_error"] = str(exc)
        scan_state["current_file"] = None
        raise