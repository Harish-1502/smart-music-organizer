"""Shared scan progress state for library scans."""

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
