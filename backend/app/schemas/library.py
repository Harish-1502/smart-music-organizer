from pydantic import BaseModel

class LibraryScanRequest(BaseModel):
    folder_path: str