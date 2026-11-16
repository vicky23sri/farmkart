from datetime import datetime
from typing import List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field


class RegisterTokenRequest(BaseModel):
    token: str = Field(..., min_length=10, max_length=255, json_schema_extra={"example": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"})
    platform: Optional[Literal["android", "ios", "web"]] = Field("android", json_schema_extra={"example": "android"})


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    type: str
    title: str
    title_tamil: Optional[str] = None
    message: str
    message_tamil: Optional[str] = None
    order_id: Optional[int] = None
    product_id: Optional[int] = None
    read: bool
    created_at: datetime


class NotificationsListResponse(BaseModel):
    items: List[NotificationOut]
    total: int
    unread_count: int
