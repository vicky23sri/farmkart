import random
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from app.models.otp import OTP


def generate_otp_code() -> str:
    """Generate a random 6-digit OTP string."""
    return f"{random.randint(100000, 999999)}"


def create_and_send_otp(db: Session, mobile: str) -> str:
    """
    Generate a 6-digit OTP with a 5-minute expiry, save to database,
    and print to console (no SMS gateway yet).
    """
    otp_code = generate_otp_code()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)

    otp_record = OTP(
        mobile=mobile.strip(),
        otp_code=otp_code,
        expires_at=expires_at,
        is_used=False,
    )
    db.add(otp_record)
    db.commit()
    db.refresh(otp_record)

    # Print to console for development testing
    print("\n" + "=" * 50)
    print(f"🌾 FARMKART AUTH OTP FOR MOBILE: {mobile}")
    print(f"👉 YOUR OTP CODE IS: {otp_code}")
    print("⏰ Valid for 5 minutes")
    print("=" * 50 + "\n")

    return otp_code


def verify_otp_code(db: Session, mobile: str, otp_code: str) -> bool:
    """
    Check if the provided OTP is valid, unused, and not expired.
    If valid, marks it as used.
    """
    now = datetime.now(timezone.utc)
    record = (
        db.query(OTP)
        .filter(
            OTP.mobile == mobile.strip(),
            OTP.otp_code == otp_code.strip(),
            OTP.is_used == False,
            OTP.expires_at >= now,
        )
        .order_by(OTP.id.desc())
        .first()
    )

    if not record:
        return False

    record.is_used = True
    db.commit()
    return True
