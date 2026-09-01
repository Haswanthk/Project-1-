import time
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from sqlalchemy.orm import Session
from app.core.deps import get_current_user, get_db
from app.repositories.dataset import DatasetRepository
from sqlalchemy import text
from app.core.deps import get_current_user, get_db
from app.repositories.dataset import DatasetRepository
from app.services.ml_service import MLService

router = APIRouter()

START_TIME = time.time()

_NODES = []

_MODEL_DRIFT: list[dict[str, Any]] = []

# Mutable alerts store so PATCH can update resolved state
_ALERTS: list[dict[str, Any]] = []


class AlertPatchRequest(BaseModel):
    resolved: bool


@router.get("/health")
def health(db: Session = Depends(get_db), _: object = Depends(get_current_user)):
    db_status = "disconnected"
    try:
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception:
        pass

    return {
        "status": "healthy" if db_status == "connected" else "degraded",
        "timestamp": datetime.now(UTC).isoformat(),
        "version": "1.0.0",
        "services": {
            "database": db_status,
            "redis": "disconnected",
            "kafka": "disconnected",
            "spark": "disconnected",
        },
    }


@router.get("/nodes")
def list_nodes(_: object = Depends(get_current_user)):
    return _NODES


@router.get("/metrics/summary")
def metrics_summary(db: Session = Depends(get_db), _: object = Depends(get_current_user)):
    try:
        datasets_count = len(DatasetRepository(db).list_all())
    except Exception:
        datasets_count = 0
    
    try:
        models_count = len(MLService(db).list_models())
    except Exception:
        models_count = 0

    uptime_s = time.time() - START_TIME
    
    return {
        "api_requests_total": 0,
        "api_errors_total": 0,
        "api_p99_latency_ms": 0,
        "streaming_events_per_min": 0,
        "spark_jobs_active": 0,
        "models_in_registry": models_count,
        "datasets_total": datasets_count,
        "uptime_percent": min(100.0, (uptime_s / max(uptime_s, 1)) * 100),
        "timestamp": datetime.now(UTC).isoformat(),
    }


@router.get("/metrics/timeseries")
def metrics_timeseries(_: object = Depends(get_current_user)):
    return {
        "timestamps": [],
        "api_requests": [],
        "events_per_min": [],
        "error_rate": [],
        "p99_latency_ms": [],
        "requests": [],
        "errors": [],
        "cpu": [],
    }


@router.get("/model-drift")
def model_drift(_: object = Depends(get_current_user)):
    return _MODEL_DRIFT


@router.get("/alerts")
def get_alerts(_: object = Depends(get_current_user)):
    return _ALERTS


@router.patch("/alerts/{alert_id}")
def resolve_alert(alert_id: str, payload: AlertPatchRequest, _: object = Depends(get_current_user)):
    alert = next((a for a in _ALERTS if a["id"] == str(alert_id)), None)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert["resolved"] = payload.resolved
    return alert
