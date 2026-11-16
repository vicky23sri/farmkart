from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models.product import Product
from app.models.order import Order


def test_order_creation_within_50km(
    buyer_client: TestClient,
    db: Session,
    test_product_nearby: Product,
):
    """Orders placed within 50 km default to 'placed', reduce stock immediately, and is_extended_delivery=False."""
    initial_stock = test_product_nearby.stock
    order_qty = 5

    payload = {
        "items": [{"product_id": test_product_nearby.id, "quantity": order_qty}],
        "address": "Anna Nagar, Madurai",
        "lat": 10.0528,
        "lng": 77.9625,
        "payment_method": "cod",
    }
    resp = buyer_client.post("/orders", json=payload)
    assert resp.status_code == 201
    data = resp.json()

    assert data["status"] == "placed"
    assert data["is_extended_delivery"] is False
    assert data["stock_reduced"] is True

    # Verify product stock was reduced
    db.refresh(test_product_nearby)
    assert test_product_nearby.stock == initial_stock - order_qty


def test_order_creation_beyond_50km(
    buyer_client: TestClient,
    db: Session,
    test_product_far: Product,
):
    """Orders placed beyond 50 km default to 'pending_seller_approval', is_extended_delivery=True, and reduce stock."""
    initial_stock = test_product_far.stock
    order_qty = 10

    payload = {
        "items": [{"product_id": test_product_far.id, "quantity": order_qty}],
        "address": "Salem Town",
        "lat": 11.6643,
        "lng": 78.1460,
        "payment_method": "cod",
    }
    resp = buyer_client.post("/orders", json=payload)
    assert resp.status_code == 201
    data = resp.json()

    assert data["status"] == "pending_seller_approval"
    assert data["is_extended_delivery"] is True
    assert data["stock_reduced"] is True

    # Verify product stock was reduced
    db.refresh(test_product_far)
    assert test_product_far.stock == initial_stock - order_qty


def test_seller_approve_zero_extra_fee(
    buyer_client: TestClient,
    seller_client: TestClient,
    test_product_far: Product,
):
    """Seller approving an extended-delivery order with 0 extra fee immediately confirms the order."""
    create_resp = buyer_client.post(
        "/orders",
        json={
            "items": [{"product_id": test_product_far.id, "quantity": 5}],
            "address": "Salem Town",
            "lat": 11.6643,
            "lng": 78.1460,
            "payment_method": "cod",
        },
    )
    order_id = create_resp.json()["id"]

    approve_resp = seller_client.patch(
        f"/orders/{order_id}/approve",
        json={"extra_delivery_fee": 0, "seller_note": "Approved with free delivery"},
    )
    assert approve_resp.status_code == 200
    assert approve_resp.json()["status"] == "confirmed"


def test_seller_approve_with_extra_fee_and_buyer_confirm(
    buyer_client: TestClient,
    seller_client: TestClient,
    test_product_far: Product,
):
    """Seller approving with extra fee sets status to awaiting_buyer_confirmation, then buyer confirm moves to confirmed."""
    create_resp = buyer_client.post(
        "/orders",
        json={
            "items": [{"product_id": test_product_far.id, "quantity": 5}],
            "address": "Salem Town",
            "lat": 11.6643,
            "lng": 78.1460,
            "payment_method": "cod",
        },
    )
    order_id = create_resp.json()["id"]

    # Seller approves with 100 extra fee
    approve_resp = seller_client.patch(
        f"/orders/{order_id}/approve",
        json={"extra_delivery_fee": 100, "seller_note": "Special long distance transport required"},
    )
    assert approve_resp.status_code == 200
    assert approve_resp.json()["status"] == "awaiting_buyer_confirmation"
    assert approve_resp.json()["extra_delivery_fee"] == 100

    # Buyer confirms
    confirm_resp = buyer_client.patch(f"/orders/{order_id}/buyer-confirm")
    assert confirm_resp.status_code == 200
    assert confirm_resp.json()["status"] == "confirmed"


def test_seller_reject_order_restores_stock_idempotently(
    buyer_client: TestClient,
    seller_client: TestClient,
    db: Session,
    test_product_far: Product,
):
    """Rejecting an order restores stock atomically and never restores twice."""
    initial_stock = test_product_far.stock
    order_qty = 5

    create_resp = buyer_client.post(
        "/orders",
        json={
            "items": [{"product_id": test_product_far.id, "quantity": order_qty}],
            "address": "Madurai",
            "lat": 10.0528,
            "lng": 77.9625,
            "payment_method": "cod",
        },
    )
    order_id = create_resp.json()["id"]

    # Stock was reduced
    db.refresh(test_product_far)
    assert test_product_far.stock == initial_stock - order_qty

    # Seller rejects order
    reject_resp = seller_client.patch(
        f"/orders/{order_id}/reject",
        json={"reason": "Cannot deliver to this location due to rains"},
    )
    assert reject_resp.status_code == 200
    assert reject_resp.json()["status"] == "rejected"
    assert reject_resp.json()["stock_reduced"] is False

    # Stock is restored
    db.refresh(test_product_far)
    assert test_product_far.stock == initial_stock

    # Attempting to reject again should not restore stock a second time
    reject_again = seller_client.patch(
        f"/orders/{order_id}/reject",
        json={"reason": "Repeat reject"},
    )
    assert reject_again.status_code in [200, 400]
    db.refresh(test_product_far)
    assert test_product_far.stock == initial_stock


