from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import create_access_token
from app.core.deps import get_current_user
from app.models.user import User
from app.services.otp import create_and_send_otp, verify_otp_code
from app.schemas.auth import (
    SendOTPRequest,
    SendOTPResponse,
    VerifyOTPRequest,
    TokenResponse,
    SetRoleRequest,
    UpdateProfileRequest,
    UserOut,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/send-otp", response_model=SendOTPResponse)
def send_otp(req: SendOTPRequest, db: Session = Depends(get_db)):
    """Generate 6-digit OTP, store with 5-min expiry, and print to console."""
    mobile = req.mobile.strip()
    if len(mobile) < 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide a valid 10-digit mobile number.",
        )

    create_and_send_otp(db, mobile)
    return SendOTPResponse(
        message=f"OTP sent successfully to {mobile}. Check server console output.",
        mobile=mobile,
    )


@router.post("/verify-otp", response_model=TokenResponse)
def verify_otp(req: VerifyOTPRequest, db: Session = Depends(get_db)):
    """Verify OTP. Create user if new, and return JWT containing user_id and role."""
    mobile = req.mobile.strip()
    is_valid = verify_otp_code(db, mobile, req.otp.strip())
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP code. Please request a new one.",
        )

    # Find or create user
    user = db.query(User).filter(User.mobile == mobile).first()
    is_new = False
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

    db.commit()
    db.refresh(current_user)
    return current_user
