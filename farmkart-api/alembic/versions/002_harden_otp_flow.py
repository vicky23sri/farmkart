"""Harden OTP flow: hash storage, failed attempts, and client IP

Revision ID: 002_harden_otp_flow
Revises: 001_initial_schema
Create Date: 2026-10-29 13:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "002_harden_otp_flow"
down_revision: Union[str, None] = "001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Alter otp_code to String(128) and rename to otp_hash
    op.alter_column(
        "otps",
        "otp_code",
        new_column_name="otp_hash",
        type_=sa.String(length=128),
        existing_type=sa.String(length=6),
        nullable=False,
    )
    # 2. Add failed_attempts column
    op.add_column(
        "otps",
        sa.Column("failed_attempts", sa.Integer(), nullable=False, server_default="0"),
    )
    # 3. Add ip_address column
    op.add_column(
        "otps",
        sa.Column("ip_address", sa.String(length=45), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("otps", "ip_address")
    op.drop_column("otps", "failed_attempts")
    op.alter_column(
        "otps",
        "otp_hash",
        new_column_name="otp_code",
        type_=sa.String(length=6),
        existing_type=sa.String(length=128),
        nullable=False,
    )
