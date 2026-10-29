"""Savings goals: balance is derived from transactions (goal_id), not stored

Revision ID: 0002
Revises: 0001
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Savings operations written before this migration (old web client) cannot be attributed to any
    # goal, because goals had no server-side storage. They would violate the new constraint, so they go.
    op.execute(
        "DELETE FROM transaction_tags WHERE transaction_id IN "
        "(SELECT id FROM transactions WHERE type IN ('saving', 'withdrawal'))"
    )
    op.execute("DELETE FROM transactions WHERE type IN ('saving', 'withdrawal')")

    op.add_column("transactions", sa.Column("goal_id", sa.UUID(), nullable=True))
    op.create_foreign_key(None, "transactions", "savings_goals", ["goal_id"], ["id"])
    op.create_check_constraint(
        "ck_goal_link",
        "transactions",
        "(type IN ('saving', 'withdrawal') AND goal_id IS NOT NULL) "
        "OR (type NOT IN ('saving', 'withdrawal') AND goal_id IS NULL)",
    )
    # The saved amount of a goal is the sum of its deposits minus withdrawals: a single source of truth.
    op.drop_column("savings_goals", "current_amount_kopecks")


def downgrade() -> None:
    op.add_column(
        "savings_goals",
        sa.Column("current_amount_kopecks", sa.BigInteger(), nullable=False, server_default="0"),
    )
    op.alter_column("savings_goals", "current_amount_kopecks", server_default=None)
    op.drop_constraint("ck_goal_link", "transactions", type_="check")
    op.drop_constraint("transactions_goal_id_fkey", "transactions", type_="foreignkey")
    op.drop_column("transactions", "goal_id")
