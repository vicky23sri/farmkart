from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy import Integer, String, Float, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Order(Base):
    """Customer order placed by a buyer to a seller."""
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    buyer_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    seller_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # List of purchased items with product_id, name, price, quantity, unit, subtotal
    items: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, nullable=False, default=list)

    distance_km: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    is_extended_delivery: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    extra_delivery_fee: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    delivery_fee: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    subtotal: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total: Mapped[float] = mapped_column(Float, nullable=False)

    payment_method: Mapped[str] = mapped_column(String(20), default="cod", nullable=False)  # 'cod', 'upi'
    payment_status: Mapped[str] = mapped_column(String(30), default="pending", nullable=False)  # 'pending', 'submitted', 'paid', 'rejected', 'expired'
    upi_utr: Mapped[Optional[str]] = mapped_column(String(12), unique=True, index=True, nullable=True)  # 12-digit UPI UTR
    payment_submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    payment_confirmed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    payment_rejected_reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    payment_resubmit_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    status: Mapped[str] = mapped_column(String(50), default="placed", nullable=False, index=True)
    stock_reduced: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    seller_note: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    reject_reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Delivery Address
    address: Mapped[str] = mapped_column(String(255), nullable=False)
    lat: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    lng: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    delivery_notes: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)  # Buyer's preferred slot / directions
    delivery_otp: Mapped[Optional[str]] = mapped_column(String(6), nullable=True)  # Delivery verification OTP for COD
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

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

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    order_id: Mapped[int] = mapped_column(Integer, ForeignKey("orders.id"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False)
    note: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    order = relationship("Order", back_populates="status_history")
