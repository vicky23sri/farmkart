import logging
import re
import secrets
import urllib.parse
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload, selectinload

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user, require_buyer, require_seller
from app.models.user import User
from app.models.product import Product
from app.models.order import Order, OrderStatusHistory
from app.models.notification import Notification
from app.services.distance import calculate_haversine_distance
from app.schemas.order import (
    OrderCreateRequest,
    OrderApproveRequest,
    OrderRejectRequest,
    OrderStatusUpdateRequest,
    OrderOut,
    OrderTrackOut,
    OrderStatusHistoryOut,
    UpiLinkResponse,
    SubmitUtrRequest,
    PaymentRejectRequest,
)
from app.schemas.common import MessageResponse, PaginatedResponse
from app.services.push import dispatch_order_notification

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/orders", tags=["Orders"])

# Orders in these states can still be auto-expired when an online (UPI) payment never arrives.
EXPIRABLE_STATUSES = ("placed", "pending_seller_approval", "awaiting_buyer_confirmation", "confirmed")
UPI_PAYMENT_WINDOW_MINUTES = 30


def _notify(background_tasks: BackgroundTasks, order: Order, event: str) -> None:
    background_tasks.add_task(dispatch_order_notification, order.id, event)


def _get_order_for_update(db: Session, order_id: int) -> Optional[Order]:
    """Fetch an order with a row lock so concurrent state transitions are serialised."""
    return db.query(Order).filter(Order.id == order_id).with_for_update().first()


def _serialize_order(order: Order, viewer: User) -> OrderOut:
    """
    Build the API representation of an order for a given viewer.
    The delivery OTP is only revealed to the buyer; the seller must obtain it at handover.
    """
    out = OrderOut.model_validate(order)
    if viewer.id != order.buyer_id:
        out.delivery_otp = None
    buyer = order.buyer
    seller = order.seller
    out.buyer_name = buyer.name if buyer else None
    out.buyer_mobile = buyer.mobile if buyer else None
    out.seller_name = seller.name if seller else None
    out.seller_mobile = seller.mobile if seller else None
    out.seller_address = seller.address if seller else None
    return out


def _reduce_stock(order: Order, db: Session):
    """
    Atomically and idempotently reduce product inventory for an order.
    Locks product rows in consistent product ID order to avoid deadlocks.
    Never reduces stock twice for the same order.
    """
    if getattr(order, "stock_reduced", False):
        return

    qty_by_id = {}
    for item in order.items:
        pid = item["product_id"]
        qty_by_id[pid] = qty_by_id.get(pid, 0.0) + item["quantity"]

    sorted_ids = sorted(qty_by_id.keys())
    # Consistent ordering by product ID avoids deadlocks when locking rows
    locked_prods = (
        db.query(Product)
        .filter(Product.id.in_(sorted_ids))
        .with_for_update()
        .order_by(Product.id.asc())
        .all()
    )

    for prod in locked_prods:
        needed = qty_by_id.get(prod.id, 0.0)
        if prod.stock < needed:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Insufficient stock for '{prod.name}'. Available: {prod.stock} {prod.unit}.",
            )

    for prod in locked_prods:
        needed = qty_by_id.get(prod.id, 0.0)
        prod.stock = round(max(0.0, prod.stock - needed), 2)

    order.stock_reduced = True
    db.flush()


def _restore_stock(order: Order, db: Session):
    """
    Atomically and idempotently restore product inventory when order is cancelled or rejected.
    Locks product rows in consistent product ID order to avoid deadlocks.
    Never restores stock twice for one order.
    """
    if not getattr(order, "stock_reduced", False):
        return

    qty_by_id = {}
    for item in order.items:
        pid = item["product_id"]
        qty_by_id[pid] = qty_by_id.get(pid, 0.0) + item["quantity"]

    sorted_ids = sorted(qty_by_id.keys())
    # Consistent ordering by product ID avoids deadlocks when locking rows
    locked_prods = (
        db.query(Product)
        .filter(Product.id.in_(sorted_ids))
        .with_for_update()
        .order_by(Product.id.asc())
        .all()
    )

    for prod in locked_prods:
        qty = qty_by_id.get(prod.id, 0.0)
        prod.stock = round(prod.stock + qty, 2)

    order.stock_reduced = False
    db.flush()


