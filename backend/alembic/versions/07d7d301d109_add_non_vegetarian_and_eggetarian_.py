"""add non_vegetarian and eggetarian to dietary_preference_enum

Revision ID: 07d7d301d109
Revises: 24807337a960
Create Date: 2026-08-15 19:05:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '07d7d301d109'
down_revision: Union[str, None] = '24807337a960'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Values are the Python enum members' *names* (NON_VEGETARIAN,
    # EGGETARIAN), not their .value strings — SQLAlchemy's Enum(PyEnumClass)
    # binds/stores by name by default (no values_callable is configured
    # anywhere in this codebase), matching every existing label already in
    # this type (see 1ede5e6ec696_init_schema.py: 'NONE', 'VEGETARIAN', ...).
    #
    # Additive only — existing rows stay valid. Postgres 12+ allows ADD
    # VALUE inside a transaction as long as the new value isn't used by a
    # later statement in the same transaction, which this migration doesn't do.
    op.execute("ALTER TYPE dietary_preference_enum ADD VALUE IF NOT EXISTS 'NON_VEGETARIAN'")
    op.execute("ALTER TYPE dietary_preference_enum ADD VALUE IF NOT EXISTS 'EGGETARIAN'")


def downgrade() -> None:
    # Postgres has no DROP VALUE for enum types — removing a value requires
    # rebuilding the type (rename old, create new without the value, cast
    # every column across). Not worth it for a downgrade path; any row
    # actually using these values would block a real downgrade anyway.
    pass
