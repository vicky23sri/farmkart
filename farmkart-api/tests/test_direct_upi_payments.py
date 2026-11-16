import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import create_access_token
from app.models.user import User
from app.models.product import Product
from app.models.order import Order


def test_seller_upi_id_profile_update(client: TestClient, db: Session, test_seller: User, test_buyer: User):
    """
    Sellers can set and update a valid UPI ID (regex validated).
    Buyers cannot set a UPI ID (HTTP 400).
    """
    seller_token = create_access_token({"user_id": str(test_seller.id), "role": "seller"})
    buyer_token = create_access_token({"user_id": str(test_buyer.id), "role": "buyer"})

    # Seller updates with valid UPI ID
    res = client.put(
        "/auth/profile",
        headers={"Authorization": f"Bearer {seller_token}"},
        json={"upi_id": "organicfarmer@oksbi"},
    )
    assert res.status_code == 200, res.text
    assert res.json()["upi_id"] == "organicfarmer@oksbi"

    # Seller updates with invalid UPI ID format (fails with 422)
    res_invalid = client.put(
        "/auth/profile",
        headers={"Authorization": f"Bearer {seller_token}"},
        json={"upi_id": "invalid_upi_no_at"},
    )
    assert res_invalid.status_code == 422

    # Buyer tries to set UPI ID (fails with 400 - sellers only)
    res_buyer = client.put(
        "/auth/profile",
        headers={"Authorization": f"Bearer {buyer_token}"},
        json={"upi_id": "buyer@okhdfc"},
    )
    assert res_buyer.status_code == 400
    assert "Only sellers can configure a UPI ID" in res_buyer.json()["detail"]


def test_upi_link_amount_computed_server_side(
    client: TestClient,
    db: Session,
    test_seller: User,
    test_buyer: User,
    test_product_nearby: Product,
):
    """
    GET /orders/{id}/upi-link:
    - Amount is computed strictly server-side from order total.
    - URL-encoded deep link and QR payload are generated.
    - If seller has no UPI ID, returns 400.
    """
    buyer_token = create_access_token({"user_id": str(test_buyer.id), "role": "buyer"})

    # 1. Without UPI ID set on seller, attempt returns 400
    test_seller.upi_id = None
    db.commit()

    order_res = client.post(
        "/orders",
        headers={"Authorization": f"Bearer {buyer_token}"},
        json={
            "items": [{"product_id": test_product_nearby.id, "quantity": 2.0}],
            "address": "Anna Nagar, Madurai",
            "payment_method": "upi",
        },
    )
    assert order_res.status_code == 201, order_res.text
    order_id = order_res.json()["id"]

    res_no_upi = client.get(
        f"/orders/{order_id}/upi-link",
        headers={"Authorization": f"Bearer {buyer_token}"},
    )
    assert res_no_upi.status_code == 400
    assert "seller has not configured a upi id" in res_no_upi.json()["detail"].lower()

    # 2. Configure seller UPI ID and verify server-side computed amount (2 * 40.0 = 80.0)
    test_seller.upi_id = "farmer.vadipatti@icici"
    test_seller.name = "Vadipatti Organic Farmer"
    db.commit()

    res_link = client.get(
        f"/orders/{order_id}/upi-link",
        headers={"Authorization": f"Bearer {buyer_token}"},
    )
    assert res_link.status_code == 200, res_link.text
    data = res_link.json()

    assert data["amount"] == 80.0
    assert data["payee_vpa"] == "farmer.vadipatti@icici"
    assert data["payee_name"] == "Vadipatti Organic Farmer"
    assert data["txn_ref"] == f"FK{order_id}"
    assert "upi://pay?" in data["upi_url"]
    assert "pa=farmer.vadipatti%40icici" in data["upi_url"]
    assert "am=80.00" in data["upi_url"]
    assert "cu=INR" in data["upi_url"]
    assert data["qr_payload"] == data["upi_url"]


