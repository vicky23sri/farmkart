import os
import pytest
from datetime import datetime, timezone, timedelta
from typing import Generator
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session

# Set test environment (must happen before the app settings are imported)
os.environ["ENV"] = "test"
os.environ["JWT_SECRET"] = os.getenv("JWT_SECRET", "farmkart_super_secret_jwt_key_2026_xyz123")
os.environ.setdefault("GOOGLE_CLIENT_IDS", "test-google-client-id.apps.googleusercontent.com")

from app.core.config import settings  # noqa: E402

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL") or settings.DATABASE_URL.replace(
    f"/{settings.DB_NAME}?", "/farmkart_test?"
)
if TEST_DATABASE_URL.startswith("postgresql://"):
    TEST_DATABASE_URL = TEST_DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)

test_engine = create_engine(TEST_DATABASE_URL, pool_pre_ping=True)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

import app.core.database as database_module  # noqa: E402
from app.core.database import Base, get_db
from app.core.security import create_access_token
from app.main import app
from app.models.user import User
from app.models.product import Product
from app.models.order import Order
from app.models.review import Review
from app.models.otp import OTP
from app.models.payout import Payout
from app.models.device_token import DeviceToken
from app.models.notification import Notification


def override_get_db():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    """Create all tables in the test database once per test session."""
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    app.dependency_overrides[get_db] = override_get_db
    # Background tasks open their own sessions; point them at the test database too
    database_module.SessionLocal = TestingSessionLocal
    yield
    Base.metadata.drop_all(bind=test_engine)
    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def clean_tables_after_test():
    """Ensure database tables are cleaned up (and rate limits reset) after each test."""
    from app.core.rate_limit import limiter

    limiter.reset()
    yield
    with test_engine.connect() as conn:
        conn.execute(
            text(
                "TRUNCATE TABLE notifications, device_tokens, reviews, order_status_history, orders, products, otps, payouts, users RESTART IDENTITY CASCADE;"
            )
        )
        conn.commit()


@pytest.fixture
def db() -> Generator[Session, None, None]:
    """Provide a database session for test assertions and fixture setups."""
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    """Provide an unauthenticated TestClient."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def test_seller(db: Session) -> User:
    """Create a verified seller fixture located in Madurai."""
    seller = User(
        mobile="9842156780",
        name="Vadipatti Organic Farmer",
        role="seller",
        lat=10.0528,
        lng=77.9625,
        address="Vadipatti, Madurai",
    )
    db.add(seller)
    db.commit()
    db.refresh(seller)
    return seller


@pytest.fixture
def seller_token(test_seller: User) -> str:
    """JWT for test_seller."""
    return create_access_token({"user_id": str(test_seller.id), "role": "seller"})


@pytest.fixture
def seller_client(seller_token: str) -> Generator[TestClient, None, None]:
    """TestClient pre-authenticated as seller."""
    with TestClient(app) as test_client:
        test_client.headers["Authorization"] = f"Bearer {seller_token}"
        yield test_client


@pytest.fixture
def test_buyer(db: Session) -> User:
    """Create a buyer fixture located in Madurai."""
    buyer = User(
        mobile="9876543210",
        name="Karthik Buyer",
        role="buyer",
        lat=10.0528,
        lng=77.9625,
        address="Anna Nagar, Madurai",
    )
    db.add(buyer)
    db.commit()
    db.refresh(buyer)
    return buyer


@pytest.fixture
def buyer_token(test_buyer: User) -> str:
    """JWT for test_buyer."""
    return create_access_token({"user_id": str(test_buyer.id), "role": "buyer"})


@pytest.fixture
def buyer_client(buyer_token: str) -> Generator[TestClient, None, None]:
    """TestClient pre-authenticated as buyer."""
    with TestClient(app) as test_client:
        test_client.headers["Authorization"] = f"Bearer {buyer_token}"
        yield test_client


@pytest.fixture
def test_product_nearby(db: Session, test_seller: User) -> Product:
    """Product located at 0 km from buyer (well within 50 km)."""
    product = Product(
        seller_id=test_seller.id,
        name="Fresh Country Tomatoes",
        name_tamil="நாட்டு தக்காளி",
        category="vegetables",
        price=40.0,
        unit="kg",
        stock=100,
        min_order=1,
        is_organic=True,
        lat=10.0528,
        lng=77.9625,
        delivery_radius_km=50.0,
        is_active=True,
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@pytest.fixture
def test_product_far(db: Session, test_seller: User) -> Product:
    """Product located ~120 km away from buyer (beyond 50 km)."""
    product = Product(
        seller_id=test_seller.id,
        name="Salem Mangoes",
        name_tamil="சேலம் மாம்பழம்",
        category="fruits",
        price=120.0,
        unit="kg",
        stock=50,
        min_order=1,
        is_organic=True,
        lat=11.6643,
        lng=78.1460,
        delivery_radius_km=50.0,
        is_active=True,
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@pytest.fixture
def test_product_limited_stock(db: Session, test_seller: User) -> Product:
    """Product with exact stock = 5 for overselling tests."""
    product = Product(
        seller_id=test_seller.id,
        name="Rare Organic Honey",
        name_tamil="மலைத்தேன்",
        category="spices",
        price=250.0,
        unit="kg",
        stock=5,
        min_order=1,
        is_organic=True,
        lat=10.0528,
        lng=77.9625,
        delivery_radius_km=50.0,
        is_active=True,
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return product
