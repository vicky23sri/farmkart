import concurrent.futures
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.main import app
from app.core.database import get_db
from app.models.product import Product
from app.models.user import User
from tests.conftest import TestingSessionLocal


def test_concurrency_two_simultaneous_orders_cannot_oversell(
    db: Session,
    test_buyer: User,
    buyer_token: str,
    test_product_limited_stock: Product,
):
    """
    Concurrency test:
    Product has exactly stock = 5.
    Two simultaneous transactions attempt to order quantity = 5 at the exact same moment.
    Using SELECT ... FOR UPDATE row-level locking:
    - One transaction must acquire the lock, see stock=5, reduce stock to 0, and succeed (201).
    - The other transaction waits for the lock, then sees stock=0 < 5, and must fail with 409 Conflict.
    - Final stock in database must be exactly 0, never negative.
    """
    product_id = test_product_limited_stock.id
    order_qty = 5  # Exactly equal to available stock

    def place_order_worker():
        with TestClient(app) as local_client:
            local_client.headers.update({"Authorization": f"Bearer {buyer_token}"})
            resp = local_client.post(
                "/orders",
                json={
                    "items": [{"product_id": product_id, "quantity": order_qty}],
                    "address": "Race Course Road, Madurai",
                    "lat": 10.0528,
                    "lng": 77.9625,
                    "payment_method": "cod",
                },
            )
            return resp.status_code, resp.json()

    # Execute both order requests concurrently
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(place_order_worker)
        f2 = executor.submit(place_order_worker)
        results = [f1.result(), f2.result()]

    status_codes = [r[0] for r in results]

    # Verify exactly 1 succeeded (201) and 1 failed with Conflict (409)
    assert 201 in status_codes, f"Expected one 201 Created in {status_codes}"
    assert 409 in status_codes, f"Expected one 409 Conflict in {status_codes}"

    conflict_res = [r[1] for r in results if r[0] == 409][0]
    assert "Insufficient stock" in conflict_res["detail"]

    # Verify final stock in database is exactly 0 (not negative)
    db.expire_all()
    updated_product = db.query(Product).filter(Product.id == product_id).one()
    assert updated_product.stock == 0
