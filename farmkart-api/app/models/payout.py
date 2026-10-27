from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class Payout(Base):
    """Payout disbursements recorded for a seller."""
    __tablename__ = "payouts"

    id = Column(Integer, primary_key=True, index=True)
    seller_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    amount = Column(Float, nullable=False)
    status = Column(String(50), default="pending", nullable=False)  # pending, processing, completed
    reference_id = Column(String(100), nullable=True)
    notes = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationship to Seller
    seller = relationship("User", foreign_keys=[seller_id])
