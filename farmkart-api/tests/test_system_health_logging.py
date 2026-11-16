import json
import logging
from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from app.core.database import get_db
from app.core.logging import JSONFormatter
from app.core.sentry import scrub_sentry_event, sanitize_string, sanitize_pii
from app.main import app


def test_health_check_healthy(client: TestClient):
    """Test /health returns 200 and healthy status when DB is connected."""
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert data["database"] == "connected"
    assert data["service"] == "FarmKart API"


def test_health_check_database_failure():
    """Test /health returns 503 Service Unavailable when DB connection fails."""
    mock_db = MagicMock()
    mock_db.execute.side_effect = OperationalError("connection refused", {}, Exception("connection refused"))

    app.dependency_overrides[get_db] = lambda: mock_db
    try:
        with TestClient(app) as test_client:
            resp = test_client.get("/health")
            assert resp.status_code == 503
            data = resp.json()
            assert data["status"] == "unhealthy"
            assert data["database"] == "disconnected"
            assert "detail" in data
    finally:
        # Reset dependency override back
        app.dependency_overrides.pop(get_db, None)


def test_request_id_middleware(client: TestClient):
    """Test RequestLoggingMiddleware generates or propagates X-Request-ID."""
    # When no X-Request-ID is provided in request
    resp1 = client.get("/health")
    assert resp1.status_code == 200
    req_id1 = resp1.headers.get("X-Request-ID")
    assert req_id1 is not None and len(req_id1) > 0

    # When custom X-Request-ID is passed in request
    custom_id = "test-custom-request-id-12345"
    resp2 = client.get("/health", headers={"X-Request-ID": custom_id})
    assert resp2.status_code == 200
    assert resp2.headers.get("X-Request-ID") == custom_id


def test_json_formatter_production():
    """Test JSONFormatter serializes log records to valid JSON with required fields."""
    formatter = JSONFormatter()
    record = logging.LogRecord(
        name="test_logger",
        level=logging.INFO,
        pathname="test.py",
        lineno=10,
        msg="Test message",
        args=(),
        exc_info=None,
    )
    record.request_id = "req-123"
    record.method = "POST"
    record.path = "/orders"
    record.status_code = 201
    record.duration_ms = 45.67

    formatted = formatter.format(record)
    parsed = json.loads(formatted)

    assert parsed["level"] == "INFO"
    assert parsed["logger"] == "test_logger"
    assert parsed["message"] == "Test message"
    assert parsed["request_id"] == "req-123"
    assert parsed["method"] == "POST"
    assert parsed["path"] == "/orders"
    assert parsed["status_code"] == 201
    assert parsed["duration_ms"] == 45.67
    assert "timestamp" in parsed


def test_sentry_pii_scrubber():
    """Test Sentry scrubber redacts mobile numbers and auth tokens."""
    jwt_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.do_not_leak_this_signature"
    mobile_num = "9876543210"

    # Test raw string sanitizer
    raw_text = f"User with mobile {mobile_num} failed auth with token {jwt_token} and Bearer secret_bearer_token"
    sanitized_text = sanitize_string(raw_text)
    assert mobile_num not in sanitized_text
    assert jwt_token not in sanitized_text
    assert "[REDACTED_PHONE]" in sanitized_text
    assert "[REDACTED_TOKEN]" in sanitized_text

    # Test recursive dictionary sanitization
    raw_dict = {
        "user_mobile": mobile_num,
        "token": jwt_token,
        "nested": {
            "phone_number": "9123456789",
            "access_token": "secret_abc_123",
            "normal_field": "fresh tomatoes",
        },
    }
    sanitized_dict = sanitize_pii(raw_dict)
    assert sanitized_dict["user_mobile"] == "[REDACTED_PHONE]"
    assert sanitized_dict["token"] == "[REDACTED_TOKEN]"
    assert sanitized_dict["nested"]["phone_number"] == "[REDACTED_PHONE]"
    assert sanitized_dict["nested"]["access_token"] == "[REDACTED_TOKEN]"
    assert sanitized_dict["nested"]["normal_field"] == "fresh tomatoes"

    # Test Sentry event scrubber
    event = {
        "message": f"Login attempt failed for {mobile_num}",
        "request": {
            "headers": {
                "Authorization": f"Bearer {jwt_token}",
                "Cookie": "session=abcde12345",
                "X-User-Phone": mobile_num,
            },
            "data": {
                "mobile": mobile_num,
                "otp": "123456",
            },
        },
        "user": {
            "id": 1,
            "mobile": mobile_num,
        },
    }
    scrubbed = scrub_sentry_event(event)
    assert scrubbed is not None

    assert scrubbed["request"]["headers"]["Authorization"] == "[REDACTED_TOKEN]"
    assert scrubbed["request"]["headers"]["Cookie"] == "[REDACTED_TOKEN]"
    assert scrubbed["request"]["headers"]["X-User-Phone"] == "[REDACTED_PHONE]"
    assert scrubbed["request"]["data"]["mobile"] == "[REDACTED_PHONE]"
    assert scrubbed["request"]["data"]["otp"] == "[REDACTED_TOKEN]"
    assert scrubbed["user"]["mobile"] == "[REDACTED_PHONE]"
    assert mobile_num not in scrubbed["message"]
    assert "[REDACTED_PHONE]" in scrubbed["message"]