def _get_datetime_age_seconds(dt: datetime) -> float:
    """Return age of a datetime in seconds, robust to timezone-aware and naive timestamps."""
    if dt.tzinfo is not None:
        return (datetime.now(timezone.utc) - dt.astimezone(timezone.utc)).total_seconds()
    now_utc_naive = datetime.now(timezone.utc).replace(tzinfo=None)
    age_from_utc = (now_utc_naive - dt).total_seconds()
    now_local_naive = datetime.now()
    age_from_local = (now_local_naive - dt).total_seconds()
    if age_from_utc < -300 and age_from_local >= -60:
        return age_from_local
    return age_from_utc


def _check_and_expire_order(order: Order, db: Session, commit: bool = True) -> bool:
    """
    Auto-expire: unpaid UPI orders older than 30 minutes with no UTR submitted
    become 'expired' and stock is atomically restored (never restore twice).
    """
    if (
        order.payment_method == "upi"
        and order.payment_status == "pending"
        and not order.upi_utr
        and order.status in EXPIRABLE_STATUSES
        and order.created_at
    ):
        diff_seconds = _get_datetime_age_seconds(order.created_at)
        if diff_seconds > UPI_PAYMENT_WINDOW_MINUTES * 60:
            logger.info(
                f"[Payment] Auto-expiring unpaid UPI order #{order.id} (created {diff_seconds:.0f}s ago). Restoring stock."
            )
            order.payment_status = "expired"
            order.status = "cancelled"
            _restore_stock(order, db)
            history = OrderStatusHistory(
                order_id=order.id,
                status="cancelled",
                note="Order auto-expired: direct UPI payment was not submitted within 30 minutes.",
            )
            db.add(history)
            if commit:
                db.commit()
                db.refresh(order)
            return True
    return False


def _expire_unpaid_upi_orders_batch(db: Session, user: Optional[User] = None) -> int:
    """
    Expire old unpaid UPI orders (optionally only those belonging to `user`).
    Rows are locked with SKIP LOCKED so concurrent requests never expire the same order twice.
    """
    cutoff_utc = datetime.now(timezone.utc) - timedelta(minutes=UPI_PAYMENT_WINDOW_MINUTES)
    cutoff_naive_utc = cutoff_utc.replace(tzinfo=None)
    query = db.query(Order).filter(
        Order.payment_method == "upi",
        Order.payment_status == "pending",
        Order.upi_utr.is_(None),
        Order.status.in_(EXPIRABLE_STATUSES),
        Order.created_at <= cutoff_naive_utc,
    )
    if user is not None:
        query = query.filter((Order.buyer_id == user.id) | (Order.seller_id == user.id))
    unpaid_orders = query.with_for_update(skip_locked=True).all()
    count = 0
    for ord_obj in unpaid_orders:
        if _check_and_expire_order(ord_obj, db, commit=False):
            count += 1
    db.commit()
    return count


# ==========================================
# BUYER: PLACE ORDER
# ==========================================

