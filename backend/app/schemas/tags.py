from datetime import datetime
from pydantic import BaseModel, ConfigDict


class TagCreateRequest(BaseModel):
    name: str
    category: str


class TagResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    category: str


class TrackTagCreateRequest(BaseModel):
    tag_id: int


class TrackTagResponse(BaseModel):
    id: int
    tag_id: int
    name: str
    category: str
    source: str
    confidence: float
    created_at: datetime
