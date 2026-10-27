from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class ProductBase(BaseModel):
    name: str = Field(..., example="Organic Brown Ponni Paddy")
    name_tamil: Optional[str] = Field(None, example="பாரம்பரிய பொன்னி நெல்")
    category: str = Field(..., example="Grains and Millets")
    price: float = Field(..., gt=0, example=2400.0)
    unit: str = Field(..., example="quintal")
    stock: float = Field(..., ge=0, example=50.0)
    min_order: float = Field(1.0, gt=0, example=1.0)
    is_organic: bool = Field(False, example=True)
    harvest_date: Optional[str] = Field(None, example="Oct 2026")
    images: List[str] = Field(default_factory=list)
    lat: Optional[float] = Field(None, example=10.0125)
    lng: Optional[float] = Field(None, example=77.9812)
    delivery_radius_km: float = Field(50.0, example=50.0)
    vehicle_type: Optional[str] = Field(None, example="Tractor / Mini Truck")

    # Extra fields for manure, straw, grains
    composting_age: Optional[str] = Field(None, example="90 days cured")
    moisture_content: Optional[str] = Field(None, example="< 12%")
    variety: Optional[str] = Field(None, example="Ponni BPT")


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    name_tamil: Optional[str] = None
    category: Optional[str] = None
    price: Optional[float] = None
    unit: Optional[str] = None
    stock: Optional[float] = None
    min_order: Optional[float] = None
    is_organic: Optional[bool] = None
    harvest_date: Optional[str] = None
    images: Optional[List[str]] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    delivery_radius_km: Optional[float] = None
    vehicle_type: Optional[str] = None
    composting_age: Optional[str] = None
    moisture_content: Optional[str] = None
    variety: Optional[str] = None
    is_active: Optional[bool] = None


class ProductStockUpdate(BaseModel):
    stock: float = Field(..., ge=0, description="New available stock quantity")


class ProductToggleActive(BaseModel):
    is_active: bool = Field(..., description="Set active status")


class ProductOut(ProductBase):
    id: int
    seller_id: int
    is_active: bool
    created_at: Optional[datetime] = None
    seller_name: Optional[str] = None

    class Config:
        from_attributes = True


class ProductWithDistanceOut(ProductOut):
    distance_km: Optional[float] = None
    within_free_radius: bool = True
