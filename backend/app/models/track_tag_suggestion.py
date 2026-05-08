from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    DateTime,
    ForeignKey,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from app.core.database import Base


class TrackTagSuggestion(Base):
    __tablename__ = "track_tag_suggestions"

    id = Column(Integer, primary_key=True, index=True)

    track_id = Column(
        Integer,
        ForeignKey("tracks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    tag_id = Column(
        Integer,
        ForeignKey("tags.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    source = Column(String, nullable=False, default="rule")
    confidence = Column(Float, nullable=False, default=0.5)

    status = Column(String, nullable=False, default="pending", index=True)
    # pending, accepted, rejected

    reason = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    track = relationship("Track")
    tag = relationship("Tag")

    __table_args__ = (
        UniqueConstraint(
            "track_id",
            "tag_id",
            name="uq_track_tag_suggestion",
        ),
    )