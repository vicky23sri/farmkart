from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_seller
from app.models.user import User
from app.models.order import Order
from app.models.payout import Payout
from app.schemas.payout import PayoutSummaryOut, PayoutRecordOut
from app.schemas.order import OrderOut

router = APIRouter(prefix="/payouts", tags=["Payouts"])


@router.get("/summary", response_model=PayoutSummaryOut)
def get_payout_summary(
    current_seller: User = Depends(require_seller),
    db: Session = Depends(get_db),
):
    """
    Get seller earnings summary (Seller only).
    Calculates total earnings, COD collected vs pending, online earnings,
    and returns list of delivered orders.
    """
    orders = db.query(Order).filter(Order.seller_id == current_seller.id).all()

    total_earnings = 0.0
    cod_collected = 0.0
    cod_pending = 0.0
    online_earnings = 0.0
    delivered_orders = []

    for o in orders:
        if o.payment_method == "cod":
            if o.payment_status == "collected":
                cod_collected += o.total
            else:
                cod_pending += o.total
        elif o.payment_method == "online":
            if o.payment_status in ["paid", "collected"]:
                online_earnings += o.total

        if o.status == "delivered":
            total_earnings += o.total
            delivered_orders.append(OrderOut.model_validate(o))

    return PayoutSummaryOut(
        seller_id=current_seller.id,
        total_earnings=round(total_earnings, 2),
        cod_collected=round(cod_collected, 2),
        cod_pending=round(cod_pending, 2),
        online_earnings=round(online_earnings, 2),
        delivered_orders_count=len(delivered_orders),
        delivered_orders=delivered_orders,
    )


@router.get("/history", response_model=List[PayoutRecordOut])
def get_payout_history(
    current_seller: User = Depends(require_seller),
    db: Session = Depends(get_db),
):
    """Get history of bank payouts processed for the seller (Seller only)."""
    payouts = (
        db.query(Payout)
        .filter(Payout.seller_id == current_seller.id)
        .order_by(Payout.id.desc())
        .all()
    )
    return payouts
