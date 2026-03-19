from sqlalchemy import Column, Integer, String, DateTime, func
from app.db import Base

class Song(Base):
    __tablename__ = "tracks"

    id = Column(Integer, primary_key=True, index=True)
    file_path = Column(String, unique=True, index=True, nullable=False)
    file_name = Column(String, nullable=False)
    extension = Column(String, nullable=False)
    folder_path = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())