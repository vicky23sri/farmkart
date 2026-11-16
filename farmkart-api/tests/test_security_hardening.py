"""Regression tests for the production-hardening fixes."""

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.security import create_access_token, hash_password
from app.models.order import Order
from app.models.product import Product
from app.models.user import User

GOOGLE_CLIENT_ID = "test-google-client-id.apps.googleusercontent.com"


def _tokeninfo_response(status_code=200, **payload):
    resp = MagicMock()
    resp.status_code = status_code
    resp.json.return_value = payload
    return resp


def _patch_google(response):
    client = MagicMock()
    client.__enter__.return_value = client
    client.get.return_value = response
    return patch("app.services.google_auth.httpx.Client", return_value=client)


# ---------------------------------------------------------------- authentication


def test_mock_tokens_are_rejected(client: TestClient, test_seller: User):
    for token in ("mock-quick-seller-token", "mock-quick-buyer-token"):
        resp = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 401


def test_google_auth_rejects_client_supplied_email_without_token(client: TestClient, db: Session):
    victim = User(email="victim@example.com", name="Victim", role="buyer", hashed_password=hash_password("x" * 10))
    db.add(victim)
    db.commit()

    resp = client.post("/auth/google", json={"email": "victim@example.com", "name": "Attacker"})
    assert resp.status_code == 401


def test_google_auth_rejects_token_for_other_app(client: TestClient):
    response = _tokeninfo_response(
        aud="someone-elses-app.apps.googleusercontent.com",
        email="user@example.com",
        email_verified="true",
        sub="123",
        exp="9999999999",
        iss="accounts.google.com",
    )
    with _patch_google(response):
        resp = client.post("/auth/google", json={"id_token": "fake"})
    assert resp.status_code == 401
    assert "not issued for this application" in resp.json()["detail"]


def test_google_auth_rejects_unverified_email(client: TestClient):
    response = _tokeninfo_response(
        aud=GOOGLE_CLIENT_ID, email="user@example.com", email_verified="false",
        sub="123", exp="9999999999", iss="accounts.google.com",
    )
    with _patch_google(response):
        resp = client.post("/auth/google", json={"id_token": "fake"})
    assert resp.status_code == 401


