from unittest.mock import patch
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.device_token import DeviceToken
from app.models.notification import Notification
from app.models.order import Order
from app.models.product import Product
from app.models.user import User


def test_register_and_unregister_device_token(buyer_client: TestClient, db: Session, test_buyer: User):
    """Test registering an Expo push token and unregistering it."""
    push_token = "ExponentPushToken[AbCdEf1234567890abcdef]"

    # Register token
    resp = buyer_client.post(
        "/notifications/register-token",
        json={"token": push_token, "platform": "android"},
    )
    assert resp.status_code == 200
    assert "registered successfully" in resp.json()["message"]

    token_row = db.query(DeviceToken).filter(DeviceToken.token == push_token).first()
    assert token_row is not None
    assert token_row.user_id == test_buyer.id
    assert token_row.platform == "android"

    # Unregister token
    unreg_resp = buyer_client.delete(f"/notifications/unregister-token?token={push_token}")
    assert unreg_resp.status_code == 200
    assert "unregistered successfully" in unreg_resp.json()["message"]

    deleted_token = db.query(DeviceToken).filter(DeviceToken.token == push_token).first()
    assert deleted_token is None


def test_order_status_triggers_push_and_notifications(
    buyer_client: TestClient,
    seller_client: TestClient,
    test_product_nearby: Product,
    test_seller: User,
    test_buyer: User,
    db: Session,
):
    """Test placing an order dispatches Expo push and records in-app notification for seller and buyer."""
    # Register tokens for seller and buyer
    seller_token = "ExponentPushToken[SellerDeviceToken12345]"
    buyer_token = "ExponentPushToken[BuyerDeviceToken67890]"

    db.add(DeviceToken(user_id=test_seller.id, token=seller_token, platform="android"))
    db.add(DeviceToken(user_id=test_buyer.id, token=buyer_token, platform="android"))
    db.commit()

    with patch("app.services.push.send_expo_push") as mock_push:
        # Buyer places order
        order_resp = buyer_client.post(
            "/orders",
            json={
                "items": [{"product_id": test_product_nearby.id, "quantity": 2.0}],
                "payment_method": "cod",
                "address": "10 West Masi Street, Madurai",
            },
        )
        assert order_resp.status_code == 201
        order_id = order_resp.json()["id"]

        # Seller should have received a notification record in DB
        seller_notifs = (
            db.query(Notification)
            .filter(Notification.user_id == test_seller.id)
            .all()
        )
        assert len(seller_notifs) >= 1
        assert "New Order Received" in seller_notifs[0].title
        assert seller_notifs[0].order_id == order_id

        # Mock push was called with seller token
        mock_push.assert_called()
        call_args = mock_push.call_args[1]
        assert seller_token in call_args["tokens"]

        # Seller approves order
        mock_push.reset_mock()
        approve_resp = seller_client.patch(
            f"/orders/{order_id}/approve",
            json={"extra_delivery_fee": 0},
        )
        assert approve_resp.status_code == 200

        # Buyer should now have received an in-app notification and push
        buyer_notifs = (
            db.query(Notification)
            .filter(Notification.user_id == test_buyer.id)
            .all()
        )
        assert len(buyer_notifs) >= 1
        assert "Order Confirmed" in buyer_notifs[0].title
        assert buyer_notifs[0].order_id == order_id


def test_get_and_mark_notifications_read(
    buyer_client: TestClient,
    test_buyer: User,
    db: Session,
):
    """Test GET /notifications, mark single read, and mark all read."""
    n1 = Notification(
        user_id=test_buyer.id,
        type="order",
        title="Delivery update",
        message="Package out for delivery",
        read=False,
    )
    n2 = Notification(
        user_id=test_buyer.id,
        type="harvest",
        title="Fresh Tomatoes",
        message="Available now",
        read=False,
    )
    db.add_all([n1, n2])
    db.commit()

    # GET notifications
    resp = buyer_client.get("/notifications")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    assert data["unread_count"] == 2

    # Mark single notification read
    mark_resp = buyer_client.patch(f"/notifications/{n1.id}/read")
    assert mark_resp.status_code == 200
    assert mark_resp.json()["read"] is True

    # Mark all read
    all_read_resp = buyer_client.patch("/notifications/mark-all-read")
    assert all_read_resp.status_code == 200

    refreshed = buyer_client.get("/notifications").json()
    assert refreshed["unread_count"] == 0


def test_delete_account_anonymizes_personal_data_preserves_orders(
    buyer_client: TestClient,
    test_buyer: User,
    test_product_nearby: Product,
    db: Session,
):
    """
    DELETE /auth/me must anonymize personal details (mobile, name, address, coordinates),
    remove device push tokens and notifications, but preserve the Order record for financial/accounting records.
    """
    # 1. Place an order to verify it stays intact
    order_resp = buyer_client.post(
        "/orders",
        json={
            "items": [{"product_id": test_product_nearby.id, "quantity": 1.0}],
            "payment_method": "cod",
            "address": "45 North Car Street, Madurai",
        },
    )
    assert order_resp.status_code == 201
    order_id = order_resp.json()["id"]

    # 2. Add a device token and notification for buyer
    db.add(DeviceToken(user_id=test_buyer.id, token="ExponentPushToken[ToBeDeleted1234]"))
    db.add(Notification(user_id=test_buyer.id, title="Test", message="Test", read=False))
    db.commit()

    buyer_id = test_buyer.id
    original_mobile = test_buyer.mobile

    # 3. Call DELETE /auth/me
    del_resp = buyer_client.delete("/auth/me")
    assert del_resp.status_code == 200
    assert "successfully deleted and anonymized" in del_resp.json()["message"]

    # Refresh user from database
    db.expire_all()
    user_in_db = db.query(User).filter(User.id == buyer_id).first()
    assert user_in_db is not None
    assert user_in_db.name == "Deleted User"
    assert user_in_db.mobile is None
    assert user_in_db.email is None
    assert user_in_db.hashed_password is None
    assert user_in_db.deleted_at is not None
    assert original_mobile != user_in_db.mobile

    # The old session token must no longer work
    assert buyer_client.get("/auth/me").status_code == 401
    assert user_in_db.address is None
    assert user_in_db.lat is None
    assert user_in_db.lng is None

    # Device tokens and notifications must be deleted
    tokens = db.query(DeviceToken).filter(DeviceToken.user_id == buyer_id).all()
    assert len(tokens) == 0
    notifs = db.query(Notification).filter(Notification.user_id == buyer_id).all()
    assert len(notifs) == 0

    # Order record must still exist with intact financial totals for accounting
    persisted_order = db.query(Order).filter(Order.id == order_id).first()
    assert persisted_order is not None
    assert persisted_order.buyer_id == buyer_id
    assert persisted_order.total > 0

    # The still-open order was cancelled (stock returned) and the buyer's address scrubbed from it
    assert persisted_order.status == "cancelled"
    assert persisted_order.address == "[removed - account deleted]"
    assert persisted_order.lat is None and persisted_order.delivery_otp is None
    db.refresh(test_product_nearby)
    assert test_product_nearby.stock == 100


