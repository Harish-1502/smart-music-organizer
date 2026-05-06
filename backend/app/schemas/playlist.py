from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class PlaylistCreateRequest(BaseModel):
    name: str

class PlaylistRenameRequest(BaseModel):
    name: str

class PlaylistReorderRequest(BaseModel):
    playlist_track_ids: List[int]

class PlaylistAddTrackRequest(BaseModel):
    track_id: int

class PlaylistResponse(BaseModel):
    id: int
    name: str
    created_at: datetime
    updated_at: datetime

class PlaylistTrackResponse(BaseModel):
    playlist_track_id: int
    track_id: int
    position: int
    added_at: datetime
    title: str
    artist: str | None = None
    album: str | None = None
    art_path: str | None = None

class PlaylistDetailResponse(BaseModel):
    id: int
    name: str
    created_at: datetime
    updated_at: datetime
    tracks: list[PlaylistTrackResponse]