@router.post("", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
def create_order(
    req: OrderCreateRequest,
    background_tasks: BackgroundTasks,
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

    buyer_lat = req.lat if req.lat is not None else current_buyer.lat
    buyer_lng = req.lng if req.lng is not None else current_buyer.lng

    # 1. Group quantities and fetch products with row-level locks
    qty_by_prod_id = {}
    for item_in in req.items:
        qty_by_prod_id[item_in.product_id] = qty_by_prod_id.get(item_in.product_id, 0.0) + item_in.quantity

    sorted_prod_ids = sorted(qty_by_prod_id.keys())

    # Lock product rows using SELECT ... FOR UPDATE in ascending product ID order
    # to prevent concurrent overselling and deadlock conditions across transactions.
    locked_products = (
        db.query(Product)
        .filter(
            Product.id.in_(sorted_prod_ids),
            Product.is_active.is_(True),
            Product.deleted_at.is_(None),
        )
        .with_for_update()
        .order_by(Product.id.asc())
        .all()
    )

    prods_by_id = {p.id: p for p in locked_products}
    for pid in sorted_prod_ids:
        if pid not in prods_by_id:
            raise HTTPException(status_code=404, detail=f"Product #{pid} not found or inactive.")

    # Single seller farm validation
    seller_id: Optional[int] = locked_products[0].seller_id
    for prod in locked_products:
        if prod.seller_id != seller_id:
            raise HTTPException(
                status_code=400,
                detail="All items in an order must be from the same seller farm.",
            )

    if seller_id == current_buyer.id:
        raise HTTPException(status_code=400, detail="You cannot order your own products.")

    # Validate minimum order quantity and stock (HTTP 409 Conflict if insufficient)
    for prod in locked_products:
        needed_qty = qty_by_prod_id[prod.id]
        if prod.min_order and needed_qty < prod.min_order:
            raise HTTPException(
                status_code=400,
                detail=f"Minimum order for '{prod.name}' is {prod.min_order} {prod.unit}.",
            )
        if prod.stock < needed_qty:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Insufficient stock for '{prod.name}'. Available: {prod.stock} {prod.unit}.",
            )

    # Atomically reduce inventory within this transaction
    for prod in locked_products:
        needed_qty = qty_by_prod_id[prod.id]
        prod.stock = round(prod.stock - needed_qty, 2)

    # Build order item details and subtotal (one line per product)
    items_detail = []
    subtotal = 0.0
    for pid in sorted_prod_ids:
        prod = prods_by_id[pid]
        qty = qty_by_prod_id[pid]
        item_subtotal = round(prod.price * qty, 2)
        subtotal += item_subtotal
        first_img = prod.images[0] if prod.images else None
        items_detail.append({
            "product_id": prod.id,
            "name": prod.name,
            "price": prod.price,
            "quantity": qty,
            "unit": prod.unit,
            "subtotal": item_subtotal,
            "image": first_img,
        })
    subtotal = round(subtotal, 2)

    # 2. Get coordinates and compute distance
    seller = db.get(User, seller_id)
    if not seller or seller.deleted_at is not None:
        raise HTTPException(status_code=404, detail="This seller is no longer available.")
    seller_lat = seller.lat
    seller_lng = seller.lng

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
        custom_msg = (
            f"Your address is beyond {settings.FREE_DELIVERY_RADIUS_KM:g} km. "
            "The seller will check if delivery is possible."
        )
    else:
        initial_status = "placed"
        custom_msg = "Order placed successfully. Awaiting seller confirmation."

    norm_payment_method = "upi" if req.payment_method in ["upi", "online"] else "cod"
    # Payments always start pending; only seller confirmation can mark paid
    initial_payment_status = "pending"

    delivery_fee = 0.0
    extra_delivery_fee = 0.0
    total = round(subtotal + delivery_fee + extra_delivery_fee, 2)

    # Cryptographically secure 6-digit delivery OTP for handoff verification
    delivery_otp = f"{secrets.randbelow(900000) + 100000}"

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
        payment_method=norm_payment_method,
        payment_status=initial_payment_status,
        status=initial_status,
        stock_reduced=True,
        address=req.address.strip(),
        delivery_notes=req.delivery_notes.strip() if req.delivery_notes else None,
        lat=buyer_lat,
        lng=buyer_lng,
        delivery_otp=delivery_otp,
    )
    db.add(order)
    db.flush()
    db.add(OrderStatusHistory(order_id=order.id, status=initial_status, note=custom_msg))
    db.commit()
    db.refresh(order)

    logger.info(
        "[Order] #%s created: payment_method=%s total=%s status=%s",
        order.id, norm_payment_method, total, initial_status,
    )

    # Seller is notified of both regular and extended-distance orders
    _notify(background_tasks, order, "placed")

    res = _serialize_order(order, current_buyer)
    res.message = custom_msg
    return res