def _place_order(buyer_client: TestClient, product: Product) -> int:
    resp = buyer_client.post(
        "/orders",
        json={
            "items": [{"product_id": product.id, "quantity": 1.0}],
            "payment_method": "cod",
            "address": "12 East Veli Street, Madurai",
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def test_delete_account_blocked_while_order_in_progress(
    buyer_client: TestClient, seller_client: TestClient, test_buyer: User, test_product_nearby: Product, db: Session
):
    order_id = _place_order(buyer_client, test_product_nearby)
    db.query(Order).filter(Order.id == order_id).update({"status": "packed"})
    db.commit()

    for c in (buyer_client, seller_client):
        resp = c.delete("/auth/me")
        assert resp.status_code == 409
        assert f"#{order_id}" in resp.json()["detail"]

    db.expire_all()
    assert db.get(User, test_buyer.id).deleted_at is None
    assert db.get(Order, order_id).address == "12 East Veli Street, Madurai"


def test_delete_account_blocked_while_upi_payment_unsettled(
    buyer_client: TestClient, test_product_nearby: Product, db: Session
):
    order_id = _place_order(buyer_client, test_product_nearby)
    db.query(Order).filter(Order.id == order_id).update({"payment_method": "upi", "payment_status": "submitted"})
    db.commit()

    assert buyer_client.delete("/auth/me").status_code == 409


def test_seller_deletion_rejects_pending_orders_and_archives_listings(
    buyer_client: TestClient, seller_client: TestClient, test_seller: User, test_product_nearby: Product, db: Session
):
    order_id = _place_order(buyer_client, test_product_nearby)

    with patch("app.routers.auth.dispatch_order_notification") as notify:
        assert seller_client.delete("/auth/me").status_code == 200
    notify.assert_called_once_with(order_id, "rejected")

    db.expire_all()
    order = db.get(Order, order_id)
    assert order.status == "rejected"
    assert "closed their FarmKart account" in order.reject_reason
    assert order.address == "12 East Veli Street, Madurai"  # buyer's data is not the seller's to erase

    product = db.get(Product, test_product_nearby.id)
    assert product.deleted_at is not None and product.is_active is False
    assert db.get(User, test_seller.id).upi_id is None


def test_delete_account_removes_uploaded_avatar(buyer_client: TestClient, test_buyer: User, db: Session, tmp_path):
    from app.services import s3

    avatar = "a" * 32 + ".jpg"
    with patch.object(s3, "LOCAL_UPLOAD_DIR", str(tmp_path)):
        (tmp_path / avatar).write_bytes(b"x")
        test_buyer.avatar_url = f"http://testserver/static/uploads/{avatar}"
        db.commit()

        assert buyer_client.delete("/auth/me").status_code == 200
        assert not (tmp_path / avatar).exists()


def test_delete_uploaded_image_ignores_foreign_urls(tmp_path):
    from app.services import s3

    with patch.object(s3, "LOCAL_UPLOAD_DIR", str(tmp_path)):
        (tmp_path / "keep.jpg").write_bytes(b"x")
        assert s3.delete_uploaded_image("https://lh3.googleusercontent.com/a/photo.jpg") is False
        assert s3.delete_uploaded_image("/static/uploads/../keep.jpg") is False
        assert s3.delete_uploaded_image(None) is False
        assert (tmp_path / "keep.jpg").exists()


def test_product_delete_archives_ordered_listing_and_removes_unused_one(
    buyer_client: TestClient, seller_client: TestClient, test_seller: User, test_product_nearby: Product, db: Session
):
    _place_order(buyer_client, test_product_nearby)
    assert seller_client.delete(f"/products/{test_product_nearby.id}").status_code == 200
    db.expire_all()
    archived = db.get(Product, test_product_nearby.id)
    assert archived is not None and archived.deleted_at is not None

    unused = Product(
        seller_id=test_seller.id, name="Unused Brinjal", category="vegetables", price=30.0,
        unit="kg", stock=10, min_order=1, is_active=True,
    )
    db.add(unused)
    db.commit()
    unused_id = unused.id
    assert seller_client.delete(f"/products/{unused_id}").status_code == 200
    db.expire_all()
    assert db.get(Product, unused_id) is None


def test_public_account_deletion_page(client: TestClient):
    resp = client.get("/account/delete")
    assert resp.status_code == 200
    assert "text/html" in resp.headers["content-type"]
    assert "Delete My Account" in resp.text
