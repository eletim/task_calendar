"""mutable json, indexes, unique constraints

Revision ID: 11dc6301b06b
Revises: 5d07eb43043a
Create Date: 2025-08-19 23:27:22.143283
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '11dc6301b06b'
down_revision = '5d07eb43043a'
branch_labels = None
depends_on = None


def upgrade():
    # routine
    with op.batch_alter_table('routine', schema=None) as batch_op:
        batch_op.alter_column('value',
                              existing_type=sa.INTEGER(),
                              nullable=False)
        batch_op.create_index('ix_routine_user_date', ['user_id', 'date'], unique=False)
        # 外部キーのdrop/createはSQLiteだと危険なので触らない

    # setting
    with op.batch_alter_table('setting', schema=None) as batch_op:
        batch_op.create_unique_constraint('uq_setting_user', ['user_id'])
        # 外部キーは触らない

    # task
    with op.batch_alter_table('task', schema=None) as batch_op:
        batch_op.alter_column('done',
                              existing_type=sa.BOOLEAN(),
                              nullable=False)
        batch_op.alter_column('color',
                              existing_type=sa.VARCHAR(length=7),
                              nullable=False)
        batch_op.alter_column('category',
                              existing_type=sa.VARCHAR(length=16),
                              nullable=False)
        batch_op.create_index('ix_task_user_date', ['user_id', 'date'], unique=False)
        # 外部キーは触らない


def downgrade():
    # task
    with op.batch_alter_table('task', schema=None) as batch_op:
        batch_op.drop_index('ix_task_user_date')
        batch_op.alter_column('category',
                              existing_type=sa.VARCHAR(length=16),
                              nullable=True)
        batch_op.alter_column('color',
                              existing_type=sa.VARCHAR(length=7),
                              nullable=True)
        batch_op.alter_column('done',
                              existing_type=sa.BOOLEAN(),
                              nullable=True)
        # 外部キーは触らない

    # setting
    with op.batch_alter_table('setting', schema=None) as batch_op:
        batch_op.drop_constraint('uq_setting_user', type_='unique')
        # 外部キーは触らない

    # routine
    with op.batch_alter_table('routine', schema=None) as batch_op:
        batch_op.drop_index('ix_routine_user_date')
        batch_op.alter_column('value',
                              existing_type=sa.INTEGER(),
                              nullable=True)
        # 外部キーは触らない
