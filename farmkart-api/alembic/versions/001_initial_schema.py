"""Initial schema for FarmKart

Revision ID: 001_initial_schema
Revises: 
Create Date: 2026-10-27 10:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. users
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("mobile", sa.String(length=15), nullable=False, unique=True, index=True),
        sa.Column("role", sa.String(length=10), nullable=True),
        sa.Column("name", sa.String(length=100), nullable=True),
        sa.Column("lat", sa.Float(), nullable=True),
        sa.Column("lng", sa.Float(), nullable=True),
        sa.Column("address", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )

    # 2. otps
    op.create_table(
        "otps",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("mobile", sa.String(length=15), nullable=False, index=True),
        sa.Column("otp_code", sa.String(length=6), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("is_used", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )

    # 3. products
    op.create_table(
        "products",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("seller_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("name", sa.String(length=150), nullable=False, index=True),
        sa.Column("name_tamil", sa.String(length=150), nullable=True),
        sa.Column("category", sa.String(length=100), nullable=False, index=True),
        sa.Column("price", sa.Float(), nullable=False),
        sa.Column("unit", sa.String(length=50), nullable=False),
        sa.Column("stock", sa.Float(), nullable=False, server_default=sa.text("0.0")),
        sa.Column("min_order", sa.Float(), nullable=False, server_default=sa.text("1.0")),
        sa.Column("is_organic", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("harvest_date", sa.String(length=50), nullable=True),
        sa.Column("images", sa.JSON(), nullable=False),
        sa.Column("lat", sa.Float(), nullable=True),
        sa.Column("lng", sa.Float(), nullable=True),
        sa.Column("delivery_radius_km", sa.Float(), nullable=False, server_default=sa.text("50.0")),
        sa.Column("vehicle_type", sa.String(length=100), nullable=True),
        sa.Column("composting_age", sa.String(length=100), nullable=True),
        sa.Column("moisture_content", sa.String(length=100), nullable=True),
        sa.Column("variety", sa.String(length=100), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )

    # 4. orders
    op.create_table(
        "orders",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("buyer_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("seller_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("items", sa.JSON(), nullable=False),
        sa.Column("distance_km", sa.Float(), nullable=False, server_default=sa.text("0.0")),
        sa.Column("is_extended_delivery", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("extra_delivery_fee", sa.Float(), nullable=False, server_default=sa.text("0.0")),
        sa.Column("delivery_fee", sa.Float(), nullable=False, server_default=sa.text("0.0")),
        sa.Column("subtotal", sa.Float(), nullable=False, server_default=sa.text("0.0")),
        sa.Column("total", sa.Float(), nullable=False),
        sa.Column("payment_method", sa.String(length=20), nullable=False),
        sa.Column("payment_status", sa.String(length=30), nullable=False, server_default=sa.text("'pending'")),
        sa.Column("status", sa.String(length=50), nullable=False, server_default=sa.text("'placed'")),
        sa.Column("seller_note", sa.String(length=255), nullable=True),
        sa.Column("reject_reason", sa.String(length=255), nullable=True),
        sa.Column("address", sa.String(length=255), nullable=False),
        sa.Column("lat", sa.Float(), nullable=True),
        sa.Column("lng", sa.Float(), nullable=True),
        sa.Column("delivery_otp", sa.String(length=6), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )

    # 5. order_status_history
    op.create_table(
        "order_status_history",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("order_id", sa.Integer(), sa.ForeignKey("orders.id"), nullable=False, index=True),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("note", sa.String(length=255), nullable=True),
        sa.Column("timestamp", sa.DateTime(), nullable=False),
    )

    # 6. reviews
    op.create_table(
        "reviews",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("order_id", sa.Integer(), sa.ForeignKey("orders.id"), nullable=False, index=True),
        sa.Column("product_id", sa.Integer(), sa.ForeignKey("products.id"), nullable=False, index=True),
        sa.Column("buyer_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("seller_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("product_rating", sa.Float(), nullable=False),
        sa.Column("farmer_rating", sa.Float(), nullable=False),
        sa.Column("delivery_rating", sa.Float(), nullable=False),
        sa.Column("text", sa.String(length=1000), nullable=True),
        sa.Column("photos", sa.JSON(), nullable=False),
        sa.Column("tags", sa.JSON(), nullable=False),
        sa.Column("seller_reply", sa.String(length=1000), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )

    # 7. payouts
    op.create_table(
        "payouts",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("seller_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False, server_default=sa.text("'pending'")),
        sa.Column("reference_id", sa.String(length=100), nullable=True),
        sa.Column("notes", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("payouts")
    op.drop_table("reviews")
    op.drop_table("order_status_history")
    op.drop_table("orders")
    op.drop_table("products")
    op.drop_table("otps")
    op.drop_table("users")
