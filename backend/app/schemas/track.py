from pydantic import BaseModel
from typing import Optional, List

class TrackOut(BaseModel):
    id: int
    file_path: str
    file_name: str
    extension: Optional[str] = None
    folder_path: Optional[str] = None

    title: Optional[str] = None
    artist: Optional[str] = None
    album: Optional[str] = None
    duration: Optional[float] = None
    art_path: Optional[str] = None
    metadata_source: Optional[str] = None

    class Config:
        from_attributes = True


class PaginatedTracks(BaseModel):
    items: List[TrackOut]
    page: int
    page_size: int
    total_items: int
    total_pages: int

class TrackUpdate(BaseModel):
    display_title: Optional[str] = None
    display_artist: Optional[str] = None
    display_album: Optional[str] = None