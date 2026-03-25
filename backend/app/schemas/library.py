from pydantic import BaseModel

class LibraryScanRequest(BaseModel):
    folder_path: str

class ScanStatusResponse(BaseModel):
    status: str
    current_file: str | None = None
    files_seen: int
    supported_found: int
    inserted: int
    duplicates: int
    failed: int
    last_error: str | None = None