"""Account deletion: settle open orders, then anonymize the user's personal data."""

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.device_token import DeviceToken
from app.models.notification import Notification
from app.models.order import Order, OrderStatusHistory
from app.models.otp import OTP
from app.models.product import Product
from app.models.user import User
from app.services.s3 import delete_uploaded_image

logger = logging.getLogger(__name__)

# Orders that are finished; nothing about them changes when an account is deleted.
TERMINAL_STATUSES = ("delivered", "cancelled", "rejected", "returned")
# Orders the seller has not committed to yet; deleting an account cancels these automatically.
AUTO_CANCEL_STATUSES = ("placed", "pending_seller_approval", "awaiting_buyer_confirmation")
# A UPI payment the buyer has made (or the seller has confirmed) must be settled by a person.
MONEY_IN_FLIGHT_PAYMENT_STATUSES = ("submitted", "paid")

REMOVED_ADDRESS = "[removed - account deleted]"


class AccountDeletionBlocked(Exception):
    """The account still has orders that a person has to finish first."""


@dataclass
class DeletionResult:
    # (order_id, event) pairs to push to the other party once the transaction has committed
    notifications: list[tuple[int, str]] = field(default_factory=list)


def _open_orders(db: Session, user: User) -> list[Order]:
    return (
        db.query(Order)
        .filter(
            or_(Order.buyer_id == user.id, Order.seller_id == user.id),
            Order.status.notin_(TERMINAL_STATUSES),
        )
        .with_for_update()
        .all()
    )


def _blocking_orders(orders: list[Order]) -> list[Order]:
    return [
        o
        for o in orders
        if o.status not in AUTO_CANCEL_STATUSES or o.payment_status in MONEY_IN_FLIGHT_PAYMENT_STATUSES
    ]


def delete_account(db: Session, user: User) -> DeletionResult:
    """
    Delete a user's account.

    - Refuses (AccountDeletionBlocked) while an order is in progress (confirmed, packed, shipped,
      out for delivery) or has a UPI payment awaiting settlement, so nobody loses goods or money.
    - Cancels orders the seller has not accepted yet and tells the other party.
    - Anonymizes the user row (kept so order and payout records stay intact), removes the
      delivery address from their past orders, and deletes their avatar, device tokens,
      notifications and OTPs.
    - Sellers' listings are archived.
    The caller commits nothing: this function commits on success.
    """
    from app.routers.orders import _restore_stock  # local import: avoids a router import cycle

    now = datetime.now(timezone.utc)
    result = DeletionResult()

    open_orders = _open_orders(db, user)
    blocking = _blocking_orders(open_orders)
    if blocking:
        db.rollback()
        ids = ", ".join(f"#{o.id}" for o in blocking[:5])
        more = "" if len(blocking) <= 5 else f" and {len(blocking) - 5} more"
        raise AccountDeletionBlocked(
            f"You have {len(blocking)} order(s) in progress ({ids}{more}). "
            "Please complete or settle them before deleting your account."
        )

    for order in open_orders:
        _restore_stock(order, db)
        if order.buyer_id == user.id:
            order.status = "cancelled"
            note = "Order cancelled automatically because the buyer deleted their account."
            event = "cancelled"  # notifies the seller
        else:
            order.status = "rejected"
            order.reject_reason = "The farmer has closed their FarmKart account."
            note = "Order cancelled automatically because the seller deleted their account."
            event = "rejected"  # notifies the buyer
        db.add(OrderStatusHistory(order_id=order.id, status=order.status, note=note))
        result.notifications.append((order.id, event))

    # Past orders keep amounts and items for accounting, but not where the buyer lives.
    db.query(Order).filter(Order.buyer_id == user.id).update(
        {
            "address": REMOVED_ADDRESS,
            "lat": None,
            "lng": None,
            "delivery_notes": None,
            "delivery_otp": None,
        },
        synchronize_session=False,
    )

    if user.role == "seller":
        db.query(Product).filter(Product.seller_id == user.id, Product.deleted_at.is_(None)).update(
            {"is_active": False, "deleted_at": now}, synchronize_session=False
        )

    db.query(DeviceToken).filter(DeviceToken.user_id == user.id).delete(synchronize_session=False)
    db.query(Notification).filter(Notification.user_id == user.id).delete(synchronize_session=False)
    if user.mobile:
        db.query(OTP).filter(OTP.mobile == user.mobile).delete(synchronize_session=False)

    avatar_url = user.avatar_url

    # Keep the row (orders, reviews and payouts reference it) but strip everything personal.
    # Clearing mobile/email frees them for a fresh sign-up later.
    user.name = "Deleted User"
    user.mobile = None
    user.email = None
    user.hashed_password = None
    user.avatar_url = None
    user.address = None
    user.lat = None
    user.lng = None
    user.upi_id = None
    user.deleted_at = now

    db.commit()

    # Only after the commit: a failed commit must not leave the profile pointing at a deleted file.
    if avatar_url:
        delete_uploaded_image(avatar_url)

    logger.info("Account %s deleted; %d open order(s) auto-cancelled", user.id, len(open_orders))
    return result
