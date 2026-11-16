from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import create_access_token, hash_password, verify_password
from app.core.deps import get_current_user
from app.models.user import User
from app.services.otp import (
    validate_indian_mobile,
    check_rate_limits,
    create_and_send_otp,
    verify_otp_code,
)
from datetime import datetime, timezone
from app.core.rate_limit import check_identifier_limit, client_ip, rate_limit
from app.core.security import burn_password_check
from app.services.google_auth import GoogleAuthError, verify_google_token
from app.services.account_deletion import AccountDeletionBlocked, delete_account
from app.services.push import dispatch_order_notification
from app.models.product import Product
from app.schemas.auth import (
    SendOTPRequest,
    SendOTPResponse,
    VerifyOTPRequest,
    RegisterRequest,
    LoginRequest,
    GoogleAuthRequest,
    TokenResponse,
    SetRoleRequest,
    UpdateProfileRequest,
    UserOut,
)
from app.schemas.common import MessageResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/send-otp", response_model=SendOTPResponse)
def send_otp(req: SendOTPRequest, request: Request, db: Session = Depends(get_db)):
    """Generate 6-digit OTP, store hash with 5-min expiry, apply rate limits, and dispatch via SMS provider."""
    mobile = req.mobile.strip()
    if not validate_indian_mobile(mobile):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid mobile number. Please provide a valid 10-digit Indian mobile number starting with 6-9.",
        )

    ip = client_ip(request)
    allowed, rate_error = check_rate_limits(db, mobile, ip)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=rate_error,
        )

    sent, _ = create_and_send_otp(db, mobile, ip_address=ip)
    if not sent:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not send the OTP SMS right now. Please try again shortly.",
        )

    return SendOTPResponse(
        message=f"OTP sent successfully to {mobile}.",
        mobile=mobile,
    )


@router.post(
    "/verify-otp",
    response_model=TokenResponse,
    dependencies=[Depends(rate_limit("verify-otp", 20, 600))],
)
def verify_otp(req: VerifyOTPRequest, db: Session = Depends(get_db)):
    """Verify OTP against stored hash. Create user if new, and return JWT."""
    mobile = req.mobile.strip()
    if not validate_indian_mobile(mobile):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid mobile number. Please provide a valid 10-digit Indian mobile number starting with 6-9.",
        )

    is_valid, error_msg = verify_otp_code(db, mobile, req.otp.strip())
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg,
        )

    # Find or create user
    user = db.query(User).filter(User.mobile == mobile).first()
    is_new = False
    if user and user.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This account has been deleted.")
    if not user:
        user = User(mobile=mobile, role=None)
        db.add(user)
        db.commit()
        db.refresh(user)
        is_new = True

    # Generate access token with user_id and role
    token = create_access_token({"user_id": str(user.id), "role": user.role})
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user_id=user.id,
        role=user.role,
        is_new_user=is_new,
    )


