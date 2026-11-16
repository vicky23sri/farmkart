import logging
from typing import Any, Dict, List, Optional
import httpx
from sqlalchemy.orm import Session

from app.models.device_token import DeviceToken
from app.models.notification import Notification
from app.models.order import Order

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


EXPO_BATCH_SIZE = 100  # Expo accepts at most 100 messages per request


def send_expo_push(
    tokens: List[str],
    title: str,
    body: str,
    data: Optional[Dict[str, Any]] = None,
) -> List[str]:
    """
    Sends push notifications via the Expo Push API.
    Returns the list of tokens Expo reported as no longer registered (to be pruned).
    """
    valid_tokens = [t for t in tokens if t.startswith("ExponentPushToken[") or t.startswith("ExpoPushToken[")]
    if not valid_tokens:
        return []

    dead_tokens: List[str] = []
    try:
        with httpx.Client(timeout=10.0) as client:
            for i in range(0, len(valid_tokens), EXPO_BATCH_SIZE):
                batch = valid_tokens[i : i + EXPO_BATCH_SIZE]
                messages = [
                    {
                        "to": token,
                        "sound": "default",
                        "title": title,
                        "body": body,
                        "data": data or {},
                        "priority": "high",
                    }
                    for token in batch
                ]
                resp = client.post(
                    EXPO_PUSH_URL,
                    json=messages,
                    headers={"Accept": "application/json", "Content-Type": "application/json"},
                )
                if resp.status_code != 200:
                    logger.warning("Expo push API returned status %d", resp.status_code)
                    continue
                tickets = (resp.json() or {}).get("data") or []
                for token, ticket in zip(batch, tickets):
                    if ticket.get("status") == "error":
                        err = (ticket.get("details") or {}).get("error")
                        if err == "DeviceNotRegistered":
                            dead_tokens.append(token)
                        else:
                            logger.warning("Expo push ticket error: %s", err or ticket.get("message"))
    except Exception as exc:
        logger.error("Failed to transmit push notifications to Expo: %s", exc)
    return dead_tokens


def dispatch_order_notification(order_id: int, new_status: str) -> None:
    """
    Background-task entry point: loads the order in a fresh session and notifies the
    counterparty. Runs after the response is sent so Expo latency never blocks the API.
    """
    from app.core.database import SessionLocal

    db = SessionLocal()
    try:
        order = db.get(Order, order_id)
        if order:
            notify_order_status_change(order, new_status, db)
    except Exception:
        logger.exception("Failed to dispatch notification for order #%s", order_id)
    finally:
        db.close()


