from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Optional, List
from datetime import datetime


class ReviewCreateRequest(BaseModel):
    order_id: int
    product_id: int
    product_rating: float = Field(..., ge=1.0, le=5.0, json_schema_extra={"example": 5.0})
    farmer_rating: float = Field(..., ge=1.0, le=5.0, json_schema_extra={"example": 5.0})
    delivery_rating: float = Field(..., ge=1.0, le=5.0, json_schema_extra={"example": 4.5})
    text: Optional[str] = Field(None, max_length=1000, json_schema_extra={"example": "Very fresh harvest and excellent quality!"})
    photos: List[str] = Field(default_factory=list, max_length=5)
    tags: List[str] = Field(default_factory=list, max_length=10, json_schema_extra={"example": ["Fresh", "On time", "Good packaging"]})

    @field_validator("photos")
    @classmethod
    def check_photos(cls, v: List[str]) -> List[str]:
        for url in v:
            if len(url) > 1024 or not url.startswith(("https://", "http://")):
                raise ValueError("Photos must be http(s) URLs returned by the upload endpoint.")
        return v

    @field_validator("tags")
    @classmethod
    def check_tags(cls, v: List[str]) -> List[str]:
        return [t.strip()[:40] for t in v if t and t.strip()]


class ReviewReplyRequest(BaseModel):
    reply: str = Field(..., min_length=2, max_length=1000, json_schema_extra={"example": "Thank you for supporting organic farming!"})


class ReviewOut(BaseModel):
    id: int
    order_id: int
    product_id: int
    buyer_id: int
    seller_id: int
    product_rating: float
    farmer_rating: float
    delivery_rating: float
    text: Optional[str] = None
    photos: List[str] = []
    tags: List[str] = []
    seller_reply: Optional[str] = None
    created_at: Optional[datetime] = None
    buyer_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
