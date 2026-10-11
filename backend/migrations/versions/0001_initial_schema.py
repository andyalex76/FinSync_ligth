"""Initial schema migration

Revision ID: 0001_initial_schema
Revises: 
Create Date: 2026-09-12 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 0. Enable uuid extension if available
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";')

    # 1. users
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('telegram_id', sa.BigInteger(), nullable=True),
        sa.Column('username', sa.String(length=64), nullable=True),
        sa.Column('first_name', sa.String(length=128), nullable=False),
        sa.Column('last_name', sa.String(length=128), nullable=True),
        sa.Column('avatar_url', sa.Text(), nullable=True),
        sa.Column('language_code', sa.String(length=8), nullable=False, server_default='ru'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('idx_users_telegram_id', 'users', ['telegram_id'], unique=True)

    # 2. family
    op.create_table(
        'family',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(length=128), nullable=False),
        sa.Column('base_currency', sa.String(length=3), nullable=False, server_default='RUB'),
        sa.Column('invite_code', sa.String(length=16), nullable=False),
        sa.Column('created_by_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('idx_family_invite_code', 'family', ['invite_code'], unique=True)

    # 3. family_members
    op.create_table(
        'family_members',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('family_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('family.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('role', sa.String(length=16), nullable=False, server_default='member'),
        sa.Column('display_name', sa.String(length=64), nullable=False),
        sa.Column('avatar_emoji', sa.String(length=8), nullable=False, server_default='👤'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('family_id', 'user_id', name='uq_family_user')
    )
    op.create_index('idx_family_members_family', 'family_members', ['family_id'])

    # 4. categories
    op.create_table(
        'categories',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('family_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('family.id', ondelete='CASCADE'), nullable=False),
        sa.Column('parent_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('categories.id', ondelete='SET NULL'), nullable=True),
        sa.Column('name', sa.String(length=64), nullable=False),
        sa.Column('icon', sa.String(length=32), nullable=False, server_default='Tag'),
        sa.Column('color', sa.String(length=16), nullable=False, server_default='emerald'),
        sa.Column('is_income', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('idx_categories_family', 'categories', ['family_id'])
    op.create_index('idx_categories_parent', 'categories', ['parent_id'])

    # 5. tags
    op.create_table(
        'tags',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('family_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('family.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(length=32), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('family_id', 'name', name='uq_family_tag')
    )
    op.create_index('idx_tags_family', 'tags', ['family_id'])

    # 6. documents
    op.create_table(
        'documents',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('family_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('family.id', ondelete='CASCADE'), nullable=False),
        sa.Column('uploaded_by_member_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('family_members.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('file_path', sa.Text(), nullable=False),
        sa.Column('file_name', sa.String(length=255), nullable=False),
        sa.Column('file_size_bytes', sa.BigInteger(), nullable=False),
        sa.Column('mime_type', sa.String(length=64), nullable=False),
        sa.Column('sha256_hash', sa.String(length=64), nullable=False),
        sa.Column('status', sa.String(length=24), nullable=False, server_default='pending'),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('idx_documents_family_status', 'documents', ['family_id', 'status'])
    op.create_index('idx_documents_hash', 'documents', ['family_id', 'sha256_hash'])

    # 7. document_ocr_results
    op.create_table(
        'document_ocr_results',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('document_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('documents.id', ondelete='CASCADE'), nullable=False),
        sa.Column('raw_text', sa.Text(), nullable=False),
        sa.Column('confidence', sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column('extracted_merchant', sa.String(length=128), nullable=True),
        sa.Column('extracted_date', sa.Date(), nullable=True),
        sa.Column('extracted_time', sa.Time(), nullable=True),
        sa.Column('extracted_total_kopecks', sa.BigInteger(), nullable=True),
        sa.Column('extracted_tax_kopecks', sa.BigInteger(), nullable=True),
        sa.Column('processing_time_ms', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('document_id', name='uq_ocr_document')
    )
    op.create_index('idx_ocr_document', 'document_ocr_results', ['document_id'])

    # 8. transactions
    op.create_table(
        'transactions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('family_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('family.id', ondelete='CASCADE'), nullable=False),
        sa.Column('paid_by_member_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('family_members.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('category_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('categories.id', ondelete='RESTRICT'), nullable=True),
        sa.Column('document_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('documents.id', ondelete='SET NULL'), nullable=True),
        sa.Column('type', sa.String(length=16), nullable=False),
        sa.Column('amount_kopecks', sa.BigInteger(), nullable=False),
        sa.Column('currency', sa.String(length=3), nullable=False, server_default='RUB'),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('time', sa.Time(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('comment', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=24), nullable=False, server_default='confirmed'),
        sa.Column('ocr_confidence', sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column('is_recurring', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('idx_transactions_family_date', 'transactions', ['family_id', 'date'])
    op.create_index('idx_transactions_category', 'transactions', ['category_id'])
    op.create_index('idx_transactions_paid_by', 'transactions', ['paid_by_member_id'])
    op.create_index('idx_transactions_status', 'transactions', ['family_id', 'status'])

    # 9. transaction_items
    op.create_table(
        'transaction_items',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('transaction_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('transactions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('price_kopecks', sa.BigInteger(), nullable=False),
        sa.Column('quantity', sa.Numeric(precision=10, scale=3), nullable=False, server_default='1.000'),
        sa.Column('total_kopecks', sa.BigInteger(), nullable=False),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
    )
    op.create_index('idx_tx_items_transaction', 'transaction_items', ['transaction_id'])

    # 10. transaction_tags
    op.create_table(
        'transaction_tags',
        sa.Column('transaction_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('transactions.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('tag_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tags.id', ondelete='CASCADE'), primary_key=True),
    )

    # 11. transaction_splits
    op.create_table(
        'transaction_splits',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('transaction_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('transactions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('member_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('family_members.id', ondelete='CASCADE'), nullable=False),
        sa.Column('share_kopecks', sa.BigInteger(), nullable=False),
        sa.Column('share_percentage', sa.Numeric(precision=5, scale=2), nullable=True),
        sa.UniqueConstraint('transaction_id', 'member_id', name='uq_tx_member_split')
    )
    op.create_index('idx_splits_transaction', 'transaction_splits', ['transaction_id'])
    op.create_index('idx_splits_member', 'transaction_splits', ['member_id'])

    # 12. budgets
    op.create_table(
        'budgets',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('family_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('family.id', ondelete='CASCADE'), nullable=False),
        sa.Column('category_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('categories.id', ondelete='CASCADE'), nullable=False),
        sa.Column('year', sa.Integer(), nullable=False),
        sa.Column('month', sa.Integer(), nullable=False),
        sa.Column('limit_kopecks', sa.BigInteger(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('family_id', 'category_id', 'year', 'month', name='uq_family_cat_month_budget')
    )
    op.create_index('idx_budgets_family_period', 'budgets', ['family_id', 'year', 'month'])

    # 13. audit_log
    op.create_table(
        'audit_log',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('family_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('family.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('action', sa.String(length=32), nullable=False),
        sa.Column('entity_type', sa.String(length=32), nullable=False),
        sa.Column('entity_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('old_values', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('new_values', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('idx_audit_family_date', 'audit_log', ['family_id', 'created_at'])


def downgrade() -> None:
    op.drop_table('audit_log')
    op.drop_table('budgets')
    op.drop_table('transaction_splits')
    op.drop_table('transaction_tags')
    op.drop_table('transaction_items')
    op.drop_table('transactions')
    op.drop_table('document_ocr_results')
    op.drop_table('documents')
    op.drop_table('tags')
    op.drop_table('categories')
    op.drop_table('family_members')
    op.drop_table('family')
    op.drop_table('users')
