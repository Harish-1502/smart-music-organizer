from sqlalchemy import Column, Integer, String, DateTime, func, Float, Boolean, Text
from sqlalchemy.orm import relationship
from app.core.database import Base


class Track(Base):
    __tablename__ = "tracks"

    id = Column(Integer, primary_key=True, index=True)
    file_path = Column(String, unique=True, index=True, nullable=False)
    file_name = Column(String, nullable=False)
    extension = Column(String, nullable=False)
    folder_path = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # old fields
    title = Column(String, nullable=True)
    artist = Column(String, nullable=True)
    album = Column(String, nullable=True)

    # new fields
    scanned_title = Column(String, nullable=True)
    scanned_artist = Column(String, nullable=True)
    scanned_album = Column(String, nullable=True)

    display_title = Column(String, nullable=True)
    display_artist = Column(String, nullable=True)
    display_album = Column(String, nullable=True)

    title_normalized = Column(String, nullable=True, index=True)
    artist_normalized = Column(String, nullable=True, index=True)
    album_normalized = Column(String, nullable=True, index=True)

    duration = Column(Float, nullable=True)
    art_path = Column(String, nullable=True)
    metadata_source = Column(String, nullable=False, default="unknown")

    bpm = Column(Float, nullable=True)
    bpm_confidence = Column(Float, nullable=True)

    energy_score = Column(Float, nullable=True)
    energy_label = Column(String, nullable=True)
    energy_confidence = Column(Float, nullable=True)

    loudness_db = Column(Float, nullable=True)
    loudness_label = Column(String, nullable=True)

    audio_analyzed_at = Column(DateTime(timezone=True), nullable=True)
    audio_analysis_error = Column(Text, nullable=True)

    user_edited = Column(Boolean, nullable=False, default=False)

    track_tags = relationship(
        "TrackTag",
        back_populates="track",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )