from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional
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

    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token payload is missing user ID.",
        )

    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found in system.",
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
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        return None
    user_id = payload.get("user_id")
    if not user_id:
        return None
    return db.query(User).filter(User.id == int(user_id)).first()
