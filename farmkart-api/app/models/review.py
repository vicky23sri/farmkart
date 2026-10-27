from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base


class Review(Base):
    """Customer ratings and feedback on delivered order items."""
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    buyer_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    seller_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    product_rating = Column(Float, nullable=False)   # 1.0 to 5.0
    farmer_rating = Column(Float, nullable=False)    # 1.0 to 5.0
    delivery_rating = Column(Float, nullable=False)  # 1.0 to 5.0

    text = Column(String(1000), nullable=True)
    photos = Column(JSON, default=list, nullable=False)  # List of photo URLs
    tags = Column(JSON, default=list, nullable=False)    # ["Fresh", "On time", etc.]
    seller_reply = Column(String(1000), nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    buyer = relationship("User", foreign_keys=[buyer_id])
    seller = relationship("User", foreign_keys=[seller_id])
    product = relationship("Product", foreign_keys=[product_id])
    order = relationship("Order", foreign_keys=[order_id])
