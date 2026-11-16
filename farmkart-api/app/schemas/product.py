from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

MAX_IMAGES = 8


def _validate_image_urls(urls: Optional[List[str]]) -> Optional[List[str]]:
    if urls is None:
        return urls
    if len(urls) > MAX_IMAGES:
        raise ValueError(f"A maximum of {MAX_IMAGES} images is allowed.")
    for url in urls:
        if not isinstance(url, str) or len(url) > 1024 or not url.startswith(("https://", "http://")):
            raise ValueError("Images must be http(s) URLs returned by the upload endpoint.")
    return urls


class ProductBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=150, json_schema_extra={"example": "Organic Brown Ponni Paddy"})
    name_tamil: Optional[str] = Field(None, max_length=150, json_schema_extra={"example": "பாரம்பரிய பொன்னி நெல்"})
    category: str = Field(..., min_length=2, max_length=100, json_schema_extra={"example": "Grains and Millets"})
    price: float = Field(..., gt=0, le=10_000_000, json_schema_extra={"example": 2400.0})
    unit: str = Field(..., min_length=1, max_length=50, json_schema_extra={"example": "quintal"})
    stock: float = Field(..., ge=0, le=10_000_000, json_schema_extra={"example": 50.0})
    min_order: float = Field(1.0, gt=0, le=10_000_000, json_schema_extra={"example": 1.0})
    is_organic: bool = Field(False, json_schema_extra={"example": True})
    harvest_date: Optional[str] = Field(None, max_length=50, json_schema_extra={"example": "Oct 2026"})
    images: List[str] = Field(default_factory=list)
    lat: Optional[float] = Field(None, ge=-90, le=90, json_schema_extra={"example": 10.0125})
    lng: Optional[float] = Field(None, ge=-180, le=180, json_schema_extra={"example": 77.9812})
    delivery_radius_km: float = Field(50.0, ge=0, le=2000, json_schema_extra={"example": 50.0})
    vehicle_type: Optional[str] = Field(None, max_length=100, json_schema_extra={"example": "Tractor / Mini Truck"})

    # Extra fields for manure, straw, grains
    composting_age: Optional[str] = Field(None, max_length=100, json_schema_extra={"example": "90 days cured"})
    moisture_content: Optional[str] = Field(None, max_length=100, json_schema_extra={"example": "< 12%"})
    variety: Optional[str] = Field(None, max_length=100, json_schema_extra={"example": "Ponni BPT"})


class ProductCreate(ProductBase):
    @field_validator("images")
    @classmethod
    def check_images(cls, v: List[str]) -> List[str]:
        return _validate_image_urls(v) or []


class ProductUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=150)
    name_tamil: Optional[str] = Field(None, max_length=150)
    category: Optional[str] = Field(None, min_length=2, max_length=100)
    price: Optional[float] = Field(None, gt=0, le=10_000_000)
    unit: Optional[str] = Field(None, min_length=1, max_length=50)
    stock: Optional[float] = Field(None, ge=0, le=10_000_000)
    min_order: Optional[float] = Field(None, gt=0, le=10_000_000)
    is_organic: Optional[bool] = None
    harvest_date: Optional[str] = Field(None, max_length=50)
    images: Optional[List[str]] = None
    lat: Optional[float] = Field(None, ge=-90, le=90)
    lng: Optional[float] = Field(None, ge=-180, le=180)
    delivery_radius_km: Optional[float] = Field(None, ge=0, le=2000)
    vehicle_type: Optional[str] = Field(None, max_length=100)
    composting_age: Optional[str] = Field(None, max_length=100)
    moisture_content: Optional[str] = Field(None, max_length=100)
    variety: Optional[str] = Field(None, max_length=100)
    is_active: Optional[bool] = None

    @field_validator("images")
    @classmethod
    def check_images(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        return _validate_image_urls(v)

    @field_validator("name", "category", "unit", "price", "stock", "min_order", "is_organic", "is_active", "delivery_radius_km")
    @classmethod
    def not_null(cls, v):
        # These columns are NOT NULL; an explicit null would otherwise surface as a 500.
        if v is None:
            raise ValueError("This field cannot be null.")
        return v


class ProductStockUpdate(BaseModel):
    stock: float = Field(..., ge=0, le=10_000_000, description="New available stock quantity")


class ProductToggleActive(BaseModel):
    is_active: bool = Field(..., description="Set active status")


class ProductOut(ProductBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    seller_id: int
    is_active: bool
    created_at: Optional[datetime] = None
    seller_name: Optional[str] = None
    rating: Optional[float] = None
    review_count: int = 0


class ProductWithDistanceOut(ProductOut):
    distance_km: Optional[float] = None
    within_free_radius: bool = True
