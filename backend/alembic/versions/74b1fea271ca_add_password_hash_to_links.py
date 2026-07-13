"""add_password_hash_to_links

Revision ID: 74b1fea271ca
Revises: 5db7f0b97cd5
Create Date: 2026-07-14 00:12:53.650090

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '74b1fea271ca'
down_revision: Union[str, Sequence[str], None] = '5db7f0b97cd5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    from sqlalchemy.engine import reflection
    conn = op.get_bind()
    inspect_obj = reflection.Inspector.from_engine(conn)
    columns = [col['name'] for col in inspect_obj.get_columns('links')]
    if 'password_hash' not in columns:
        op.add_column('links', sa.Column('password_hash', sa.String(length=100), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    from sqlalchemy.engine import reflection
    conn = op.get_bind()
    inspect_obj = reflection.Inspector.from_engine(conn)
    columns = [col['name'] for col in inspect_obj.get_columns('links')]
    if 'password_hash' in columns:
        op.drop_column('links', 'password_hash')
