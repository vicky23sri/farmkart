from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class ReviewCreateRequest(BaseModel):
    order_id: int
    product_id: int
    product_rating: float = Field(..., ge=1.0, le=5.0, example=5.0)
    farmer_rating: float = Field(..., ge=1.0, le=5.0, example=5.0)
    delivery_rating: float = Field(..., ge=1.0, le=5.0, example=4.5)
    text: Optional[str] = Field(None, example="Very fresh harvest and excellent quality!")
    photos: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list, example=["Fresh", "On time", "Good packaging"])


class ReviewReplyRequest(BaseModel):
    reply: str = Field(..., min_length=2, example="Thank you for supporting organic farming!")


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

    class Config:
        from_attributes = True
