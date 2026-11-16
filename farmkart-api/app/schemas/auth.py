from pydantic import BaseModel, ConfigDict, EmailStr, Field
from typing import Optional, Literal
from datetime import datetime


class SendOTPRequest(BaseModel):
    mobile: str = Field(
        ...,
        pattern=r"^[6-9]\d{9}$",
        description="10-digit Indian mobile number",
        json_schema_extra={"example": "9876543210"},
    )


class SendOTPResponse(BaseModel):
    message: str
    mobile: str


class VerifyOTPRequest(BaseModel):
    mobile: str = Field(
        ...,
        pattern=r"^[6-9]\d{9}$",
        description="10-digit Indian mobile number",
        json_schema_extra={"example": "9876543210"},
    )
    otp: str = Field(..., min_length=6, max_length=6, json_schema_extra={"example": "123456"})


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    role: Optional[str] = None
    is_new_user: bool = False


class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, json_schema_extra={"example": "Karthik"})
    email: EmailStr = Field(..., max_length=255, json_schema_extra={"example": "karthik@example.com"})
    password: str = Field(..., min_length=8, max_length=72, json_schema_extra={"example": "a-strong-passphrase"})
    mobile: Optional[str] = Field(None, pattern=r"^[6-9]\d{9}$", json_schema_extra={"example": "9876543210"})
    role: Optional[Literal["buyer", "seller"]] = None


class LoginRequest(BaseModel):
    email_or_mobile: str = Field(..., min_length=3, max_length=255, json_schema_extra={"example": "karthik@example.com"})
    password: str = Field(..., min_length=1, max_length=128)


class GoogleAuthRequest(BaseModel):
    # One of id_token / access_token is required; the identity is taken from Google, not the client.
    id_token: Optional[str] = Field(None, max_length=4096)
    access_token: Optional[str] = Field(None, max_length=4096)
    # Display hints only (used when Google does not return them for an access token)
    name: Optional[str] = Field(None, max_length=100)
    avatar_url: Optional[str] = Field(None, max_length=512, pattern=r"^https://")
    role: Optional[Literal["buyer", "seller"]] = None


class SetRoleRequest(BaseModel):
    role: Literal["buyer", "seller"]


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    lat: Optional[float] = Field(None, ge=-90, le=90)
    lng: Optional[float] = Field(None, ge=-180, le=180)
    address: Optional[str] = Field(None, max_length=255)
    upi_id: Optional[str] = Field(
        None,
        pattern=r"^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$",
        description="Seller direct UPI VPA (e.g., farmer@okhdfcbank or 9842156780@upi)",
        json_schema_extra={"example": "farmer@okhdfcbank"},
    )


class UserOut(BaseModel):
    id: int
    email: Optional[str] = None
    mobile: Optional[str] = None
    role: Optional[str] = None
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    auth_provider: Optional[str] = "local"
    lat: Optional[float] = None
    lng: Optional[float] = None
    address: Optional[str] = None
    upi_id: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
