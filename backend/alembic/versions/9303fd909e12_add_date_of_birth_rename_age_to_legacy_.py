"""add date_of_birth, rename age to legacy_age

Revision ID: 9303fd909e12
Revises: 07d7d301d109
Create Date: 2026-08-16 13:10:00.000000

Age becomes derived data (see User.age property) instead of an
independently-editable column, so it can never drift out of sync with a
user's actual date of birth. Existing rows keep their current age value
under legacy_age as a fallback — there's no way to safely synthesize a real
birthdate from just an age integer, so this deliberately does not attempt
to backfill date_of_birth for pre-existing accounts. No data is dropped.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9303fd909e12'
down_revision: Union[str, None] = '07d7d301d109'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('users', 'age', new_column_name='legacy_age')
    # New signups no longer set legacy_age at all (they set date_of_birth
    # instead), so the column must accept NULL going forward.
    op.alter_column('users', 'legacy_age', nullable=True)
    op.add_column('users', sa.Column('date_of_birth', sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'date_of_birth')
    # Reverting nullable=True -> NOT NULL would fail if any row inserted
    # after this migration has a null legacy_age (i.e. every DOB-based
    # signup since) — same "can't cleanly downgrade past this point"
    # situation as other additive migrations in this project.
    op.alter_column('users', 'legacy_age', new_column_name='age')
