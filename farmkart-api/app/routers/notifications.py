from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.device_token import DeviceToken
from app.models.notification import Notification
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.notification import NotificationOut, NotificationsListResponse, RegisterTokenRequest

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.post("/register-token", response_model=MessageResponse)
def register_device_token(
    req: RegisterTokenRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Register or update an Expo Push device token for the authenticated user.
    """
    token_str = req.token.strip()
    existing = db.query(DeviceToken).filter(DeviceToken.token == token_str).first()
    if existing:
        existing.user_id = current_user.id
        existing.platform = req.platform
        existing.updated_at = datetime.now(timezone.utc)
    else:
        new_token = DeviceToken(
            user_id=current_user.id,
            token=token_str,
            platform=req.platform,
        )
        db.add(new_token)

    db.commit()
    return MessageResponse(message="Device token registered successfully.")


@router.delete("/unregister-token", response_model=MessageResponse)
def unregister_device_token(
    token: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Unregister a push notification device token upon logout.
    """
    db.query(DeviceToken).filter(
        DeviceToken.token == token.strip(),
        DeviceToken.user_id == current_user.id,
    ).delete()
    db.commit()
    return MessageResponse(message="Device token unregistered successfully.")


@router.get("", response_model=NotificationsListResponse)
def get_user_notifications(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieve in-app notifications for the current user (most recent first, paginated).
    """
    base = db.query(Notification).filter(Notification.user_id == current_user.id)
    total = base.count()
    unread_count = base.filter(Notification.read.is_(False)).count()
    items = (
        base.order_by(Notification.created_at.desc(), Notification.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return NotificationsListResponse(
        items=items,
        total=total,
        unread_count=unread_count,
    )


@router.patch("/{notification_id}/read", response_model=NotificationOut)
def mark_notification_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Mark a specific notification as read.
    """
    notif = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == current_user.id)
        .first()
    )
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found.")

    notif.read = True
    db.commit()
    db.refresh(notif)
    return notif


@router.patch("/mark-all-read", response_model=MessageResponse)
def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Mark all notifications for the authenticated user as read.
    """
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.read.is_(False),
    ).update({"read": True})
    db.commit()
    return MessageResponse(message="All notifications marked as read.")


@router.delete("", response_model=MessageResponse)
def clear_all_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Clear all notification history for the authenticated user.
    """
    db.query(Notification).filter(Notification.user_id == current_user.id).delete()
    db.commit()
    return MessageResponse(message="Notification history cleared.")
