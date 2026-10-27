from pydantic import BaseModel, Field
from typing import Optional, List, Literal, Any
from datetime import datetime


class OrderItemIn(BaseModel):
    product_id: int
    quantity: float = Field(..., gt=0)


class OrderItemDetail(BaseModel):
    product_id: int
    name: str
    price: float
    quantity: float
    unit: str
    subtotal: float
    image: Optional[str] = None


class OrderCreateRequest(BaseModel):
    items: List[OrderItemIn] = Field(..., min_length=1)
    address: str = Field(..., example="45 Anna Nagar Main Road, Madurai")
    lat: Optional[float] = Field(None, example=9.9252)
    lng: Optional[float] = Field(None, example=78.1198)
    payment_method: Literal["cod", "online"] = Field("cod", example="cod")


class OrderApproveRequest(BaseModel):
    extra_delivery_fee: Optional[float] = Field(0.0, ge=0.0, example=250.0)
    seller_note: Optional[str] = Field(None, example="Delivery via mini truck arranged with extra toll charge.")


class OrderRejectRequest(BaseModel):
    reason: str = Field(..., min_length=3, example="Route blocked by flood or unable to deliver to remote area.")


class OrderStatusUpdateRequest(BaseModel):
    status: Literal["packed", "shipped", "out_for_delivery", "delivered"]
    note: Optional[str] = None


class OrderStatusHistoryOut(BaseModel):
    id: int
    status: str
    note: Optional[str] = None
    timestamp: datetime

    class Config:
        from_attributes = True


class OrderOut(BaseModel):
    id: int
    buyer_id: int
    seller_id: int
    items: List[dict]
    distance_km: float
    is_extended_delivery: bool
    extra_delivery_fee: float
    delivery_fee: float
    subtotal: float
    total: float
    payment_method: str
    payment_status: str
    status: str
    seller_note: Optional[str] = None
    reject_reason: Optional[str] = None
    address: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    delivery_otp: Optional[str] = None
    created_at: Optional[datetime] = None
    status_history: List[OrderStatusHistoryOut] = []
    message: Optional[str] = None

    class Config:
        from_attributes = True


class OrderTrackOut(BaseModel):
    order_id: int
    current_status: str
    status_history: List[OrderStatusHistoryOut]
    eta: str
    payment_method: str
    payment_status: str
    total: float
    cod_amount_to_pay: Optional[float] = None
    delivery_otp: Optional[str] = None
