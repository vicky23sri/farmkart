from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models.product import Product
from app.models.user import User
from app.models.review import Review
from app.models.order import Order


def test_products_pagination(client: TestClient, db: Session, test_seller: User):
    """Test limit/offset pagination on GET /products."""
    # Create 25 products
    for i in range(25):
        p = Product(
            seller_id=test_seller.id,
            name=f"Organic Crop {i}",
            name_tamil=f"பயிர் {i}",
            category="vegetables",
            price=20.0 + i,
            unit="kg",
            stock=100,
            min_order=1,
            is_organic=True,
            lat=10.0528,
            lng=77.9625,
            delivery_radius_km=50,
            is_active=True,
        )
        db.add(p)
    db.commit()

    # Default limit=20, offset=0
    resp = client.get("/products?limit=20&offset=0")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data
    assert "limit" in data
    assert "offset" in data
    assert data["limit"] == 20
    assert data["offset"] == 0
    assert data["total"] >= 25
    assert len(data["items"]) == 20

    # Second page offset=20
    resp_page2 = client.get("/products?limit=20&offset=20")
    assert resp_page2.status_code == 200
    data2 = resp_page2.json()
    assert data2["offset"] == 20
    assert len(data2["items"]) >= 5


def test_products_mine_pagination(seller_client: TestClient, db: Session, test_seller: User):
    """Test limit/offset pagination on GET /products/mine."""
    resp = seller_client.get("/products/mine?limit=10&offset=0")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data
    assert data["limit"] == 10
    assert data["offset"] == 0


def test_orders_mine_pagination(buyer_client: TestClient):
    """Test limit/offset pagination on GET /orders/mine."""
    resp = buyer_client.get("/orders/mine?limit=15&offset=0")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data
    assert data["limit"] == 15
    assert data["offset"] == 0


def test_reviews_pagination(
    client: TestClient,
    db: Session,
    test_seller: User,
    test_buyer: User,
    test_product_nearby: Product,
):
    """Test limit/offset pagination on GET /reviews/product/{id} and /reviews/seller/{id}."""
    order = Order(
        buyer_id=test_buyer.id,
        seller_id=test_seller.id,
        items=[{"product_id": test_product_nearby.id, "quantity": 1, "name": "Tomatoes", "price": 40}],
        subtotal=40,
        total=40,
        status="delivered",
        address="Madurai",
        payment_method="cod",
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    # Insert a review
    review = Review(
        order_id=order.id,
        product_id=test_product_nearby.id,
        buyer_id=test_buyer.id,
        seller_id=test_seller.id,
        product_rating=5,
        farmer_rating=5,
        delivery_rating=5,
        text="Exceptional freshness and sweet flavor!",
    )
    db.add(review)
    db.commit()

    # Product reviews pagination
    resp_prod = client.get(f"/reviews/product/{test_product_nearby.id}?limit=10&offset=0")
    assert resp_prod.status_code == 200
    data_prod = resp_prod.json()
    assert "items" in data_prod
    assert "total" in data_prod
    assert data_prod["limit"] == 10
    assert data_prod["offset"] == 0
    assert len(data_prod["items"]) >= 1

    # Seller reviews pagination
    resp_seller = client.get(f"/reviews/seller/{test_seller.id}?limit=10&offset=0")
    assert resp_seller.status_code == 200
    data_seller = resp_seller.json()
    assert "items" in data_seller
    assert "total" in data_seller
    assert data_seller["limit"] == 10
    assert data_seller["offset"] == 0
    assert len(data_seller["items"]) >= 1