@router.post(
    "/register",
    response_model=TokenResponse,
    dependencies=[Depends(rate_limit("register", 10, 3600))],
)
def register_user(req: RegisterRequest, db: Session = Depends(get_db)):
    """Register a new user account with name, email, password, and optional mobile/role."""
    clean_email = str(req.email).strip().lower()

    # Check if email is already registered
    existing_user = db.query(User).filter(User.email == clean_email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists. Please login instead.",
        )

    clean_mobile = req.mobile.strip() if req.mobile else None
    if clean_mobile:
        if not validate_indian_mobile(clean_mobile):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid mobile number. Must be a 10-digit Indian number starting with 6-9.",
            )
        existing_mobile = db.query(User).filter(User.mobile == clean_mobile).first()
        if existing_mobile:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this mobile number already exists.",
            )

    # Hash password and create user
    hashed = hash_password(req.password)
    user = User(
        name=req.name.strip(),
        email=clean_email,
        hashed_password=hashed,
        mobile=clean_mobile,
        role=req.role,
        auth_provider="local",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"user_id": str(user.id), "role": user.role})
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user_id=user.id,
        role=user.role,
        is_new_user=True,
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    dependencies=[Depends(rate_limit("login", 20, 600))],
)
def login_user(req: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate user with email or mobile number and password."""
    identifier = req.email_or_mobile.strip().lower()
    check_identifier_limit("login-id", identifier, 10, 900)

    # Search by email or mobile
    user = (
        db.query(User)
        .filter((User.email == identifier) | (User.mobile == identifier))
        .first()
    )

    if not user or not user.hashed_password or user.deleted_at is not None:
        burn_password_check()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email/mobile or password.",
        )

    if not verify_password(req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email/mobile or password.",
        )

    token = create_access_token({"user_id": str(user.id), "role": user.role})
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user_id=user.id,
        role=user.role,
        is_new_user=False,
    )


@router.post(
    "/google",
    response_model=TokenResponse,
    dependencies=[Depends(rate_limit("google", 20, 600))],
)
def google_auth(req: GoogleAuthRequest, db: Session = Depends(get_db)):
    """
    Authenticate or register a user via Google Sign-In.
    The Google token is verified server-side; client-supplied email addresses are never trusted.
    """
    try:
        identity = verify_google_token(req.id_token, req.access_token)
    except GoogleAuthError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc))

    name = identity.name or (req.name.strip() if req.name else None)
    avatar_url = identity.picture or req.avatar_url

    user = db.query(User).filter(User.email == identity.email).first()
    is_new = False

    if user and user.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This account has been deleted.")

    if not user:
        user = User(
            email=identity.email,
            name=name[:100] if name else None,
            avatar_url=avatar_url,
            auth_provider="google",
            role=req.role,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        is_new = True
    else:
        changed = False
        if not user.name and name:
            user.name = name[:100]
            changed = True
        if not user.avatar_url and avatar_url:
            user.avatar_url = avatar_url
            changed = True
        if changed:
            db.commit()

    token = create_access_token({"user_id": str(user.id), "role": user.role})
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user_id=user.id,
        role=user.role,
        is_new_user=is_new,
    )


@router.post("/set-role", response_model=UserOut)
def set_role(
    req: SetRoleRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Set role to 'buyer' or 'seller'. Requires JWT authentication."""
    current_user.role = req.role
    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/me", response_model=UserOut)
def get_my_profile(current_user: User = Depends(get_current_user)):
    """Get current logged-in user profile."""
    return current_user


@router.put("/profile", response_model=UserOut)
def update_profile(
    req: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update profile information (name, address, coordinates)."""
    if req.name is not None:
        current_user.name = req.name
    if req.address is not None:
        current_user.address = req.address
    if req.lat is not None:
        current_user.lat = req.lat
    if req.lng is not None:
        current_user.lng = req.lng
    if req.upi_id is not None:
        if current_user.role != "seller":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only sellers can configure a UPI ID.",
            )
        current_user.upi_id = req.upi_id

    # A seller setting their farm location backfills listings that have no coordinates yet
    if current_user.role == "seller" and req.lat is not None and req.lng is not None:
        db.query(Product).filter(
            Product.seller_id == current_user.id,
            Product.lat.is_(None),
        ).update({"lat": req.lat, "lng": req.lng}, synchronize_session=False)

    db.commit()
    db.refresh(current_user)
    return current_user


@router.delete(
    "/me",
    response_model=MessageResponse,
    dependencies=[Depends(rate_limit("delete_account", 5, 600))],
)
def delete_my_account(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Delete the account and anonymize its personal data (see app.services.account_deletion).
    Returns 409 while an order is still in progress.
    """
    try:
        result = delete_account(db, current_user)
    except AccountDeletionBlocked as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))

    for order_id, event in result.notifications:
        background_tasks.add_task(dispatch_order_notification, order_id, event)

    return MessageResponse(message="Account personal data successfully deleted and anonymized.")