def test_buyer_cancel_order_restores_stock_idempotently(
    buyer_client: TestClient,
    db: Session,
    test_product_nearby: Product,
):
    """Buyer cancelling a placed order restores stock atomically and idempotently."""
    initial_stock = test_product_nearby.stock
    order_qty = 8

    create_resp = buyer_client.post(
        "/orders",
        json={
            "items": [{"product_id": test_product_nearby.id, "quantity": order_qty}],
            "address": "Anna Nagar, Madurai",
            "lat": 10.0528,
            "lng": 77.9625,
            "payment_method": "cod",
        },
    )
    order_id = create_resp.json()["id"]

    db.refresh(test_product_nearby)
    assert test_product_nearby.stock == initial_stock - order_qty

    # Buyer cancels order
    cancel_resp = buyer_client.patch(f"/orders/{order_id}/cancel")
    assert cancel_resp.status_code == 200
    assert cancel_resp.json()["status"] == "cancelled"
    assert cancel_resp.json()["stock_reduced"] is False

    # Stock is restored
    db.refresh(test_product_nearby)
    assert test_product_nearby.stock == initial_stock

    # Subsequent cancellation attempt does not restore stock twice
    cancel_again = buyer_client.patch(f"/orders/{order_id}/cancel")
    assert cancel_again.status_code in [200, 400]
    db.refresh(test_product_nearby)
    assert test_product_nearby.stock == initial_stock


def test_order_status_progression(
    buyer_client: TestClient,
    seller_client: TestClient,
    test_product_nearby: Product,
):
    """Status must progress in order: confirmed -> packed -> shipped -> out_for_delivery -> delivered."""
    create_resp = buyer_client.post(
        "/orders",
        json={
            "items": [{"product_id": test_product_nearby.id, "quantity": 2}],
            "address": "Madurai",
            "lat": 10.0528,
            "lng": 77.9625,
            "payment_method": "cod",
        },
    )
    order_id = create_resp.json()["id"]
    # The buyer sees the handover OTP; the seller must not
    delivery_otp = create_resp.json()["delivery_otp"]
    assert delivery_otp and len(delivery_otp) == 6

    # Placed -> Confirmed via seller approval
    r1 = seller_client.patch(f"/orders/{order_id}/approve", json={"extra_delivery_fee": 0})
    assert r1.status_code == 200
    assert r1.json()["status"] == "confirmed"
    assert r1.json()["delivery_otp"] is None

    # Confirmed -> Delivered directly is invalid transition!
    invalid_r = seller_client.patch(f"/orders/{order_id}/status", json={"status": "delivered"})
    assert invalid_r.status_code == 400
    assert "Invalid transition" in invalid_r.json()["detail"]

    # Confirmed -> Packed
    r2 = seller_client.patch(f"/orders/{order_id}/status", json={"status": "packed"})
    assert r2.status_code == 200
    assert r2.json()["status"] == "packed"

    # Packed -> Shipped
    r3 = seller_client.patch(f"/orders/{order_id}/status", json={"status": "shipped"})
    assert r3.status_code == 200
    assert r3.json()["status"] == "shipped"

    # Shipped -> Out for delivery
    r4 = seller_client.patch(f"/orders/{order_id}/status", json={"status": "out_for_delivery"})
    assert r4.status_code == 200
    assert r4.json()["status"] == "out_for_delivery"

    # Delivered requires the buyer's OTP
    no_otp = seller_client.patch(f"/orders/{order_id}/status", json={"status": "delivered"})
    assert no_otp.status_code == 400
    wrong = "000000" if delivery_otp != "000000" else "111111"
    bad_otp = seller_client.patch(
        f"/orders/{order_id}/status", json={"status": "delivered", "delivery_otp": wrong}
    )
    assert bad_otp.status_code == 400

    # Out for delivery -> Delivered
    r5 = seller_client.patch(
        f"/orders/{order_id}/status", json={"status": "delivered", "delivery_otp": delivery_otp}
    )
    assert r5.status_code == 200
    assert r5.json()["status"] == "delivered"
