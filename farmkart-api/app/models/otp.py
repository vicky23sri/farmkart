from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime
from app.core.database import Base


class OTP(Base):
    """Temporary 6-digit OTP codes for mobile verification."""
    __tablename__ = "otps"

    id = Column(Integer, primary_key=True, index=True)
    mobile = Column(String(15), index=True, nullable=False)
    otp_code = Column(String(6), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    is_used = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
