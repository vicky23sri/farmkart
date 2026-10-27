from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base


class Order(Base):
    """Customer order placed by a buyer to a seller."""
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    buyer_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    seller_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # List of purchased items with product_id, name, price, quantity, unit, subtotal
    items = Column(JSON, nullable=False, default=list)

    distance_km = Column(Float, default=0.0, nullable=False)
    is_extended_delivery = Column(Boolean, default=False, nullable=False)
    extra_delivery_fee = Column(Float, default=0.0, nullable=False)
    delivery_fee = Column(Float, default=0.0, nullable=False)
    subtotal = Column(Float, default=0.0, nullable=False)
    total = Column(Float, nullable=False)

    payment_method = Column(String(20), nullable=False)  # 'cod', 'online'
    payment_status = Column(String(30), default="pending", nullable=False)  # pending, paid, collected, failed
    status = Column(String(50), default="placed", nullable=False)  # placed, pending_seller_approval, awaiting_buyer_confirmation, confirmed, packed, shipped, out_for_delivery, delivered, rejected, cancelled

    seller_note = Column(String(255), nullable=True)
    reject_reason = Column(String(255), nullable=True)

    # Delivery Address
    address = Column(String(255), nullable=False)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)

    delivery_otp = Column(String(6), nullable=True)  # Delivery verification OTP for COD
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    buyer = relationship("User", foreign_keys=[buyer_id])
    seller = relationship("User", foreign_keys=[seller_id])
    status_history = relationship(
        "OrderStatusHistory",
        back_populates="order",
        cascade="all, delete-orphan",
        order_by="OrderStatusHistory.timestamp.asc()",
    )


class OrderStatusHistory(Base):
    """Timeline entry recorded whenever an order status changes."""
    __tablename__ = "order_status_history"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False, index=True)
    status = Column(String(50), nullable=False)
    note = Column(String(255), nullable=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    order = relationship("Order", back_populates="status_history")
