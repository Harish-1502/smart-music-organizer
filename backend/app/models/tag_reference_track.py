from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from app.core.database import Base


class TagReferenceTrack(Base):
    __tablename__ = "tag_reference_tracks"

    id = Column(Integer, primary_key=True, index=True)

    tag_id = Column(
        Integer,
        ForeignKey("tags.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    track_id = Column(
        Integer,
        ForeignKey("tracks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    label = Column(String, nullable=False)
    source = Column(String, nullable=False, default="manual_reference")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    tag = relationship("Tag")
    track = relationship("Track")

    __table_args__ = (
        CheckConstraint(
            "label IN ('positive', 'negative')",
            name="tag_reference_label",
        ),
        UniqueConstraint(
            "tag_id",
            "track_id",
            name="uq_tag_reference_track",
        ),
    )