def notify_order_status_change(order: Order, new_status: str, db: Session) -> None:
    """
    Dispatches real push notifications and creates in-app notification records
    on order lifecycle transitions: placed, approved/confirmed, packed, shipped,
    out_for_delivery, delivered.
    """
    first_item = order.items[0] if (order.items and len(order.items) > 0) else {}
    product_name = first_item.get("name", "Farm produce")
    product_id = first_item.get("product_id")
    quantity = first_item.get("quantity", "")
    unit = first_item.get("unit", "")
    qty_str = f" (Qty: {quantity} {unit})".strip() if quantity else ""

    target_user_id: Optional[int] = None
    title = ""
    title_ta = ""
    message = ""
    message_ta = ""

    if new_status == "placed":
        # Notify the seller of the incoming order
        target_user_id = order.seller_id
        title = "New Order Received! 🚜"
        title_ta = "புதிய ஆர்டர் வந்துள்ளது! 🚜"
        message = f"New order #{order.id} placed for {product_name}{qty_str}."
        message_ta = f"{product_name} விளைபொருளுக்கு புதிய ஆர்டர் #{order.id} வந்துள்ளது."

    elif new_status == "confirmed":
        # Seller approved the order
        target_user_id = order.buyer_id
        title = "Order Confirmed! ✅"
        title_ta = "ஆர்டர் உறுதிசெய்யப்பட்டது! ✅"
        message = f"Farmer has confirmed your order #{order.id} for {product_name}."
        message_ta = f"உங்கள் ஆர்டர் #{order.id} விவசாயியால் உறுதிசெய்யப்பட்டது."

    elif new_status == "packed":
        target_user_id = order.buyer_id
        title = "Order Packed! 📦"
        title_ta = "ஆர்டர் பேக் செய்யப்பட்டது! 📦"
        message = f"Your order #{order.id} for {product_name} is packed and ready for dispatch."
        message_ta = f"உங்கள் ஆர்டர் #{order.id} பாதுகாப்பாக பேக் செய்யப்பட்டுள்ளது."

    elif new_status == "shipped":
        target_user_id = order.buyer_id
        title = "Order Shipped! 🚚"
        title_ta = "ஆர்டர் அனுப்பப்பட்டது! 🚚"
        message = f"Your order #{order.id} has been dispatched from the farm."
        message_ta = f"உங்கள் ஆர்டர் #{order.id} பண்ணையிலிருந்து புறப்பட்டுவிட்டது."

    elif new_status == "out_for_delivery":
        target_user_id = order.buyer_id
        title = "Out for Delivery! 🛵"
        title_ta = "விநியோகத்திற்கு புறப்பட்டது! 🛵"
        message = f"Your order #{order.id} is out for delivery to your doorstep."
        message_ta = f"உங்கள் ஆர்டர் #{order.id} உங்கள் முகவரிக்கு கொண்டு வரப்படுகிறது."

    elif new_status == "delivered":
        target_user_id = order.buyer_id
        title = "Order Delivered! 🌾"
        title_ta = "ஆர்டர் விநியோகிக்கப்பட்டது! 🌾"
        message = f"Your order #{order.id} has been delivered. Thank you for buying direct from farmers!"
        message_ta = f"உங்கள் ஆர்டர் #{order.id} வெற்றிகரமாக விநியோகிக்கப்பட்டது. நன்றி!"

    elif new_status == "rejected":
        target_user_id = order.buyer_id
        title = "Order Declined"
        title_ta = "ஆர்டர் நிராகரிக்கப்பட்டது"
        message = f"The farmer could not accept order #{order.id}. Reason: {order.reject_reason or 'not specified'}."
        message_ta = f"உங்கள் ஆர்டர் #{order.id} விவசாயியால் ஏற்கப்படவில்லை."

    elif new_status == "cancelled":
        target_user_id = order.seller_id
        title = "Order Cancelled"
        title_ta = "ஆர்டர் ரத்து செய்யப்பட்டது"
        message = f"Order #{order.id} was cancelled."
        message_ta = f"ஆர்டர் #{order.id} ரத்து செய்யப்பட்டது."

    elif new_status == "awaiting_buyer_confirmation":
        target_user_id = order.buyer_id
        title = "Extra Delivery Fee Requested"
        title_ta = "கூடுதல் விநியோக கட்டணம்"
        message = f"The farmer can deliver order #{order.id} for an extra Rs. {order.extra_delivery_fee:.2f}. Please review."
        message_ta = f"ஆர்டர் #{order.id} க்கு கூடுதல் விநியோக கட்டணம் கோரப்பட்டுள்ளது."

    elif new_status == "payment_submitted":
        target_user_id = order.seller_id
        title = "Payment Submitted"
        title_ta = "கட்டணம் சமர்ப்பிக்கப்பட்டது"
        message = f"Buyer submitted UPI reference for order #{order.id}. Please verify it in your bank app."
        message_ta = f"ஆர்டர் #{order.id} க்கான UPI கட்டண விவரம் சமர்ப்பிக்கப்பட்டது."

    elif new_status == "payment_confirmed":
        target_user_id = order.buyer_id
        title = "Payment Confirmed"
        title_ta = "கட்டணம் உறுதிசெய்யப்பட்டது"
        message = f"The farmer confirmed your payment for order #{order.id}."
        message_ta = f"ஆர்டர் #{order.id} க்கான உங்கள் கட்டணம் உறுதிசெய்யப்பட்டது."

    elif new_status == "payment_rejected":
        target_user_id = order.buyer_id
        title = "Payment Not Verified"
        title_ta = "கட்டணம் சரிபார்க்கப்படவில்லை"
        message = f"Payment for order #{order.id} could not be verified: {order.payment_rejected_reason or ''}".strip()
        message_ta = f"ஆர்டர் #{order.id} க்கான கட்டணம் சரிபார்க்கப்படவில்லை."

    if not target_user_id or not title:
        return

    # 1. Save in-app notification in database
    notif = Notification(
        user_id=target_user_id,
        type="order",
        title=title,
        title_tamil=title_ta,
        message=message,
        message_tamil=message_ta,
        order_id=order.id,
        product_id=product_id,
        read=False,
    )
    db.add(notif)
    try:
        db.commit()
    except Exception as exc:
        logger.error("Failed to save notification record: %s", exc)
        db.rollback()

    # 2. Query device tokens for target user
    tokens = (
        db.query(DeviceToken.token)
        .filter(DeviceToken.user_id == target_user_id)
        .all()
    )
    token_strings = [t[0] for t in tokens if t[0]]

    # 3. Transmit push via Expo and prune tokens for uninstalled apps
    if token_strings:
        dead = send_expo_push(
            tokens=token_strings,
            title=title,
            body=message,
            data={
                "order_id": order.id,
                "notification_id": notif.id,
                "status": new_status,
                "type": "order",
                "titleTamil": title_ta,
                "messageTamil": message_ta,
            },
        )
        if dead:
            db.query(DeviceToken).filter(DeviceToken.token.in_(dead)).delete(synchronize_session=False)
            db.commit()