def test_google_auth_accepts_verified_token(client: TestClient, db: Session):
    response = _tokeninfo_response(
        aud=GOOGLE_CLIENT_ID, email="New.User@Example.com", email_verified="true",
        sub="abc", exp="9999999999", name="New User",
    )
    with _patch_google(response):
        resp = client.post("/auth/google", json={"access_token": "ya29.fake", "role": "buyer"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["is_new_user"] is True
    user = db.query(User).filter(User.id == body["user_id"]).one()
    assert user.email == "new.user@example.com"


def test_login_is_rate_limited_per_account(client: TestClient, db: Session):
    db.add(User(email="locked@example.com", name="L", role="buyer", hashed_password=hash_password("right-password")))
    db.commit()
    codes = [
        client.post("/auth/login", json={"email_or_mobile": "locked@example.com", "password": "wrong"}).status_code
        for _ in range(11)
    ]
    assert codes[:10] == [400] * 10
    assert codes[10] == 429


def test_register_requires_valid_email_and_strong_password(client: TestClient):
    bad_email = client.post("/auth/register", json={"name": "Ab", "email": "not-an-email", "password": "longenough1"})
    assert bad_email.status_code == 422
    short_pw = client.post("/auth/register", json={"name": "Ab", "email": "a@example.com", "password": "short"})
    assert short_pw.status_code == 422


def test_deleted_account_cannot_log_in(client: TestClient, db: Session):
    user = User(email="gone@example.com", name="Gone", role="buyer", hashed_password=hash_password("password123"))
    db.add(user)
    db.commit()
    token = create_access_token({"user_id": str(user.id), "role": "buyer"})
    assert client.delete("/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 200

    resp = client.post("/auth/login", json={"email_or_mobile": "gone@example.com", "password": "password123"})
    assert resp.status_code == 400


# ---------------------------------------------------------------- configuration


def test_production_config_requires_sms_and_storage():
    with pytest.raises(ValueError):
        Settings(
            ENV="production", DB_USER="u", DB_PASSWORD="p", JWT_SECRET="x" * 40,
            MSG91_AUTH_KEY="", S3_BUCKET="",
        )


def test_production_config_rejects_wildcard_cors():
    with pytest.raises(ValueError):
        Settings(
            ENV="production", DB_USER="u", DB_PASSWORD="p", JWT_SECRET="x" * 40,
            MSG91_AUTH_KEY="k", MSG91_TEMPLATE_ID="t", S3_BUCKET="b", CORS_ORIGINS="*",
        )


def test_short_jwt_secret_rejected():
    with pytest.raises(ValueError):
        Settings(DB_USER="u", DB_PASSWORD="p", JWT_SECRET="short", ENV="development")


# ---------------------------------------------------------------- orders & products


def test_seller_cannot_see_delivery_otp_in_tracking(
    buyer_client: TestClient, seller_client: TestClient, test_product_nearby: Product
):
    order = buyer_client.post(
        "/orders",
        json={"items": [{"product_id": test_product_nearby.id, "quantity": 1}], "address": "Anna Nagar, Madurai"},
    ).json()
    buyer_track = buyer_client.get(f"/orders/{order['id']}/track").json()
    seller_track = seller_client.get(f"/orders/{order['id']}/track").json()
    assert buyer_track["delivery_otp"] == order["delivery_otp"]
    assert seller_track["delivery_otp"] is None
    seller_view = seller_client.get(f"/orders/{order['id']}").json()
    assert seller_view["delivery_otp"] is None
    assert seller_view["buyer_name"] == "Karthik Buyer"


def test_min_order_quantity_enforced(buyer_client: TestClient, test_product_nearby: Product, db: Session):
    test_product_nearby.min_order = 5
    db.commit()
    resp = buyer_client.post(
        "/orders",
        json={"items": [{"product_id": test_product_nearby.id, "quantity": 2}], "address": "Anna Nagar, Madurai"},
    )
    assert resp.status_code == 400
    assert "Minimum order" in resp.json()["detail"]


def test_product_update_rejects_invalid_values(seller_client: TestClient, test_product_nearby: Product):
    assert seller_client.put(f"/products/{test_product_nearby.id}", json={"price": -5}).status_code == 422
    assert seller_client.put(f"/products/{test_product_nearby.id}", json={"name": None}).status_code == 422
    assert seller_client.put(f"/products/{test_product_nearby.id}", json={"images": ["javascript:alert(1)"]}).status_code == 422


def test_payout_summary_counts_upi_and_ignores_cancelled(
    seller_client: TestClient, test_seller: User, test_buyer: User, db: Session
):
    base = dict(
        buyer_id=test_buyer.id, seller_id=test_seller.id, items=[], subtotal=100.0,
        total=100.0, address="Madurai", distance_km=1.0,
    )
    db.add_all([
        Order(**base, payment_method="upi", payment_status="paid", status="delivered"),
        Order(**base, payment_method="cod", payment_status="pending", status="cancelled"),
        Order(**base, payment_method="cod", payment_status="pending", status="confirmed"),
    ])
    db.commit()
    summary = seller_client.get("/payouts/summary").json()
    assert summary["online_earnings"] == 100.0
    assert summary["cod_pending"] == 100.0
    assert summary["total_earnings"] == 100.0


def test_deleted_product_hidden_from_buyers(
    buyer_client: TestClient, seller_client: TestClient, test_product_nearby: Product
):
    assert seller_client.delete(f"/products/{test_product_nearby.id}").status_code == 200
    listing = buyer_client.get("/products").json()
    assert all(p["id"] != test_product_nearby.id for p in listing["items"])
    assert buyer_client.get(f"/products/{test_product_nearby.id}").status_code == 404


def test_search_wildcards_are_escaped(buyer_client: TestClient, test_product_nearby: Product):
    resp = buyer_client.get("/products", params={"search": "%"})
    assert resp.status_code == 200
    assert resp.json()["total"] == 0


def test_security_headers_present(client: TestClient):
    resp = client.get("/livez")
    assert resp.headers["X-Content-Type-Options"] == "nosniff"
    assert resp.headers["X-Frame-Options"] == "DENY"


def test_delivery_notes_and_counterparty_details(
    buyer_client: TestClient, seller_client: TestClient, test_product_nearby: Product
):
    order = buyer_client.post(
        "/orders",
        json={
            "items": [{"product_id": test_product_nearby.id, "quantity": 1}],
            "address": "Anna Nagar, Madurai",
            "delivery_notes": "Preferred time: evening. Gate 2.",
        },
    ).json()
    seller_view = seller_client.get(f"/orders/{order['id']}").json()
    assert seller_view["delivery_notes"] == "Preferred time: evening. Gate 2."
    assert seller_view["buyer_mobile"] == "9876543210"
    assert order["seller_name"] == "Vadipatti Organic Farmer"


def test_product_listing_includes_real_rating(
    buyer_client: TestClient, test_product_nearby: Product, test_buyer: User, test_seller: User, db: Session
):
    from app.models.review import Review

    order = Order(
        buyer_id=test_buyer.id, seller_id=test_seller.id, items=[], subtotal=1, total=1,
        address="Madurai", status="delivered", payment_method="cod", payment_status="collected",
    )
    db.add(order)
    db.commit()
    db.add(Review(order_id=order.id, product_id=test_product_nearby.id, buyer_id=test_buyer.id,
                  seller_id=test_seller.id, product_rating=4.0, farmer_rating=5.0, delivery_rating=3.0,
                  photos=[], tags=[]))
    db.commit()
    item = buyer_client.get(f"/products/{test_product_nearby.id}").json()
    assert item["rating"] == 4.0
    assert item["review_count"] == 1


def test_seller_location_backfills_products(seller_client: TestClient, test_seller: User, db: Session):
    p = Product(seller_id=test_seller.id, name="Ragi", category="Grains", price=10, unit="kg", stock=5, images=[])
    db.add(p)
    db.commit()
    resp = seller_client.put("/auth/profile", json={"lat": 10.1, "lng": 77.9, "address": "Farm road"})
    assert resp.status_code == 200
    db.refresh(p)
    assert p.lat == 10.1 and p.lng == 77.9
