from pydantic import BaseModel, Field, field_validator

from app.schemas.validators import strip_string

class LibraryScanRequest(BaseModel):
    folder_path: str = Field(min_length=1, max_length=1024)

    @field_validator("folder_path", mode="before")
    @classmethod
    def strip_folder_path(cls, value):
        return strip_string(value)
