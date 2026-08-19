"""add workout_reminders_enabled to users

Revision ID: f97d4077e0ad
Revises: 9303fd909e12
Create Date: 2026-08-16 13:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f97d4077e0ad'
down_revision: Union[str, None] = '9303fd909e12'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('workout_reminders_enabled', sa.Boolean(), nullable=False, server_default=sa.true()),
    )


def downgrade() -> None:
    op.drop_column('users', 'workout_reminders_enabled')
