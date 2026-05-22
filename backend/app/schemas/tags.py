from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.validators import reject_control_characters, strip_string


PositiveIntId = Annotated[int, Field(gt=0)]


class TagCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    category: str = Field(min_length=1, max_length=64)

    @field_validator("name", "category", mode="before")
    @classmethod
    def strip_text_fields(cls, value):
        return strip_string(value)

    @field_validator("name", "category")
    @classmethod
    def reject_control_characters_in_text(cls, value):
        return reject_control_characters(value)


class TagResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    category: str


class TrackTagCreateRequest(BaseModel):
    tag_id: PositiveIntId


class TrackTagResponse(BaseModel):
    id: int
    tag_id: int
    name: str
    category: str
    source: str
    confidence: float
    created_at: datetime


class TagReferenceTrackCreate(BaseModel):
    track_id: PositiveIntId
    label: Literal["positive", "negative"]
    source: str = Field(default="manual_reference", min_length=1, max_length=64)

    @field_validator("source", mode="before")
    @classmethod
    def strip_source(cls, value):
        return strip_string(value)

    @field_validator("source")
    @classmethod
    def reject_control_characters_in_source(cls, value):
        return reject_control_characters(value)


class TagReferenceTrackRead(BaseModel):
    id: int
    tag_id: int
    track_id: int
    label: Literal["positive", "negative"]
    source: str
    track_title: str | None
    track_artist: str | None
    track_file_name: str
    created_at: datetime


class TagReferenceTrackDeleteResponse(BaseModel):
    message: str
    tag_id: int
    track_id: int


class MatchedReferenceRead(BaseModel):
    track_id: int
    title: str | None = None
    artist: str | None = None
    file_name: str | None = None
    label: Literal["positive", "negative"]
    similarity: float


class ReferenceTagSuggestionRead(BaseModel):
    track_id: int
    tag_id: int
    title: str | None = None
    artist: str | None = None
    file_name: str | None = None
    final_score: float
    positive_score: float
    negative_score: float
    reasons: list[str]
    positive_matches: list[MatchedReferenceRead] = Field(default_factory=list)
    negative_matches: list[MatchedReferenceRead] = Field(default_factory=list)


class GlobalReferenceTagSuggestionRead(ReferenceTagSuggestionRead):
    tag_name: str


class ReferenceSuggestionBatchRequest(BaseModel):
    track_ids: list[PositiveIntId] = Field(min_length=1)


class ReferenceSuggestionBatchResponse(BaseModel):
    tag_id: int
    track_ids: list[int]
    skipped_track_ids: list[int] = Field(default_factory=list)
    accepted_count: int | None = None
    rejected_count: int | None = None
