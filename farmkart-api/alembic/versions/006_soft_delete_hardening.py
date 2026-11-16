"""Auth columns missing from earlier migrations, soft-delete columns, delivery notes

Earlier migrations never created the email/password/Google columns on `users` and left
`users.mobile` NOT NULL, so a database built purely from migrations could not register or
log in users. This revision brings such databases in line with the models. Every statement
is idempotent so databases that were created with `create_all` upgrade cleanly too.

Revision ID: 006_soft_delete_hardening
Revises: 005_direct_upi_payments
Create Date: 2026-11-12 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = "006_soft_delete_hardening"
down_revision: Union[str, None] = "005_direct_upi_payments"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Authentication columns
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255)")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS hashed_password VARCHAR(255)")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(512)")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50) NOT NULL DEFAULT 'local'")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_email ON users (email)")
    # Email/Google accounts have no mobile; deleted accounts release theirs
    op.execute("ALTER TABLE users ALTER COLUMN mobile DROP NOT NULL")

    # Soft delete
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP")
    op.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP")
    op.execute("CREATE INDEX IF NOT EXISTS ix_products_deleted_at ON products (deleted_at)")

    # Buyer delivery notes / preferred slot
    op.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_notes VARCHAR(500)")

    # Backfill timestamps so NOT NULL-like assumptions in the app hold
    for table in ("users", "products", "orders", "otps", "notifications", "device_tokens"):
        op.execute(f"UPDATE {table} SET created_at = NOW() AT TIME ZONE 'utc' WHERE created_at IS NULL")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_products_deleted_at")
    op.execute("ALTER TABLE products DROP COLUMN IF EXISTS deleted_at")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS deleted_at")
    op.execute("ALTER TABLE orders DROP COLUMN IF EXISTS delivery_notes")
    # The auth columns are intentionally kept on downgrade: dropping them would destroy
    # user credentials, and revision 005 code also depends on them.
