"""add accent_color to users

Revision ID: da74ebb6ec5d
Revises: cf99115b312e
Create Date: 2026-08-07 07:27:24.647126

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'da74ebb6ec5d'
down_revision: Union[str, None] = 'cf99115b312e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # NOTE: autogenerate also proposed dropping ix_exercises_embedding_hnsw
    # here — a false positive. That index was created via raw SQL in
    # cf99115b312e (op.execute, not a SQLAlchemy Index() construct), so it's
    # invisible to the model metadata autogenerate diffs against, and it
    # read "exists in DB, not in models" as "should be removed". Left out
    # entirely; the index is untouched by this migration.
    op.add_column(
        "users",
        sa.Column("accent_color", sa.String(length=30), nullable=False, server_default="violet"),
    )


def downgrade() -> None:
    op.drop_column("users", "accent_color")
