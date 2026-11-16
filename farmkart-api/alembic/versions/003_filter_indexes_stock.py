"""Add filter indexes and stock_reduced column

Revision ID: 003_filter_indexes_stock
Revises: 002_harden_otp_flow
Create Date: 2026-10-29 14:20:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "003_filter_indexes_stock"
down_revision: Union[str, None] = "002_harden_otp_flow"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add stock_reduced column on orders table
    op.add_column(
        "orders",
        sa.Column("stock_reduced", sa.Boolean(), nullable=False, server_default="false"),
    )

    # 2. Add indexes on filter columns
    op.create_index("ix_orders_status", "orders", ["status"])
    op.create_index("ix_orders_created_at", "orders", ["created_at"])
    op.create_index("ix_products_created_at", "products", ["created_at"])
    op.create_index("ix_reviews_created_at", "reviews", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_reviews_created_at", table_name="reviews")
    op.drop_index("ix_products_created_at", table_name="products")
    op.drop_index("ix_orders_created_at", table_name="orders")
    op.drop_index("ix_orders_status", table_name="orders")
    op.drop_column("orders", "stock_reduced")
