from typing import Annotated, List
from datetime import datetime

from pydantic import BaseModel, Field, field_serializer, field_validator

from app.schemas.public_paths import expose_art_path
from app.schemas.validators import strip_string


PositiveIntId = Annotated[int, Field(gt=0)]

class PlaylistCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value):
        return strip_string(value)

class PlaylistRenameRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value):
        return strip_string(value)

class PlaylistReorderRequest(BaseModel):
    playlist_track_ids: List[PositiveIntId] = Field(min_length=1, max_length=1000)

class PlaylistAddTrackRequest(BaseModel):
    track_id: PositiveIntId

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

    @field_serializer("art_path")
    def serialize_art_path(self, value):
        return expose_art_path(value)

class PlaylistDetailResponse(BaseModel):
    id: int
    name: str
    created_at: datetime
    updated_at: datetime
    tracks: list[PlaylistTrackResponse]
