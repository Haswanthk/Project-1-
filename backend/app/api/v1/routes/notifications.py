from typing import Any
from fastapi import APIRouter, Depends, HTTPException

from app.core.deps import get_current_user

router = APIRouter()

_NOTIFICATIONS_DB: list[dict[str, Any]] = [
    {
        "id": 1,
        "title": "Spark ETL Job Completed",
        "message": "Job 'ETL_Sales_Aggregation' finished processing 1.2M records successfully.",
        "severity": "info",
        "timestamp": "2026-07-26T18:01:00Z",
        "read": False,
    },
    {
        "id": 2,
        "title": "Model Performance Drift Alert",
        "message": "Model 'RandomForestClassifier_1' feature drift exceeded 5% threshold on column 'activity_score'.",
        "severity": "warning",
        "timestamp": "2026-07-26T19:30:00Z",
        "read": False,
    },
    {
        "id": 3,
        "title": "High Kafka Consumer Latency",
        "message": "Stream topic 'sensor-telemetry-v1' consumer group lag hit 12,400 messages.",
        "severity": "error",
        "timestamp": "2026-07-26T20:00:00Z",
        "read": True,
    },
]


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
