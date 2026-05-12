from datetime import datetime
from typing import Annotated

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
