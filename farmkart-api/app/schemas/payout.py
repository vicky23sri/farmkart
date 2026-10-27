from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.schemas.order import OrderOut


class PayoutSummaryOut(BaseModel):
    seller_id: int
    total_earnings: float
    cod_collected: float
    cod_pending: float
    online_earnings: float
    delivered_orders_count: int
    delivered_orders: List[OrderOut] = []


class PayoutRecordOut(BaseModel):
    id: int
    seller_id: int
    amount: float
    status: str
    reference_id: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
