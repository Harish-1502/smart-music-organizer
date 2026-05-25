"""add loudness fields to tracks

Revision ID: a1b2c3d4e5f6
Revises: f0e1d2c3b4a5
Create Date: 2026-05-21 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "f0e1d2c3b4a5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("tracks", schema=None) as batch_op:
        batch_op.add_column(sa.Column("loudness_db", sa.Float(), nullable=True))
        batch_op.add_column(sa.Column("loudness_label", sa.String(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("tracks", schema=None) as batch_op:
        batch_op.drop_column("loudness_label")
        batch_op.drop_column("loudness_db")
