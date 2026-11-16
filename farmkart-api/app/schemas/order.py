from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Literal
from datetime import datetime


class OrderItemIn(BaseModel):
    product_id: int = Field(..., gt=0)
    quantity: float = Field(..., gt=0, le=100000)


class OrderItemDetail(BaseModel):
    product_id: int
    name: str
    price: float
    quantity: float
    unit: str
    subtotal: float
    image: Optional[str] = None


class OrderCreateRequest(BaseModel):
    items: List[OrderItemIn] = Field(..., min_length=1, max_length=50)
    address: str = Field(..., min_length=5, max_length=255, json_schema_extra={"example": "45 Anna Nagar Main Road, Madurai"})
    lat: Optional[float] = Field(None, ge=-90, le=90, json_schema_extra={"example": 9.9252})
    lng: Optional[float] = Field(None, ge=-180, le=180, json_schema_extra={"example": 78.1198})
    payment_method: Literal["cod", "upi", "online"] = Field("cod", json_schema_extra={"example": "upi"})
    delivery_notes: Optional[str] = Field(None, max_length=500, json_schema_extra={"example": "Preferred: evening. Gate 2, near the temple."})


class OrderApproveRequest(BaseModel):
    extra_delivery_fee: Optional[float] = Field(0.0, ge=0.0, le=100000, json_schema_extra={"example": 250.0})
    seller_note: Optional[str] = Field(None, max_length=255, json_schema_extra={"example": "Delivery via mini truck arranged with extra toll charge."})


class OrderRejectRequest(BaseModel):
    reason: str = Field(..., min_length=3, max_length=200, json_schema_extra={"example": "Route blocked by flood or unable to deliver to remote area."})


class OrderStatusUpdateRequest(BaseModel):
    status: Literal["packed", "shipped", "out_for_delivery", "delivered"]
    note: Optional[str] = Field(None, max_length=255)
    # Required when status == "delivered": the code shown in the buyer's app at handover
    delivery_otp: Optional[str] = Field(None, pattern=r"^\d{6}$")


class OrderStatusHistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: str
    note: Optional[str] = None
    timestamp: datetime


class OrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

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
    upi_utr: Optional[str] = None
    payment_submitted_at: Optional[datetime] = None
    payment_confirmed_at: Optional[datetime] = None
    payment_rejected_reason: Optional[str] = None
    payment_resubmit_count: int = 0
    status: str
    stock_reduced: bool = False
    seller_note: Optional[str] = None
    reject_reason: Optional[str] = None
    address: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    delivery_notes: Optional[str] = None
    delivery_otp: Optional[str] = None
    created_at: Optional[datetime] = None
    buyer_name: Optional[str] = None
    buyer_mobile: Optional[str] = None
    seller_name: Optional[str] = None
    seller_mobile: Optional[str] = None
    seller_address: Optional[str] = None
    status_history: List[OrderStatusHistoryOut] = []
    message: Optional[str] = None


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


class UpiLinkResponse(BaseModel):
    upi_url: str
    qr_payload: str
    payee_vpa: str
    payee_name: str
    amount: float
    txn_ref: str


class SubmitUtrRequest(BaseModel):
    utr: str = Field(
        ...,
        pattern=r"^\d{12}$",
        description="12-digit UPI UTR transaction reference number",
        json_schema_extra={"example": "123456789012"},
    )


class PaymentRejectRequest(BaseModel):
    reason: str = Field(
        ...,
        min_length=2,
        max_length=255,
        description="Reason for rejecting the buyer's submitted UPI payment",
        json_schema_extra={"example": "UTR does not match received transaction amount or account."},
    )
