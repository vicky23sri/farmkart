from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base


class Product(Base):
    """Farm and crop products listed by sellers."""
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    seller_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(150), nullable=False, index=True)
    name_tamil = Column(String(150), nullable=True)
    category = Column(String(100), nullable=False, index=True)
    price = Column(Float, nullable=False)
    unit = Column(String(50), nullable=False)  # kg, quintal, bag, ton, bundle, tractor load
    stock = Column(Float, nullable=False, default=0.0)
    min_order = Column(Float, nullable=False, default=1.0)
    is_organic = Column(Boolean, default=False, nullable=False)
    harvest_date = Column(String(50), nullable=True)
    images = Column(JSON, default=list, nullable=False)  # List of image URLs
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    delivery_radius_km = Column(Float, default=50.0, nullable=False)
    vehicle_type = Column(String(100), nullable=True)  # Mini Truck, Tractor, Bike, etc.

    # Extra fields for specialized farm products (manure / straw / grains)
    composting_age = Column(String(100), nullable=True)   # e.g., "60-90 days cured"
    moisture_content = Column(String(100), nullable=True) # e.g., "< 12% dry"
    variety = Column(String(100), nullable=True)          # e.g., "Ponni", "IR20", "BPT"

    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationship to Seller
    seller = relationship("User", foreign_keys=[seller_id])