# ==========================================
# SELLER: APPROVE EXTENDED ORDER / ORDER
# ==========================================

@router.patch("/{order_id}/approve", response_model=OrderOut)
def approve_order(
    order_id: int,
    req: OrderApproveRequest,
    background_tasks: BackgroundTasks,
    current_seller: User = Depends(require_seller),
    db: Session = Depends(get_db),
):
    """
    Approve an order (Seller only, own orders only).
    - If extra_delivery_fee == 0: status becomes 'confirmed', stock is reduced.
    - If extra_delivery_fee > 0: status becomes 'awaiting_buyer_confirmation' and total is updated.
    """
    order = _get_order_for_update(db, order_id)
    if not order or order.seller_id != current_seller.id:
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

    _notify(background_tasks, order, order.status)
    return _serialize_order(order, current_seller)


# ==========================================
# SELLER: REJECT ORDER
# ==========================================

@router.patch("/{order_id}/reject", response_model=OrderOut)
def reject_order(
    order_id: int,
    req: OrderRejectRequest,
    background_tasks: BackgroundTasks,
    current_seller: User = Depends(require_seller),
    db: Session = Depends(get_db),
):
    """
    Reject an order with required reason (Seller only).
    Restores stock if it was previously confirmed.
    """
    order = _get_order_for_update(db, order_id)
    if not order or order.seller_id != current_seller.id:
        raise HTTPException(status_code=404, detail="Order not found or not owned by you.")

    if order.status in ["delivered", "cancelled", "rejected"]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot reject order with status '{order.status}'.",
        )

    # If already reduced, restore stock idempotently
    _restore_stock(order, db)

    order.status = "rejected"
    order.reject_reason = req.reason

    history = OrderStatusHistory(
        order_id=order.id,
        status="rejected",
        note=f"Rejected by seller. Reason: {req.reason}"[:255],
    )
    db.add(history)
    db.commit()
    db.refresh(order)

    _notify(background_tasks, order, "rejected")
    return _serialize_order(order, current_seller)


# ==========================================
# BUYER: CONFIRM EXTRA FEE
# ==========================================

@router.patch("/{order_id}/buyer-confirm", response_model=OrderOut)
def buyer_confirm_order(
    order_id: int,
    background_tasks: BackgroundTasks,
    current_buyer: User = Depends(require_buyer),
    db: Session = Depends(get_db),
):
    """
    Buyer accepts the extra delivery fee for extended delivery.
    Status transitions from 'awaiting_buyer_confirmation' to 'confirmed', reducing stock.
    """
    order = _get_order_for_update(db, order_id)
    if not order or order.buyer_id != current_buyer.id:
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

    _notify(background_tasks, order, "confirmed")
    return _serialize_order(order, current_buyer)


# ==========================================
# BUYER: CANCEL ORDER
# ==========================================

