from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User

# Standard bearer scheme for Swagger UI
security_bearer = HTTPBearer(auto_error=False)

__all__ = [
    "get_current_user",
    "require_buyer",
    "require_seller",
    "get_current_user_optional",
]


def _resolve_user(token: str, db: Session) -> Optional[User]:
    payload = decode_access_token(token)
    if not payload:
        return None
    try:
        user_id = int(payload.get("user_id"))
    except (TypeError, ValueError):
        return None
    user = db.get(User, user_id)
    if not user or user.deleted_at is not None:
        return None
    return user


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    db: Session = Depends(get_db),
) -> User:
    """Extract and authenticate the user from JWT Bearer token."""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token is missing. Please log in.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = _resolve_user(credentials.credentials, db)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def require_buyer(current_user: User = Depends(get_current_user)) -> User:
    """Dependency that enforces the user has the 'buyer' role. Returns 403 otherwise."""
    if current_user.role != "buyer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Buyer role required.",
        )
    return current_user


def require_seller(current_user: User = Depends(get_current_user)) -> User:
    """Dependency that enforces the user has the 'seller' role. Returns 403 otherwise."""
    if current_user.role != "seller":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Seller role required.",
        )
    return current_user


def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """Extract user if valid token provided; returns None if guest or missing token."""
    if not credentials:
        return None
    return _resolve_user(credentials.credentials, db)
