from typing import Any
from fastapi import APIRouter, Depends, HTTPException

from app.core.deps import get_current_user

router = APIRouter()

_NOTIFICATIONS_DB: list[dict[str, Any]] = [
    {
        "id": 1,
        "title": "Model drift detected",
        "message": "RandomForestClassifier_churn has significant feature drift (PSI=0.62). Retraining recommended.",
        "type": "warning",
        "read": False,
        "created_at": "2026-08-30T14:22:00Z",
    },
    {
        "id": 2,
        "title": "Dataset upload complete",
        "message": "sales_q2_2026.csv was successfully uploaded and profiled (1,250 rows, 18 columns).",
        "type": "success",
        "read": False,
        "created_at": "2026-08-31T10:05:00Z",
    },
    {
        "id": 3,
        "title": "Anomaly detected — API Error Rate",
        "message": "API error rate spike detected (6.2σ above baseline). Severity: CRITICAL.",
        "type": "error",
        "read": True,
        "created_at": "2026-08-29T22:10:00Z",
    },
    {
        "id": 4,
        "title": "Report generated",
        "message": "Monthly Analytics Report (PDF) has been generated and is ready for download.",
        "type": "info",
        "read": False,
        "created_at": "2026-09-01T08:00:00Z",
    },
    {
        "id": 5,
        "title": "Model training complete",
        "message": "RandomForestRegressor training finished. Accuracy: 91.4% on test set.",
        "type": "success",
        "read": True,
        "created_at": "2026-08-28T16:45:00Z",
    },
]


@router.get("/")
def list_notifications(_: object = Depends(get_current_user)):
    return list(reversed(_NOTIFICATIONS_DB))


@router.post("/{notification_id}/read")
def mark_as_read(notification_id: int, _: object = Depends(get_current_user)):
    notif = next((n for n in _NOTIFICATIONS_DB if n["id"] == notification_id), None)
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif["read"] = True
    return notif


@router.post("/read-all")
def mark_all_read(_: object = Depends(get_current_user)):
    for n in _NOTIFICATIONS_DB:
        n["read"] = True
    return {"status": "ok", "marked": len(_NOTIFICATIONS_DB)}
