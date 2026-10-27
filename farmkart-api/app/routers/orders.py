import random
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user, require_buyer, require_seller
from app.models.user import User
from app.models.product import Product
from app.models.order import Order, OrderStatusHistory
from app.services.distance import calculate_haversine_distance
from app.schemas.order import (
    OrderCreateRequest,
    OrderApproveRequest,
    OrderRejectRequest,
    OrderStatusUpdateRequest,
    OrderOut,
    OrderTrackOut,
    OrderStatusHistoryOut,
)
from app.schemas.common import MessageResponse

router = APIRouter(prefix="/orders", tags=["Orders"])


def _reduce_stock(order: Order, db: Session):
    """Reduce product inventory when order is confirmed."""
    for item in order.items:
        prod = db.query(Product).filter(Product.id == item["product_id"]).first()
        if prod:
            prod.stock = max(0.0, prod.stock - item["quantity"])
    db.commit()


def _restore_stock(order: Order, db: Session):
    """Restore product inventory when order is cancelled or rejected."""
    for item in order.items:
        prod = db.query(Product).filter(Product.id == item["product_id"]).first()
        if prod:
            prod.stock += item["quantity"]
    db.commit()


# ==========================================
# BUYER: PLACE ORDER
# ==========================================

@router.post("", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
def create_order(
    req: OrderCreateRequest,
    current_buyer: User = Depends(require_buyer),
    db: Session = Depends(get_db),
):
    """
    Place a new order (Buyer only).
    - If distance <= 50 km: status = 'placed'
    - If distance > 50 km: do NOT reject. Set is_extended_delivery = true, status = 'pending_seller_approval'
    - If MAX_EXTENDED_DELIVERY_KM > 0 and distance exceeds it, reject.
    """
    if not req.items:
        raise HTTPException(status_code=400, detail="Order must contain at least one item.")

    # 1. Fetch products and calculate subtotals
    items_detail = []
    seller_id: Optional[int] = None
    subtotal = 0.0

    for item_in in req.items:
        prod = db.query(Product).filter(Product.id == item_in.product_id, Product.is_active == True).first()
        if not prod:
            raise HTTPException(status_code=404, detail=f"Product #{item_in.product_id} not found or inactive.")

        if prod.stock < item_in.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for '{prod.name}'. Available: {prod.stock} {prod.unit}.",
            )

        if seller_id is None:
            seller_id = prod.seller_id
        elif seller_id != prod.seller_id:
            raise HTTPException(
                status_code=400,
                detail="All items in an order must be from the same seller farm.",
            )

        item_subtotal = round(prod.price * item_in.quantity, 2)
        subtotal += item_subtotal

        first_img = prod.images[0] if (prod.images and len(prod.images) > 0) else None
        items_detail.append({
            "product_id": prod.id,
            "name": prod.name,
            "price": prod.price,
            "quantity": item_in.quantity,
            "unit": prod.unit,
            "subtotal": item_subtotal,
            "image": first_img,
        })

    # 2. Get coordinates and compute distance
    seller = db.query(User).filter(User.id == seller_id).first()
    seller_lat = seller.lat if seller else None
    seller_lng = seller.lng if seller else None

    buyer_lat = req.lat if req.lat is not None else current_buyer.lat
    buyer_lng = req.lng if req.lng is not None else current_buyer.lng

    distance = calculate_haversine_distance(seller_lat, seller_lng, buyer_lat, buyer_lng)

    # 3. Check hard limit if configured
    if settings.MAX_EXTENDED_DELIVERY_KM > 0 and distance > settings.MAX_EXTENDED_DELIVERY_KM:
        raise HTTPException(
            status_code=400,
            detail=f"Delivery distance ({distance} km) exceeds maximum delivery radius of {settings.MAX_EXTENDED_DELIVERY_KM} km.",
        )

    # 4. Check distance rules (Rule: do NOT reject beyond 50km)
    is_extended = distance > settings.FREE_DELIVERY_RADIUS_KM
    if is_extended:
        initial_status = "pending_seller_approval"
        custom_msg = "Your address is beyond 50 km. The seller will check if delivery is possible."
        # Online payment stays pending until approved and confirmed
        initial_payment_status = "pending"
    else:
        initial_status = "placed"
        custom_msg = "Order placed successfully. Awaiting seller confirmation."
        initial_payment_status = "paid" if req.payment_method == "online" else "pending"

    delivery_fee = 0.0
    extra_delivery_fee = 0.0
    total = round(subtotal + delivery_fee + extra_delivery_fee, 2)

    # Generate 6-digit delivery OTP for handoff verification
    delivery_otp = f"{random.randint(100000, 999999)}"

    order = Order(
        buyer_id=current_buyer.id,
        seller_id=seller_id,
        items=items_detail,
        distance_km=distance,
        is_extended_delivery=is_extended,
        extra_delivery_fee=extra_delivery_fee,
        delivery_fee=delivery_fee,
        subtotal=subtotal,
        total=total,
        payment_method=req.payment_method,
        payment_status=initial_payment_status,
        status=initial_status,
        address=req.address,
        lat=buyer_lat,
        lng=buyer_lng,
        delivery_otp=delivery_otp,
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    # Add initial history
    history = OrderStatusHistory(
        order_id=order.id,
        status=initial_status,
        note=custom_msg,
    )
    db.add(history)
    db.commit()
    db.refresh(order)

    res = OrderOut.model_validate(order)
    res.message = custom_msg
    return res


# ==========================================
# SELLER: APPROVE EXTENDED ORDER / ORDER
# ==========================================

@router.patch("/{order_id}/approve", response_model=OrderOut)
def approve_order(
    order_id: int,
    req: OrderApproveRequest,
    current_seller: User = Depends(require_seller),
    db: Session = Depends(get_db),
):
    """
    Approve an order (Seller only, own orders only).
    - If extra_delivery_fee == 0: status becomes 'confirmed', stock is reduced.
    - If extra_delivery_fee > 0: status becomes 'awaiting_buyer_confirmation' and total is updated.
    """
    order = db.query(Order).filter(Order.id == order_id, Order.seller_id == current_seller.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found or not owned by you.")

    if order.status not in ["placed", "pending_seller_approval"]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot approve order in current status '{order.status}'.",
        )

    order.seller_note = req.seller_note

    if req.extra_delivery_fee and req.extra_delivery_fee > 0:
        # Awaiting buyer confirmation for the extra charge
        order.extra_delivery_fee = req.extra_delivery_fee
        order.total = round(order.subtotal + order.delivery_fee + order.extra_delivery_fee, 2)
        order.status = "awaiting_buyer_confirmation"
        note_text = f"Seller approved with extra delivery fee of Rs. {req.extra_delivery_fee:.2f}. Awaiting buyer confirmation."
    else:
        # No extra fee: directly confirmed
        order.status = "confirmed"
        note_text = "Order approved and confirmed by seller."
        _reduce_stock(order, db)

    history = OrderStatusHistory(order_id=order.id, status=order.status, note=note_text)
    db.add(history)
    db.commit()
    db.refresh(order)

    return order


# ==========================================
# SELLER: REJECT ORDER
# ==========================================

@router.patch("/{order_id}/reject", response_model=OrderOut)
def reject_order(
    order_id: int,
    req: OrderRejectRequest,
    current_seller: User = Depends(require_seller),
    db: Session = Depends(get_db),
):
    """
    Reject an order with required reason (Seller only).
    Restores stock if it was previously confirmed.
    """
    order = db.query(Order).filter(Order.id == order_id, Order.seller_id == current_seller.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found or not owned by you.")

    if order.status in ["delivered", "cancelled", "rejected"]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot reject order with status '{order.status}'.",
        )

    # If already confirmed, restore stock
    if order.status in ["confirmed", "packed", "shipped", "out_for_delivery"]:
        _restore_stock(order, db)

    order.status = "rejected"
    order.reject_reason = req.reason

    history = OrderStatusHistory(
        order_id=order.id,
        status="rejected",
        note=f"Rejected by seller. Reason: {req.reason}",
    )
    db.add(history)
    db.commit()
    db.refresh(order)

    return order


# ==========================================
# BUYER: CONFIRM EXTRA FEE
# ==========================================

@router.patch("/{order_id}/buyer-confirm", response_model=OrderOut)
def buyer_confirm_order(
    order_id: int,
    current_buyer: User = Depends(require_buyer),
    db: Session = Depends(get_db),
):
    """
    Buyer accepts the extra delivery fee for extended delivery.
    Status transitions from 'awaiting_buyer_confirmation' to 'confirmed', reducing stock.
    """
    order = db.query(Order).filter(Order.id == order_id, Order.buyer_id == current_buyer.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found or not owned by you.")

    if order.status != "awaiting_buyer_confirmation":
        raise HTTPException(
            status_code=400,
            detail=f"Order is not awaiting buyer confirmation (current status: '{order.status}').",
        )

    order.status = "confirmed"
    _reduce_stock(order, db)

    history = OrderStatusHistory(
        order_id=order.id,
        status="confirmed",
        note=f"Buyer accepted extra delivery fee of Rs. {order.extra_delivery_fee:.2f}. Order confirmed.",
    )
    db.add(history)
    db.commit()
    db.refresh(order)

    return order


# ==========================================
# BUYER: CANCEL ORDER
# ==========================================

@router.patch("/{order_id}/cancel", response_model=OrderOut)
def cancel_order(
    order_id: int,
    current_buyer: User = Depends(require_buyer),
    db: Session = Depends(get_db),
):
    """
    Buyer cancels order.
    Allowed while status is 'placed', 'pending_seller_approval', or 'awaiting_buyer_confirmation'.
    """
    order = db.query(Order).filter(Order.id == order_id, Order.buyer_id == current_buyer.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found or not owned by you.")

    allowed_cancel_statuses = ["placed", "pending_seller_approval", "awaiting_buyer_confirmation"]
    if order.status not in allowed_cancel_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Order cannot be cancelled in status '{order.status}'.",
        )

    order.status = "cancelled"

    history = OrderStatusHistory(
        order_id=order.id,
        status="cancelled",
        note="Order cancelled by buyer.",
    )
    db.add(history)
    db.commit()
    db.refresh(order)

    return order


# ==========================================
# SELLER: UPDATE ORDER STATUS SEQUENCE
# ==========================================

VALID_STATUS_FLOW = {
    "confirmed": "packed",
    "packed": "shipped",
    "shipped": "out_for_delivery",
    "out_for_delivery": "delivered",
}


@router.patch("/{order_id}/status", response_model=OrderOut)
def update_order_status_sequence(
    order_id: int,
    req: OrderStatusUpdateRequest,
    current_seller: User = Depends(require_seller),
    db: Session = Depends(get_db),
):
    """
    Seller advances order status through sequence:
    confirmed -> packed -> shipped -> out_for_delivery -> delivered.
    On 'delivered' with COD, marks payment_status = 'collected'.
    """
    order = db.query(Order).filter(Order.id == order_id, Order.seller_id == current_seller.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found or not owned by you.")

    expected_next = VALID_STATUS_FLOW.get(order.status)
    if not expected_next or expected_next != req.status:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid transition. From '{order.status}', next status must be '{expected_next}', not '{req.status}'.",
        )

    order.status = req.status

    # On COD delivered, collect payment
    if req.status == "delivered" and order.payment_method == "cod":
        order.payment_status = "collected"

    note_text = req.note or f"Order marked as {req.status} by seller."
    history = OrderStatusHistory(
        order_id=order.id,
        status=req.status,
        note=note_text,
    )
    db.add(history)
    db.commit()
    db.refresh(order)

    return order


# ==========================================
# SHARED: GET MY ORDERS (TAB FILTER)
# ==========================================

@router.get("/mine", response_model=List[OrderOut])
def get_my_orders(
    tab: Optional[str] = Query("all", description="ongoing, delivered, cancelled, returns, all"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get user orders. Buyer sees their purchases; Seller sees incoming farm orders.
    Tabs: ongoing, delivered, cancelled, returns, all.
    """
    if current_user.role == "buyer":
        query = db.query(Order).filter(Order.buyer_id == current_user.id)
    elif current_user.role == "seller":
        query = db.query(Order).filter(Order.seller_id == current_user.id)
    else:
        raise HTTPException(status_code=403, detail="Role not set. Please set role first.")

    ongoing_statuses = [
        "placed",
        "pending_seller_approval",
        "awaiting_buyer_confirmation",
        "confirmed",
        "packed",
        "shipped",
        "out_for_delivery",
    ]

    if tab == "ongoing":
        query = query.filter(Order.status.in_(ongoing_statuses))
    elif tab == "delivered":
        query = query.filter(Order.status == "delivered")
    elif tab == "cancelled":
        query = query.filter(Order.status.in_(["cancelled", "rejected"]))
    elif tab == "returns":
        query = query.filter(Order.status == "returned")

    orders = query.order_by(Order.id.desc()).all()
    return orders


# ==========================================
# SHARED: GET ORDER BY ID
# ==========================================

@router.get("/{order_id}", response_model=OrderOut)
def get_order_by_id(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get single order details. Only the buyer or seller of the order can access."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")

    if order.buyer_id != current_user.id and order.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access forbidden: Not your order.")

    return order


# ==========================================
# SHARED: GET ORDER TRACKING & TIMELINE
# ==========================================

@router.get("/{order_id}/track", response_model=OrderTrackOut)
def track_order(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get live tracking timeline, status history, ETA, and COD payment details.
    """
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")

    if order.buyer_id != current_user.id and order.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access forbidden: Not your order.")

    # Friendly ETA estimate
    eta_map = {
        "placed": "Expected delivery within 24-48 hours",
        "pending_seller_approval": "Awaiting seller confirmation",
        "awaiting_buyer_confirmation": "Awaiting your fee confirmation",
        "confirmed": "Expected dispatch in 12 hours",
        "packed": "Ready for dispatch today",
        "shipped": "On the way, delivery expected today",
        "out_for_delivery": "Arriving within 1-2 hours",
        "delivered": "Delivered successfully",
        "cancelled": "Order was cancelled",
        "rejected": "Order was declined",
    }
    eta_text = eta_map.get(order.status, "Estimated delivery in 24 hours")

    cod_amount = order.total if (order.payment_method == "cod" and order.payment_status != "collected") else None

    return OrderTrackOut(
        order_id=order.id,
        current_status=order.status,
        status_history=order.status_history,
        eta=eta_text,
        payment_method=order.payment_method,
        payment_status=order.payment_status,
        total=order.total,
        cod_amount_to_pay=cod_amount,
        delivery_otp=order.delivery_otp,
    )
