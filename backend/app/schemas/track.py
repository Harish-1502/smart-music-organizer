from typing import Optional, List

from pydantic import BaseModel, Field, field_serializer, field_validator

from app.schemas.public_paths import expose_art_path, expose_local_path
from app.schemas.validators import strip_string

class TrackOut(BaseModel):
    id: int
    file_path: Optional[str] = None
    file_name: str
    extension: Optional[str] = None
    folder_path: Optional[str] = None

    title: Optional[str] = None
    artist: Optional[str] = None
    album: Optional[str] = None
    scanned_title: Optional[str] = None
    scanned_artist: Optional[str] = None
    scanned_album: Optional[str] = None
    display_title: Optional[str] = None
    display_artist: Optional[str] = None
    display_album: Optional[str] = None
    title_normalized: Optional[str] = None
    artist_normalized: Optional[str] = None
    album_normalized: Optional[str] = None
    duration: Optional[float] = None
    art_path: Optional[str] = None
    metadata_source: Optional[str] = None
    user_edited: Optional[bool] = None

    class Config:
        from_attributes = True

    @field_serializer("file_path", "folder_path")
    def serialize_local_path(self, value):
        return expose_local_path(value)

    @field_serializer("art_path")
    def serialize_art_path(self, value):
        return expose_art_path(value)


class PaginatedTracks(BaseModel):
    items: List[TrackOut]
    page: int
    page_size: int
    total_items: int
    total_pages: int

class TrackUpdateRequest(BaseModel):
    title: str | None = Field(default=None, max_length=255)
    artist: str | None = Field(default=None, max_length=255)
    album: str | None = Field(default=None, max_length=255)

    @field_validator("title", "artist", "album", mode="before")
    @classmethod
    def strip_metadata_field(cls, value):
        return strip_string(value)

    @field_validator("title")
    @classmethod
    def reject_empty_title(cls, value):
        if value == "":
            raise ValueError("Title cannot be empty")
        return value
