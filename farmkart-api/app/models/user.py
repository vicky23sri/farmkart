from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime
from app.core.database import Base


class User(Base):
    """User account: can be buyer, seller, or pending role selection."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    mobile = Column(String(15), unique=True, index=True, nullable=False)
    role = Column(String(10), nullable=True)  # 'buyer', 'seller', or None
    name = Column(String(100), nullable=True)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    address = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