@router.patch("/{order_id}/cancel", response_model=OrderOut)
def cancel_order(
    order_id: int,
    background_tasks: BackgroundTasks,
    current_buyer: User = Depends(require_buyer),
    db: Session = Depends(get_db),
):
    """
    Buyer cancels order.
    Allowed while status is 'placed', 'pending_seller_approval', or 'awaiting_buyer_confirmation'.
    """
    order = _get_order_for_update(db, order_id)
    if not order or order.buyer_id != current_buyer.id:
        raise HTTPException(status_code=404, detail="Order not found or not owned by you.")

    allowed_cancel_statuses = ["placed", "pending_seller_approval", "awaiting_buyer_confirmation"]
    if order.status not in allowed_cancel_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Order cannot be cancelled in status '{order.status}'.",
        )

    # Restore stock idempotently if previously reduced
    _restore_stock(order, db)

    order.status = "cancelled"

    history = OrderStatusHistory(
        order_id=order.id,
        status="cancelled",
        note="Order cancelled by buyer.",
    )
    db.add(history)
    db.commit()
    db.refresh(order)

    _notify(background_tasks, order, "cancelled")
    return _serialize_order(order, current_buyer)


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
    background_tasks: BackgroundTasks,
    current_seller: User = Depends(require_seller),
    db: Session = Depends(get_db),
):
    """
    Seller advances order status through sequence:
    confirmed -> packed -> shipped -> out_for_delivery -> delivered.
    On 'delivered' with COD, marks payment_status = 'collected'.
    """
    order = _get_order_for_update(db, order_id)
    if not order or order.seller_id != current_seller.id:
        raise HTTPException(status_code=404, detail="Order not found or not owned by you.")

    expected_next = VALID_STATUS_FLOW.get(order.status)
    if not expected_next or expected_next != req.status:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid transition. From '{order.status}', next status must be '{expected_next}', not '{req.status}'.",
        )

    if req.status == "delivered":
        supplied = (req.delivery_otp or "").strip()
        if not order.delivery_otp or not secrets.compare_digest(supplied, order.delivery_otp):
            raise HTTPException(
                status_code=400,
                detail="Incorrect delivery OTP. Ask the buyer for the 6-digit code shown in their app.",
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

    _notify(background_tasks, order, req.status)
    return _serialize_order(order, current_seller)


# ==========================================
# DIRECT UPI PAYMENTS (PEER-TO-PEER)
# ==========================================

@router.get("/{order_id}/upi-link", response_model=UpiLinkResponse)
def get_order_upi_link(
    order_id: int,
    current_buyer: User = Depends(require_buyer),
    db: Session = Depends(get_db),
):
    """
    Get UPI payment details and deep link URL (Buyer only, own order only).
    Amount is strictly computed server-side from order total plus any confirmed extra fee.
    Never accepts an amount from the client.
    """
    order = _get_order_for_update(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")

    if order.buyer_id != current_buyer.id:
        raise HTTPException(status_code=403, detail="Access forbidden: Not your order.")

    if _check_and_expire_order(order, db):
        raise HTTPException(status_code=400, detail="Order payment window has expired.")

    if order.payment_method != "upi":
        raise HTTPException(status_code=400, detail="Order payment method is not UPI.")

    if order.status in ["cancelled", "rejected"]:
        raise HTTPException(status_code=400, detail=f"Cannot pay for order with status '{order.status}'.")

    if order.payment_status == "paid":
        raise HTTPException(status_code=400, detail="Order is already paid.")

    if order.payment_status == "expired":
        raise HTTPException(status_code=400, detail="Payment window has expired.")

    seller = db.query(User).filter(User.id == order.seller_id).first()
    if not seller or not seller.upi_id:
        raise HTTPException(
            status_code=400,
            detail="The seller has not configured a UPI ID yet. Please contact the seller or choose COD.",
        )

    # Server-side computed amount from order total (includes items subtotal + delivery + confirmed extra delivery fee)
    amount = round(float(order.total), 2)
    payee_vpa = seller.upi_id.strip()
    payee_name = (seller.name or "FarmKart Seller").strip()
    txn_ref = f"FK{order.id}"
    txn_note = f"FarmKart order {order.id}"

    # Build UPI deep link: upi://pay?pa=<seller_vpa>&pn=<seller_name>&am=<amount 2dp>&cu=INR&tr=<order_id-based ref>&tn=FarmKart order <id>
    # URL-encode all query parameters
    params = {
        "pa": payee_vpa,
        "pn": payee_name,
        "am": f"{amount:.2f}",
        "cu": "INR",
        "tr": txn_ref,
        "tn": txn_note,
    }
    query_str = urllib.parse.urlencode(params)
    upi_url = f"upi://pay?{query_str}"
    qr_payload = upi_url

    return UpiLinkResponse(
        upi_url=upi_url,
        qr_payload=qr_payload,
        payee_vpa=payee_vpa,
        payee_name=payee_name,
        amount=amount,
        txn_ref=txn_ref,
    )


@router.post("/{order_id}/payment/submit-utr", response_model=OrderOut)
def submit_payment_utr(
    order_id: int,
    req: SubmitUtrRequest,
    background_tasks: BackgroundTasks,
    current_buyer: User = Depends(require_buyer),
    db: Session = Depends(get_db),
):
    """
    Submit a 12-digit UPI UTR transaction reference for an order (Buyer only).
    Enforces 12 digits, global uniqueness across all orders (HTTP 409), and payable state.
    """
    order = _get_order_for_update(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")

    if order.buyer_id != current_buyer.id:
        raise HTTPException(status_code=403, detail="Access forbidden: Not your order.")

    if _check_and_expire_order(order, db):
        raise HTTPException(status_code=400, detail="Order payment window has expired.")

    if order.payment_method != "upi":
        raise HTTPException(status_code=400, detail="Order payment method is not direct UPI.")

    if order.status in ["cancelled", "rejected"]:
        raise HTTPException(status_code=400, detail=f"Cannot submit payment for order with status '{order.status}'.")

    if order.payment_status == "paid":
        raise HTTPException(status_code=400, detail="Order has already been confirmed as paid.")

    if order.payment_status == "expired":
        raise HTTPException(status_code=400, detail="Order payment window has expired.")

    if order.payment_resubmit_count >= 3:
        raise HTTPException(
            status_code=400,
            detail="Maximum payment submission attempts (3) reached. Please contact support or seller.",
        )

    clean_utr = req.utr.strip()
    if not re.match(r"^\d{12}$", clean_utr):
        raise HTTPException(status_code=422, detail="UTR must be exactly 12 numeric digits.")

    # Check global UTR uniqueness (409 Conflict if already used on ANY order)
    duplicate = (
        db.query(Order)
        .filter(Order.upi_utr == clean_utr, Order.id != order.id)
        .first()
    )
    if duplicate:
        logger.warning(
            f"[Payment] Duplicate UTR submission attempt: '{clean_utr}' on Order #{order.id} was already used on Order #{duplicate.id}"
        )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This UTR has already been submitted for an order.",
        )

    previous_status = order.payment_status
    order.upi_utr = clean_utr
    order.payment_status = "submitted"
    order.payment_submitted_at = datetime.now(timezone.utc)
    order.payment_rejected_reason = None

    logger.info(
        f"[Payment] Order #{order.id} payment_status changed: '{previous_status}' -> 'submitted' (UTR: {clean_utr}, Buyer: #{current_buyer.id})"
    )

    history = OrderStatusHistory(
        order_id=order.id,
        status=order.status,
        note=f"Buyer submitted 12-digit UPI UTR: {clean_utr}. Awaiting seller verification.",
    )
    db.add(history)
    try:
        db.commit()
    except IntegrityError:
        # Unique constraint on upi_utr: another order claimed this UTR concurrently
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This UTR has already been submitted for an order.",
        )
    db.refresh(order)

    _notify(background_tasks, order, "payment_submitted")
    return _serialize_order(order, current_buyer)


@router.patch("/{order_id}/payment/confirm", response_model=OrderOut)
def confirm_order_payment(
    order_id: int,
    background_tasks: BackgroundTasks,
    current_seller: User = Depends(require_seller),
    db: Session = Depends(get_db),
):
    """
    Seller confirms receipt of UPI payment (Seller of order only).
    Sets payment_status='paid' and records payment_confirmed_at.
    Idempotent and role-guarded.
    """
    order = _get_order_for_update(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")

    if order.seller_id != current_seller.id:
        raise HTTPException(status_code=403, detail="Access forbidden: You are not the seller of this order.")

    # Idempotent: if already paid, return without error
    if order.payment_status == "paid":
        return _serialize_order(order, current_seller)

    if order.payment_status != "submitted":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot confirm payment when status is '{order.payment_status}'. UTR must be submitted first.",
        )

    previous_status = order.payment_status
    order.payment_status = "paid"
    order.payment_confirmed_at = datetime.now(timezone.utc)

    logger.info(
        f"[Payment] Order #{order.id} payment_status changed: '{previous_status}' -> 'paid' (UTR: {order.upi_utr}, Seller: #{current_seller.id})"
    )

    history = OrderStatusHistory(
        order_id=order.id,
        status=order.status,
        note=f"Seller confirmed UPI payment (UTR: {order.upi_utr}). Payment verified successfully.",
    )
    db.add(history)
    db.commit()
    db.refresh(order)

    _notify(background_tasks, order, "payment_confirmed")
    return _serialize_order(order, current_seller)


@router.patch("/{order_id}/payment/reject", response_model=OrderOut)
def reject_order_payment(
    order_id: int,
    req: PaymentRejectRequest,
    background_tasks: BackgroundTasks,
    current_seller: User = Depends(require_seller),
    db: Session = Depends(get_db),
):
    """
    Seller rejects submitted UPI payment with a reason (Seller of order only).
    Lets buyer resubmit up to 3 times.
    Idempotent and role-guarded.
    """
    order = _get_order_for_update(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")

    if order.seller_id != current_seller.id:
        raise HTTPException(status_code=403, detail="Access forbidden: You are not the seller of this order.")

    # Idempotent: if already rejected with the same reason, return without error
    if order.payment_status == "rejected" and order.payment_rejected_reason == req.reason:
        return _serialize_order(order, current_seller)

    if order.payment_status != "submitted":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot reject payment when status is '{order.payment_status}'. Only submitted payments can be rejected.",
        )

    previous_status = order.payment_status
    order.payment_resubmit_count += 1
    order.payment_status = "rejected"
    order.payment_rejected_reason = req.reason
    rejected_utr = order.upi_utr
    order.upi_utr = None

    logger.warning(
        f"[Payment] Order #{order.id} payment_status changed: '{previous_status}' -> 'rejected' (Prev UTR: {rejected_utr}, Reason: '{req.reason}', Attempt: {order.payment_resubmit_count}/3, Seller: #{current_seller.id})"
    )

    history = OrderStatusHistory(
        order_id=order.id,
        status=order.status,
        note=f"Seller rejected UPI payment: {req.reason}. Resubmission attempt {order.payment_resubmit_count}/3."[:255],
    )
    db.add(history)
    db.commit()
    db.refresh(order)

    _notify(background_tasks, order, "payment_rejected")
    return _serialize_order(order, current_seller)


# ==========================================
# SHARED: GET MY ORDERS (TAB FILTER)
# ==========================================

@router.get("/mine", response_model=PaginatedResponse[OrderOut])
def get_my_orders(
    tab: Optional[str] = Query("all", description="ongoing, delivered, cancelled, returns, all"),
    limit: int = Query(20, ge=1, le=100, description="Items per page (1-100, default 20)"),
    offset: int = Query(0, ge=0, description="Page offset (default 0)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get user orders with limit/offset pagination. Buyer sees their purchases; Seller sees incoming farm orders.
    Tabs: ongoing, delivered, cancelled, returns, all.
    """
    # Lazily expire this user's stale unpaid UPI orders before listing
    _expire_unpaid_upi_orders_batch(db, current_user)

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

    total = query.count()
    orders = (
        query.options(selectinload(Order.status_history), joinedload(Order.buyer), joinedload(Order.seller))
        .order_by(Order.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return {
        "items": [_serialize_order(o, current_user) for o in orders],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


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

    _check_and_expire_order(order, db)
    return _serialize_order(order, current_user)


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

    _check_and_expire_order(order, db)

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
        # Only the buyer may see the handover code
        delivery_otp=order.delivery_otp if current_user.id == order.buyer_id else None,
    )
