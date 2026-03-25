from sqlalchemy import Column, Integer, String, DateTime, func, Float
from app.core.database import Base

class Track(Base):
    __tablename__ = "tracks"

    id = Column(Integer, primary_key=True, index=True)
    file_path = Column(String, unique=True, index=True, nullable=False)
    file_name = Column(String, nullable=False)
    extension = Column(String, nullable=False)
    folder_path = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    title = Column(String, nullable=True)
    artist = Column(String, nullable=True)
    album = Column(String, nullable=True)
    duration = Column(Float, nullable=True)
    art_path = Column(String, nullable=True)
    metadata_source = Column(String, nullable=False, default="unknown")