"""add cascade to playlist_tracks track_id

Revision ID: b1c2d3e4f5a6
Revises: 80ecb461bf7c
Create Date: 2026-05-12 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b1c2d3e4f5a6"
down_revision: Union[str, Sequence[str], None] = "80ecb461bf7c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

TRACK_FK_NAME = "fk_playlist_tracks_track_id_tracks"


def _track_id_foreign_key() -> dict:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    foreign_keys = inspector.get_foreign_keys("playlist_tracks")
    matches = [
        fk
        for fk in foreign_keys
        if fk.get("constrained_columns") == ["track_id"]
        and fk.get("referred_table") == "tracks"
        and fk.get("referred_columns") == ["id"]
    ]

    if len(matches) != 1:
        raise RuntimeError(
            "Expected exactly one playlist_tracks.track_id foreign key to tracks.id; "
            f"found {len(matches)}."
        )

    return matches[0]


def upgrade() -> None:
    """Upgrade schema."""
    foreign_key = _track_id_foreign_key()
    if (foreign_key.get("options") or {}).get("ondelete") == "CASCADE":
        return

    with op.batch_alter_table(
        "playlist_tracks",
        schema=None,
        naming_convention=NAMING_CONVENTION,
    ) as batch_op:
        batch_op.drop_constraint(TRACK_FK_NAME, type_="foreignkey")
        batch_op.create_foreign_key(
            TRACK_FK_NAME,
            "tracks",
            ["track_id"],
            ["id"],
            ondelete="CASCADE",
        )


def downgrade() -> None:
    """Downgrade schema."""
    foreign_key = _track_id_foreign_key()
    if (foreign_key.get("options") or {}).get("ondelete") != "CASCADE":
        return

    with op.batch_alter_table(
        "playlist_tracks",
        schema=None,
        naming_convention=NAMING_CONVENTION,
    ) as batch_op:
        batch_op.drop_constraint(TRACK_FK_NAME, type_="foreignkey")
        batch_op.create_foreign_key(
            TRACK_FK_NAME,
            "tracks",
            ["track_id"],
            ["id"],
        )
