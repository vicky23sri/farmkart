"""Add upi_id to users and direct UPI payment fields to orders

Revision ID: 005_direct_upi_payments
Revises: 004_device_tokens_notifs
Create Date: 2026-10-29 16:05:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "005_direct_upi_payments"
down_revision: Union[str, None] = "004_device_tokens_notifs"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add upi_id to users
    op.add_column("users", sa.Column("upi_id", sa.String(length=255), nullable=True))

    # 2. Add UPI payment fields to orders
    op.add_column("orders", sa.Column("upi_utr", sa.String(length=12), nullable=True))
    op.create_index("ix_orders_upi_utr", "orders", ["upi_utr"], unique=True)

    op.add_column("orders", sa.Column("payment_submitted_at", sa.DateTime(), nullable=True))
    op.add_column("orders", sa.Column("payment_confirmed_at", sa.DateTime(), nullable=True))
    op.add_column("orders", sa.Column("payment_rejected_reason", sa.String(length=255), nullable=True))
    op.add_column("orders", sa.Column("payment_resubmit_count", sa.Integer(), nullable=False, server_default="0"))


def downgrade() -> None:
    op.drop_column("orders", "payment_resubmit_count")
    op.drop_column("orders", "payment_rejected_reason")
    op.drop_column("orders", "payment_confirmed_at")
    op.drop_column("orders", "payment_submitted_at")
    op.drop_index("ix_orders_upi_utr", table_name="orders")
    op.drop_column("orders", "upi_utr")
    op.drop_column("users", "upi_id")
