"""add tag reference tracks

Revision ID: f0e1d2c3b4a5
Revises: b1c2d3e4f5a6
Create Date: 2026-05-19 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f0e1d2c3b4a5"
down_revision: Union[str, Sequence[str], None] = "b1c2d3e4f5a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "tag_reference_tracks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tag_id", sa.Integer(), nullable=False),
        sa.Column("track_id", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(), nullable=False),
        sa.Column(
            "source",
            sa.String(),
            server_default="manual_reference",
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=True,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=True,
        ),
        sa.CheckConstraint(
            "label IN ('positive', 'negative')",
            name=op.f("ck_tag_reference_tracks_tag_reference_label"),
        ),
        sa.ForeignKeyConstraint(
            ["tag_id"],
            ["tags.id"],
            name=op.f("fk_tag_reference_tracks_tag_id_tags"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["track_id"],
            ["tracks.id"],
            name=op.f("fk_tag_reference_tracks_track_id_tracks"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_tag_reference_tracks")),
        sa.UniqueConstraint(
            "tag_id",
            "track_id",
            name="uq_tag_reference_track",
        ),
    )
    op.create_index(
        op.f("ix_tag_reference_tracks_id"),
        "tag_reference_tracks",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_tag_reference_tracks_tag_id"),
        "tag_reference_tracks",
        ["tag_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_tag_reference_tracks_track_id"),
        "tag_reference_tracks",
        ["track_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_tag_reference_tracks_track_id"),
        table_name="tag_reference_tracks",
    )
    op.drop_index(
        op.f("ix_tag_reference_tracks_tag_id"),
        table_name="tag_reference_tracks",
    )
    op.drop_index(
        op.f("ix_tag_reference_tracks_id"),
        table_name="tag_reference_tracks",
    )
    op.drop_table("tag_reference_tracks")
