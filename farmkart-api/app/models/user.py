from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import Integer, String, Float, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class User(Base):
    """User account: can be buyer, seller, or pending role selection."""
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), unique=True, index=True, nullable=True)
    hashed_password: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    mobile: Mapped[Optional[str]] = mapped_column(String(15), unique=True, index=True, nullable=True)
    role: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)  # 'buyer', 'seller', or None
    name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    auth_provider: Mapped[str] = mapped_column(String(50), default="local")
    lat: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    lng: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    address: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    upi_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # Seller direct UPI VPA
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    # Set when the account is deleted; deleted accounts can no longer authenticate.
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