def test_utr_format_and_uniqueness(
    client: TestClient,
    db: Session,
    test_seller: User,
    test_buyer: User,
    test_product_nearby: Product,
):
    """
    POST /orders/{id}/payment/submit-utr:
    - Validates 12 digits (fails 422 otherwise).
    - Enforces uniqueness across all orders (409 Conflict if already used).
    - Sets payment_status = 'submitted'.
    """
    test_seller.upi_id = "farmer@oksbi"
    db.commit()

    buyer_token = create_access_token({"user_id": str(test_buyer.id), "role": "buyer"})

    # Create Order 1
    ord1_res = client.post(
        "/orders",
        headers={"Authorization": f"Bearer {buyer_token}"},
        json={
            "items": [{"product_id": test_product_nearby.id, "quantity": 1.0}],
            "address": "Anna Nagar, Madurai",
            "payment_method": "upi",
        },
    )
    assert ord1_res.status_code == 201
    ord1_id = ord1_res.json()["id"]

    # Invalid UTR formats
    for bad_utr in ["12345", "1234567890123", "12345678901A", "abcdefghijkl"]:
        res_bad = client.post(
            f"/orders/{ord1_id}/payment/submit-utr",
            headers={"Authorization": f"Bearer {buyer_token}"},
            json={"utr": bad_utr},
        )
        assert res_bad.status_code == 422, f"Expected 422 for '{bad_utr}', got {res_bad.status_code}"

    # Valid 12-digit UTR
    valid_utr = "123456789012"
    res_valid = client.post(
        f"/orders/{ord1_id}/payment/submit-utr",
        headers={"Authorization": f"Bearer {buyer_token}"},
        json={"utr": valid_utr},
    )
    assert res_valid.status_code == 200, res_valid.text
    assert res_valid.json()["payment_status"] == "submitted"
    assert res_valid.json()["upi_utr"] == valid_utr
    assert res_valid.json()["payment_submitted_at"] is not None

    # Create Order 2 and attempt to reuse the exact same UTR -> 409 Conflict
    ord2_res = client.post(
        "/orders",
        headers={"Authorization": f"Bearer {buyer_token}"},
        json={
            "items": [{"product_id": test_product_nearby.id, "quantity": 1.0}],
            "address": "Anna Nagar, Madurai",
            "payment_method": "upi",
        },
    )
    assert ord2_res.status_code == 201
    ord2_id = ord2_res.json()["id"]

    res_dup = client.post(
        f"/orders/{ord2_id}/payment/submit-utr",
        headers={"Authorization": f"Bearer {buyer_token}"},
        json={"utr": valid_utr},
    )
    assert res_dup.status_code == 409
    assert "already been submitted" in res_dup.json()["detail"].lower()


def test_payment_role_guards_and_actions(
    client: TestClient,
    db: Session,
    test_seller: User,
    test_buyer: User,
    test_product_nearby: Product,
):
    """
    Only the correct buyer can fetch upi-link and submit UTR.
    Only the correct seller can confirm or reject payment.
    """
    test_seller.upi_id = "farmer@oksbi"
    db.commit()

    buyer1_token = create_access_token({"user_id": str(test_buyer.id), "role": "buyer"})

    # Create another buyer and another seller
    other_buyer = User(mobile="9998887771", name="Other Buyer", role="buyer", lat=10.0, lng=78.0, address="Madurai")
    other_seller = User(mobile="9998887772", name="Other Seller", role="seller", lat=10.0, lng=78.0, address="Theni")
    db.add_all([other_buyer, other_seller])
    db.commit()
    db.refresh(other_buyer)
    db.refresh(other_seller)

    other_buyer_token = create_access_token({"user_id": str(other_buyer.id), "role": "buyer"})
    seller_token = create_access_token({"user_id": str(test_seller.id), "role": "seller"})
    other_seller_token = create_access_token({"user_id": str(other_seller.id), "role": "seller"})

    # Buyer 1 places order
    ord_res = client.post(
        "/orders",
        headers={"Authorization": f"Bearer {buyer1_token}"},
        json={
            "items": [{"product_id": test_product_nearby.id, "quantity": 1.0}],
            "address": "Anna Nagar, Madurai",
            "payment_method": "upi",
        },
    )
    assert ord_res.status_code == 201
    order_id = ord_res.json()["id"]

    # Other buyer cannot access upi-link (403)
    res = client.get(f"/orders/{order_id}/upi-link", headers={"Authorization": f"Bearer {other_buyer_token}"})
    assert res.status_code == 403

    # Other buyer cannot submit UTR (403)
    res = client.post(
        f"/orders/{order_id}/payment/submit-utr",
        headers={"Authorization": f"Bearer {other_buyer_token}"},
        json={"utr": "987654321098"},
    )
    assert res.status_code == 403

    # Seller cannot submit UTR (403 buyer only)
    res = client.post(
        f"/orders/{order_id}/payment/submit-utr",
        headers={"Authorization": f"Bearer {seller_token}"},
        json={"utr": "987654321098"},
    )
    assert res.status_code == 403

    # Buyer submits valid UTR
    res = client.post(
        f"/orders/{order_id}/payment/submit-utr",
        headers={"Authorization": f"Bearer {buyer1_token}"},
        json={"utr": "987654321098"},
    )
    assert res.status_code == 200

    # Buyer cannot confirm payment (403 seller only)
    res = client.patch(f"/orders/{order_id}/payment/confirm", headers={"Authorization": f"Bearer {buyer1_token}"})
    assert res.status_code == 403

    # Other seller cannot confirm payment (403 not their order)
    res = client.patch(f"/orders/{order_id}/payment/confirm", headers={"Authorization": f"Bearer {other_seller_token}"})
    assert res.status_code == 403

    # Correct seller confirms payment
    res = client.patch(f"/orders/{order_id}/payment/confirm", headers={"Authorization": f"Bearer {seller_token}"})
    assert res.status_code == 200
    assert res.json()["payment_status"] == "paid"
    assert res.json()["payment_confirmed_at"] is not None

    # Idempotent confirmation: calling again still returns 200 and 'paid'
    res_repeat = client.patch(f"/orders/{order_id}/payment/confirm", headers={"Authorization": f"Bearer {seller_token}"})
    assert res_repeat.status_code == 200
    assert res_repeat.json()["payment_status"] == "paid"


