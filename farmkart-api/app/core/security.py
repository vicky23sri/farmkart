from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt

from app.core.config import settings

ALGORITHM = "HS256"

# bcrypt only uses the first 72 bytes of a password; longer inputs are rejected at the schema level.
BCRYPT_MAX_BYTES = 72


def hash_password(password: str) -> str:
    """Hash plain text password with bcrypt."""
    return bcrypt.hashpw(password.encode("utf-8")[:BCRYPT_MAX_BYTES], bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: Optional[str]) -> bool:
    """Verify plain password against bcrypt hash."""
    if not hashed_password:
        return False
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8")[:BCRYPT_MAX_BYTES], hashed_password.encode("utf-8")
        )
    except (ValueError, TypeError):
        return False


# A real bcrypt hash used to equalise response time when the user does not exist.
_DUMMY_HASH = bcrypt.hashpw(b"farmkart-timing-equaliser", bcrypt.gensalt()).decode("utf-8")


def burn_password_check() -> None:
    """Spend the same time as a real password check (mitigates user enumeration via timing)."""
    verify_password("invalid-password", _DUMMY_HASH)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a signed JWT access token containing claims."""
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(minutes=settings.JWT_EXPIRE_MINUTES))
    to_encode = {**data, "iat": now, "exp": expire}
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    """Decode and verify a JWT access token. Returns None when invalid or expired."""
    try:
        return jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[ALGORITHM],
            options={"require": ["exp", "user_id"]},
        )
    except jwt.PyJWTError:
        return None
