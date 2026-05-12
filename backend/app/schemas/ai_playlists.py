from pydantic import BaseModel, Field, ConfigDict, field_validator

from app.schemas.validators import strip_string


class ParsePromptRequest(BaseModel):
    prompt: str = Field(min_length=8, max_length=500)

    @field_validator("prompt", mode="before")
    @classmethod
    def strip_prompt(cls, value):
        return strip_string(value)


class ParsePromptResponse(BaseModel):
    prompt: str
    parsed_rules: dict

class GeneratePlaylistRequest(BaseModel):
    prompt: str = Field(min_length=8, max_length=500)
    limit: int = Field(default=25, ge=1, le=100)
    playlist_name: str | None = Field(default=None, max_length=120)

    @field_validator("prompt", "playlist_name", mode="before")
    @classmethod
    def strip_text_fields(cls, value):
        return strip_string(value)


class GeneratedTrackResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str | None
    artist: str | None
    album: str | None
    display_title: str | None
    display_artist: str | None
    display_album: str | None
    duration: float | None
    art_path: str | None


class GeneratePlaylistResponse(BaseModel):
    prompt: str
    playlist_id: int
    playlist_name: str
    total_duration_minutes: float | None = None
    parsed_rules: dict
    tracks: list[GeneratedTrackResponse]