def test_payment_reject_and_resubmit_limit(
    client: TestClient,
    db: Session,
    test_seller: User,
    test_buyer: User,
    test_product_nearby: Product,
):
    """
    Seller rejects payment with a reason.
    Buyer can resubmit up to 3 times; 4th attempt is rejected with HTTP 400.
    """
    test_seller.upi_id = "farmer@oksbi"
    db.commit()

    buyer_token = create_access_token({"user_id": str(test_buyer.id), "role": "buyer"})
    seller_token = create_access_token({"user_id": str(test_seller.id), "role": "seller"})

    ord_res = client.post(
        "/orders",
        headers={"Authorization": f"Bearer {buyer_token}"},
        json={
            "items": [{"product_id": test_product_nearby.id, "quantity": 1.0}],
            "address": "Anna Nagar, Madurai",
            "payment_method": "upi",
        },
    )
    assert ord_res.status_code == 201
    order_id = ord_res.json()["id"]

    # Cycle 1: Submit UTR 1 -> Reject
    client.post(
        f"/orders/{order_id}/payment/submit-utr",
        headers={"Authorization": f"Bearer {buyer_token}"},
        json={"utr": "111111111111"},
    )
    rej1 = client.patch(
        f"/orders/{order_id}/payment/reject",
        headers={"Authorization": f"Bearer {seller_token}"},
        json={"reason": "UTR not received in bank account"},
    )
    assert rej1.status_code == 200
    assert rej1.json()["payment_status"] == "rejected"
    assert rej1.json()["payment_resubmit_count"] == 1

    # Cycle 2: Submit UTR 2 -> Reject
    client.post(
        f"/orders/{order_id}/payment/submit-utr",
        headers={"Authorization": f"Bearer {buyer_token}"},
        json={"utr": "222222222222"},
    )
    rej2 = client.patch(
        f"/orders/{order_id}/payment/reject",
        headers={"Authorization": f"Bearer {seller_token}"},
        json={"reason": "Amount mismatch"},
    )
    assert rej2.status_code == 200
    assert rej2.json()["payment_resubmit_count"] == 2

    # Cycle 3: Submit UTR 3 -> Reject
    client.post(
        f"/orders/{order_id}/payment/submit-utr",
        headers={"Authorization": f"Bearer {buyer_token}"},
        json={"utr": "333333333333"},
    )
    rej3 = client.patch(
        f"/orders/{order_id}/payment/reject",
        headers={"Authorization": f"Bearer {seller_token}"},
        json={"reason": "Invalid transaction"},
    )
    assert rej3.status_code == 200
    assert rej3.json()["payment_resubmit_count"] == 3

    # Cycle 4: Attempting to submit a 4th time exceeds limit of 3 resubmissions -> 400
    res_4 = client.post(
        f"/orders/{order_id}/payment/submit-utr",
        headers={"Authorization": f"Bearer {buyer_token}"},
        json={"utr": "444444444444"},
    )
    assert res_4.status_code == 400
    assert "maximum payment submission attempts" in res_4.json()["detail"].lower()


