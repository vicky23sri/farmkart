from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime


class SendOTPRequest(BaseModel):
    mobile: str = Field(..., description="10-digit mobile number", example="9876543210")


class SendOTPResponse(BaseModel):
    message: str
    mobile: str


class VerifyOTPRequest(BaseModel):
    mobile: str = Field(..., example="9876543210")
    otp: str = Field(..., example="123456")


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    role: Optional[str] = None
    is_new_user: bool = False


class SetRoleRequest(BaseModel):
    role: Literal["buyer", "seller"]


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    address: Optional[str] = None


class UserOut(BaseModel):
    id: int
    mobile: str
    role: Optional[str] = None
    name: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    address: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
