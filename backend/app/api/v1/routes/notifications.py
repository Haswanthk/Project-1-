from typing import Any
from fastapi import APIRouter, Depends, HTTPException

from app.core.deps import get_current_user

router = APIRouter()

_NOTIFICATIONS_DB: list[dict[str, Any]] = []


@router.get("/")
def list_notifications(_: object = Depends(get_current_user)):
    return _NOTIFICATIONS_DB


@router.post("/{notification_id}/read")
def mark_as_read(notification_id: int, _: object = Depends(get_current_user)):
    notif = next((n for n in _NOTIFICATIONS_DB if n["id"] == notification_id), None)
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif["read"] = True
    return notif
