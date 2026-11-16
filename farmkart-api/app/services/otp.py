import hashlib
import hmac
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.otp import OTP
from app.services.sms import get_sms_provider

MOBILE_REGEX = re.compile(r"^[6-9]\d{9}$")


def validate_indian_mobile(mobile: str) -> bool:
    """Validate that the mobile number is a 10-digit Indian number."""
    if not mobile:
        return False
    return bool(MOBILE_REGEX.match(mobile.strip()))


def generate_otp_code() -> str:
    """
    Generate a cryptographically secure 6-digit OTP using the secrets module.
    Produces values from 100000 to 999999 inclusive.
    """
    return f"{secrets.randbelow(900000) + 100000}"


def hash_otp(mobile: str, otp_code: str) -> str:
    """
    Generate an HMAC-SHA256 hash of the OTP code, keyed with JWT_SECRET
    and salted with the recipient's mobile number.
    """
    key = settings.JWT_SECRET.encode("utf-8")
    msg = f"{mobile.strip()}:{otp_code.strip()}".encode("utf-8")
    return hmac.new(key, msg, hashlib.sha256).hexdigest()


def verify_otp_hash(mobile: str, otp_code: str, hashed_otp: str) -> bool:
    """Safely verify OTP against stored hash in constant time."""
    expected_hash = hash_otp(mobile, otp_code)
    return hmac.compare_digest(expected_hash, hashed_otp)


def check_rate_limits(
    db: Session, mobile: str, ip_address: Optional[str]
) -> Tuple[bool, Optional[str]]:
    """
    Check rate limits for sending OTP:
    - Max 3 requests per mobile per 10 minutes
    - Max 10 requests per IP per hour
    """
    now = datetime.now(timezone.utc)
    ten_minutes_ago = now - timedelta(minutes=10)
    one_hour_ago = now - timedelta(hours=1)

    clean_mobile = mobile.strip()

    # 1. Check mobile rate limit (max 3 per 10 minutes)
    mobile_count = (
        db.query(OTP)
        .filter(OTP.mobile == clean_mobile, OTP.created_at >= ten_minutes_ago)
        .count()
    )
    if mobile_count >= 3:
        return (
            False,
            "Too many OTP requests for this mobile number. Please try again after 10 minutes.",
        )

    # 2. Check IP rate limit (max 10 per hour)
    if ip_address and ip_address.strip() not in ("unknown", ""):
        ip_count = (
            db.query(OTP)
            .filter(
                OTP.ip_address == ip_address.strip(),
                OTP.created_at >= one_hour_ago,
            )
            .count()
        )
        if ip_count >= 10:
            return (
                False,
                "Too many OTP requests from this IP address. Please try again after 1 hour.",
            )

    return True, None


def create_and_send_otp(
    db: Session, mobile: str, ip_address: Optional[str] = None
) -> Tuple[bool, str]:
    """
    Generate secure 6-digit OTP, store only the hash with 5-minute expiry,
    and dispatch via the configured SMS provider.
    Returns (success, otp_code).
    """
    clean_mobile = mobile.strip()
    otp_code = generate_otp_code()
    otp_hash = hash_otp(clean_mobile, otp_code)
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=5)

    # Invalidate previous unused OTPs for this mobile
    db.query(OTP).filter(OTP.mobile == clean_mobile, OTP.is_used == False).update(
        {"is_used": True}
    )

    otp_record = OTP(
        mobile=clean_mobile,
        otp_hash=otp_hash,
        expires_at=expires_at,
        is_used=False,
        failed_attempts=0,
        ip_address=ip_address.strip() if ip_address else None,
        created_at=now,
    )
    db.add(otp_record)
    db.commit()
    db.refresh(otp_record)

    # Dispatch via SMS provider
    sms_provider = get_sms_provider()
    success = sms_provider.send_otp(clean_mobile, otp_code)
    return success, otp_code


def verify_otp_code(db: Session, mobile: str, otp_code: str) -> Tuple[bool, str]:
    """
    Verify OTP with maximum of 5 wrong attempts before invalidation:
    Returns (is_valid, error_message).
    """
    clean_mobile = mobile.strip()
    clean_otp = otp_code.strip()
    now = datetime.now(timezone.utc)

    record = (
        db.query(OTP)
        .filter(
            OTP.mobile == clean_mobile,
            OTP.is_used == False,
            OTP.expires_at >= now,
        )
        .order_by(OTP.id.desc())
        .first()
    )

    if not record:
        return False, "Invalid or expired OTP code. Please request a new one."

    # Check if already reached max attempts
    if record.failed_attempts >= 5:
        record.is_used = True
        db.commit()
        return (
            False,
            "Too many incorrect attempts. This OTP has been invalidated. Please request a new one.",
        )

    if not verify_otp_hash(clean_mobile, clean_otp, record.otp_hash):
        record.failed_attempts += 1
        if record.failed_attempts >= 5:
            record.is_used = True
            db.commit()
            return (
                False,
                "Too many incorrect attempts. This OTP has been invalidated. Please request a new one.",
            )
        db.commit()
        remaining = 5 - record.failed_attempts
        return (
            False,
            f"Invalid OTP code. {remaining} attempt{'s' if remaining != 1 else ''} remaining.",
        )

    # Mark as used upon successful verification
    record.is_used = True
    db.commit()
    return True, ""
