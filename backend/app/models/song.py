from sqlalchemy import Column, Integer, String
from app.core.database import Base

class Song(Base):
    __tablename__ = "songs"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    artist = Column(String, nullable=True)
    album = Column(String, nullable=True)
    file_path = Column(String, nullable=False, unique=True)