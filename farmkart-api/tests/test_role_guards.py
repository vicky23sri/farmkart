from fastapi.testclient import TestClient
from app.models.product import Product


def test_unauthenticated_request_fails(client: TestClient):
    """Endpoints requiring authentication must return 401 Unauthorized if no token is provided."""
    resp = client.post("/orders", json={"items": [], "address": "Test Address", "payment_method": "cod"})
    assert resp.status_code == 401


def test_buyer_cannot_create_product(buyer_client: TestClient):
    """Buyer role must be forbidden from seller endpoints like POST /products."""
    resp = buyer_client.post(
        "/products",
        json={
            "name": "Tomatoes",
            "category": "vegetables",
            "price": 30,
            "unit": "kg",
            "stock": 50,
            "min_order": 1,
            "is_organic": True,
            "delivery_radius_km": 50,
        },
    )
    assert resp.status_code == 403
    assert "Seller role required" in resp.json()["detail"]


def test_seller_cannot_create_order(seller_client: TestClient, test_product_nearby: Product):
    """Seller role must be forbidden from buyer endpoints like POST /orders."""
    resp = seller_client.post(
        "/orders",
        json={
            "items": [{"product_id": test_product_nearby.id, "quantity": 2}],
            "address": "123 Farmer Lane",
            "payment_method": "cod",
        },
    )
    assert resp.status_code == 403
    assert "Buyer role required" in resp.json()["detail"]
