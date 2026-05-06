from pydantic import BaseModel, Field, ConfigDict


class ParsePromptRequest(BaseModel):
    prompt: str


class ParsePromptResponse(BaseModel):
    prompt: str
    parsed_rules: dict

class GeneratePlaylistRequest(BaseModel):
    prompt: str
    limit: int = Field(default=20, ge=1, le=100)


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
    parsed_rules: dict
    tracks: list[GeneratedTrackResponse]