from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import Integer, String, Float, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Product(Base):
    """Farm and crop products listed by sellers."""
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    seller_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    name_tamil: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    category: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(50), nullable=False)  # kg, quintal, bag, ton, bundle, tractor load
    stock: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    min_order: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    is_organic: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    harvest_date: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    images: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)  # List of image URLs
    lat: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    lng: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    delivery_radius_km: Mapped[float] = mapped_column(Float, default=50.0, nullable=False)
    vehicle_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # Mini Truck, Tractor, Bike, etc.

    # Extra fields for specialized farm products (manure / straw / grains)
    composting_age: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)   # e.g., "60-90 days cured"
    moisture_content: Mapped[Optional[str]] = mapped_column(String(100), nullable=True) # e.g., "< 12% dry"
    variety: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)          # e.g., "Ponni", "IR20", "BPT"

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # Soft delete: products referenced by reviews/orders are archived instead of removed.
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationship to Seller
    seller = relationship("User", foreign_keys=[seller_id])
