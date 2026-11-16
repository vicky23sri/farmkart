from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models.otp import OTP
from app.services.otp import hash_otp


def test_send_otp_success(client: TestClient):
    """Test sending OTP to a valid Indian mobile number."""
    resp = client.post("/auth/send-otp", json={"mobile": "9876543210"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["mobile"] == "9876543210"
    assert "OTP sent successfully" in data["message"]


def test_send_otp_invalid_mobile(client: TestClient):
    """Test mobile validation (must be 10 digits starting with 6-9)."""
    # Too short
    resp = client.post("/auth/send-otp", json={"mobile": "12345"})
    assert resp.status_code in [400, 422]

    # Starts with 5
    resp2 = client.post("/auth/send-otp", json={"mobile": "5123456789"})
    assert resp2.status_code in [400, 422]


def test_send_otp_rate_limit(client: TestClient):
    """Test rate limit: max 3 per mobile per 10 minutes."""
    mobile = "9876500001"
    for i in range(3):
        r = client.post("/auth/send-otp", json={"mobile": mobile})
        assert r.status_code == 200

    # 4th request must fail with 429
    r_fourth = client.post("/auth/send-otp", json={"mobile": mobile})
    assert r_fourth.status_code == 429
    assert "too many otp requests" in r_fourth.json()["detail"].lower()


def test_verify_otp_success(client: TestClient, db: Session):
    """Test successful verification creates user if new and returns JWT token."""
    mobile = "9876511111"
    code = "654321"
    now = datetime.now(timezone.utc)
    record = OTP(
        mobile=mobile,
        otp_hash=hash_otp(mobile, code),
        expires_at=now + timedelta(minutes=5),
        is_used=False,
        failed_attempts=0,
        created_at=now,
    )
    db.add(record)
    db.commit()

    resp = client.post("/auth/verify-otp", json={"mobile": mobile, "otp": code})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["is_new_user"] is True


def test_verify_otp_wrong_code(client: TestClient, db: Session):
    """Test wrong OTP code returns 400 with attempts left."""
    mobile = "9876522222"
    code = "112233"
    now = datetime.now(timezone.utc)
    record = OTP(
        mobile=mobile,
        otp_hash=hash_otp(mobile, code),
        expires_at=now + timedelta(minutes=5),
        is_used=False,
        failed_attempts=0,
        created_at=now,
    )
    db.add(record)
    db.commit()

    resp = client.post("/auth/verify-otp", json={"mobile": mobile, "otp": "999999"})
    assert resp.status_code == 400
    assert "Invalid OTP code" in resp.json()["detail"]
    assert "attempts remaining" in resp.json()["detail"]


def test_verify_otp_max_wrong_attempts_invalidates(client: TestClient, db: Session):
    """Test that 5 wrong attempts invalidates the OTP."""
    mobile = "9876533333"
    code = "123456"
    now = datetime.now(timezone.utc)
    record = OTP(
        mobile=mobile,
        otp_hash=hash_otp(mobile, code),
        expires_at=now + timedelta(minutes=5),
        is_used=False,
        failed_attempts=0,
        created_at=now,
    )
    db.add(record)
    db.commit()

    # Make 5 wrong attempts
    for _ in range(5):
        resp = client.post("/auth/verify-otp", json={"mobile": mobile, "otp": "000000"})
        assert resp.status_code == 400

    # 6th attempt should state max attempts exceeded or invalidated
    resp6 = client.post("/auth/verify-otp", json={"mobile": mobile, "otp": code})
    assert resp6.status_code == 400
    assert "exceeded maximum verification attempts" in resp6.json()["detail"] or "invalid" in resp6.json()["detail"].lower()


def test_verify_otp_expired(client: TestClient, db: Session):
    """Test expired OTP returns 400."""
    mobile = "9876544444"
    code = "123456"
    now = datetime.now(timezone.utc)
    # Set expires_at in the past
    record = OTP(
        mobile=mobile,
        otp_hash=hash_otp(mobile, code),
        expires_at=now - timedelta(minutes=1),
        is_used=False,
        failed_attempts=0,
        created_at=now - timedelta(minutes=6),
    )
    db.add(record)
    db.commit()

    resp = client.post("/auth/verify-otp", json={"mobile": mobile, "otp": code})
    assert resp.status_code == 400
    assert "expired" in resp.json()["detail"].lower()


def test_verify_otp_reused(client: TestClient, db: Session):
    """Test that an OTP cannot be verified twice."""
    mobile = "9876555555"
    code = "123456"
    now = datetime.now(timezone.utc)
    record = OTP(
        mobile=mobile,
        otp_hash=hash_otp(mobile, code),
        expires_at=now + timedelta(minutes=5),
        is_used=False,
        failed_attempts=0,
        created_at=now,
    )
    db.add(record)
    db.commit()

    # First verify succeeds
    resp1 = client.post("/auth/verify-otp", json={"mobile": mobile, "otp": code})
    assert resp1.status_code == 200

    # Second verify with same code must fail
    resp2 = client.post("/auth/verify-otp", json={"mobile": mobile, "otp": code})
    assert resp2.status_code == 400
    assert "expired" in resp2.json()["detail"].lower() or "invalid" in resp2.json()["detail"].lower()