def test_auto_expiry_with_atomic_stock_restore(
    client: TestClient,
    db: Session,
    test_seller: User,
    test_buyer: User,
    test_product_nearby: Product,
):
    """
    Unpaid UPI orders older than 30 minutes with no UTR submitted become 'expired'
    and stock is atomically and idempotently restored.
    """
    test_seller.upi_id = "farmer@oksbi"
    db.commit()

    buyer_token = create_access_token({"user_id": str(test_buyer.id), "role": "buyer"})

    initial_stock = test_product_nearby.stock  # 100
    order_qty = 5.0

    ord_res = client.post(
        "/orders",
        headers={"Authorization": f"Bearer {buyer_token}"},
        json={
            "items": [{"product_id": test_product_nearby.id, "quantity": order_qty}],
            "address": "Anna Nagar, Madurai",
            "payment_method": "upi",
        },
    )
    assert ord_res.status_code == 201
    order_id = ord_res.json()["id"]

    db.refresh(test_product_nearby)
    assert test_product_nearby.stock == initial_stock - order_qty  # 95.0

    # Backdate created_at to 35 minutes ago
    order_obj = db.query(Order).filter(Order.id == order_id).first()
    assert order_obj is not None
    order_obj.created_at = datetime.now(timezone.utc) - timedelta(minutes=35)
    db.commit()

    # Reading the order triggers lazy auto-expire
    get_res = client.get(
        f"/orders/{order_id}",
        headers={"Authorization": f"Bearer {buyer_token}"},
    )
    assert get_res.status_code == 200
    order_data = get_res.json()
    assert order_data["payment_status"] == "expired"
    assert order_data["status"] == "cancelled"

    # Stock must be restored back to initial_stock (100)
    db.refresh(test_product_nearby)
    assert test_product_nearby.stock == initial_stock

    # Reading again must NOT restore stock twice (idempotent)
    client.get(
        f"/orders/{order_id}",
        headers={"Authorization": f"Bearer {buyer_token}"},
    )
    db.refresh(test_product_nearby)
    assert test_product_nearby.stock == initial_stock


def test_cod_flow_remains_unchanged(
    client: TestClient,
    db: Session,
    test_seller: User,
    test_buyer: User,
    test_product_nearby: Product,
):
    """
    Cash On Delivery (COD) orders work as expected:
    - payment_method = 'cod'
    - payment_status = 'pending'
    - status transitions to 'delivered' collects payment -> payment_status = 'collected'.
    """
    buyer_token = create_access_token({"user_id": str(test_buyer.id), "role": "buyer"})
    seller_token = create_access_token({"user_id": str(test_seller.id), "role": "seller"})

    ord_res = client.post(
        "/orders",
        headers={"Authorization": f"Bearer {buyer_token}"},
        json={
            "items": [{"product_id": test_product_nearby.id, "quantity": 2.0}],
            "address": "Anna Nagar, Madurai",
            "payment_method": "cod",
        },
    )
    assert ord_res.status_code == 201
    data = ord_res.json()
    assert data["payment_method"] == "cod"
    assert data["payment_status"] == "pending"
    order_id = data["id"]

    # Seller sequence: placed -> approve (moves to confirmed) -> packed -> shipped -> out_for_delivery -> delivered
    appr_res = client.patch(
        f"/orders/{order_id}/approve",
        headers={"Authorization": f"Bearer {seller_token}"},
        json={"extra_delivery_fee": 0.0},
    )
    assert appr_res.status_code == 200, appr_res.text
    assert appr_res.json()["status"] == "confirmed"

    for next_status in ["packed", "shipped", "out_for_delivery"]:
        status_res = client.patch(
            f"/orders/{order_id}/status",
            headers={"Authorization": f"Bearer {seller_token}"},
            json={"status": next_status},
        )
        assert status_res.status_code == 200, status_res.text

    # Delivered marks COD as 'collected'
    deliv_res = client.patch(
        f"/orders/{order_id}/status",
        headers={"Authorization": f"Bearer {seller_token}"},
        json={"status": "delivered", "delivery_otp": data["delivery_otp"]},
    )
    assert deliv_res.status_code == 200
    assert deliv_res.json()["payment_status"] == "collected"
