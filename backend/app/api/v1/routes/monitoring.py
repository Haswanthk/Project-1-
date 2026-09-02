import time
import random
import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from sqlalchemy.orm import Session
from app.core.deps import get_current_user, get_db
from app.repositories.dataset import DatasetRepository
from sqlalchemy import text
from app.services.ml_service import MLService

router = APIRouter()

START_TIME = time.time()

_NODES: list[dict[str, Any]] = [
    {
        "id": "node-001",
        "name": "api-server-01",
        "type": "API Server",
        "status": "online",
        "cpu": 14.2,
        "memory": 38.6,
        "disk": 24.8,
        "uptime_hours": 336,
        "region": "us-east-1",
        "ip": "10.0.1.10",
    },
    {
        "id": "node-002",
        "name": "ml-worker-01",
        "type": "ML Worker",
        "status": "online",
        "cpu": 62.4,
        "memory": 71.2,
        "disk": 48.3,
        "uptime_hours": 248,
        "region": "us-east-1",
        "ip": "10.0.1.11",
    },
    {
        "id": "node-003",
        "name": "spark-worker-01",
        "type": "Spark Worker",
        "status": "degraded",
        "cpu": 88.7,
        "memory": 91.4,
        "disk": 67.2,
        "uptime_hours": 120,
        "region": "us-west-2",
        "ip": "10.0.2.10",
    },
    {
        "id": "node-004",
        "name": "db-primary-01",
        "type": "Database",
        "status": "online",
        "cpu": 8.1,
        "memory": 45.3,
        "disk": 52.6,
        "uptime_hours": 720,
        "region": "us-east-1",
        "ip": "10.0.1.20",
    },
    {
        "id": "node-005",
        "name": "kafka-broker-01",
        "type": "Kafka Broker",
        "status": "online",
        "cpu": 22.3,
        "memory": 58.9,
        "disk": 34.1,
        "uptime_hours": 480,
        "region": "us-east-1",
        "ip": "10.0.1.30",
    },
    {
        "id": "node-006",
        "name": "redis-cache-01",
        "type": "Cache",
        "status": "online",
        "cpu": 3.4,
        "memory": 28.7,
        "disk": 12.4,
        "uptime_hours": 720,
        "region": "us-east-1",
        "ip": "10.0.1.40",
    },
]

_MODEL_DRIFT: list[dict[str, Any]] = [
    {
        "id": "drift-001",
        "model_name": "RandomForestClassifier_churn",
        "feature": "user_activity_score",
        "drift_score": 0.62,
        "threshold": 0.3,
        "status": "critical",
        "detected_at": "2026-08-30T14:22:00Z",
        "description": "Significant distribution shift detected in user_activity_score (PSI=0.62, threshold=0.30). Model retraining recommended.",
    },
    {
        "id": "drift-002",
        "model_name": "XGBoostClassifier_fraud",
        "feature": "transaction_amount",
        "drift_score": 0.18,
        "threshold": 0.3,
        "status": "stable",
        "detected_at": "2026-08-31T09:00:00Z",
        "description": "Minor drift detected in transaction_amount but within acceptable threshold.",
    },
    {
        "id": "drift-003",
        "model_name": "RandomForestRegressor_revenue",
        "feature": "session_duration",
        "drift_score": 0.09,
        "threshold": 0.3,
        "status": "stable",
        "detected_at": "2026-09-01T00:00:00Z",
        "description": "No significant drift detected. Model performance is stable.",
    },
]

_ALERTS: list[dict[str, Any]] = [
    {
        "id": "alert-001",
        "title": "High CPU on spark-worker-01",
        "message": "CPU usage is 88.7% — above 80% threshold. Consider scaling up or distributing load.",
        "severity": "high",
        "category": "infrastructure",
        "resolved": False,
        "created_at": "2026-09-01T10:15:00Z",
    },
    {
        "id": "alert-002",
        "title": "Model drift detected — churn model",
        "message": "user_activity_score PSI=0.62 exceeds threshold 0.30. Retrain recommended.",
        "severity": "critical",
        "category": "ml",
        "resolved": False,
        "created_at": "2026-08-30T14:22:00Z",
    },
    {
        "id": "alert-003",
        "title": "Memory pressure on ml-worker-01",
        "message": "Memory usage reached 71.2%. Monitor for OOM risk during large model training runs.",
        "severity": "medium",
        "category": "infrastructure",
        "resolved": False,
        "created_at": "2026-09-01T08:30:00Z",
    },
    {
        "id": "alert-004",
        "title": "Kafka consumer lag resolved",
        "message": "sensor-telemetry-v1 consumer lag spike was resolved at 20:18 UTC. No action needed.",
        "severity": "low",
        "category": "streaming",
        "resolved": True,
        "created_at": "2026-08-31T20:00:00Z",
    },
]

# Build a rolling time-series buffer (last 30 data points)
_timeseries_cache: list[dict[str, Any]] = []
for i in range(30):
    _timeseries_cache.append({
        "timestamp": f"T-{30 - i}m",
        "api_requests": random.randint(3200, 5800),
        "events_per_min": random.randint(1_100_000, 1_600_000),
        "error_rate": round(random.uniform(0.01, 0.08), 3),
        "p99_latency_ms": random.randint(45, 180),
        "cpu": round(random.uniform(12, 45), 1),
    })


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
            "kafka": "simulated",
            "spark": "simulated",
        },
    }


@router.get("/nodes")
def list_nodes(_: object = Depends(get_current_user)):
    # Simulate small fluctuations in metrics
    for node in _NODES:
        node["cpu"] = round(max(1.0, node["cpu"] + random.uniform(-2, 2)), 1)
        node["memory"] = round(max(5.0, min(99.0, node["memory"] + random.uniform(-1, 1))), 1)
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
        "api_requests_total": random.randint(145_000, 160_000),
        "api_errors_total": random.randint(32, 48),
        "api_p99_latency_ms": random.randint(62, 145),
        "streaming_events_per_min": random.randint(1_100_000, 1_500_000),
        "spark_jobs_active": 2,
        "models_in_registry": max(models_count, 3),
        "datasets_total": datasets_count,
        "uptime_percent": 99.94,
        "timestamp": datetime.now(UTC).isoformat(),
    }


@router.get("/metrics/timeseries")
def metrics_timeseries(_: object = Depends(get_current_user)):
    # Add one fresh point, drop oldest
    _timeseries_cache.append({
        "timestamp": "now",
        "api_requests": random.randint(3200, 5800),
        "events_per_min": random.randint(1_100_000, 1_600_000),
        "error_rate": round(random.uniform(0.01, 0.08), 3),
        "p99_latency_ms": random.randint(45, 180),
        "cpu": round(random.uniform(12, 45), 1),
    })
    if len(_timeseries_cache) > 30:
        _timeseries_cache.pop(0)

    return {
        "timestamps": [p["timestamp"] for p in _timeseries_cache],
        "api_requests": [p["api_requests"] for p in _timeseries_cache],
        "events_per_min": [p["events_per_min"] for p in _timeseries_cache],
        "error_rate": [p["error_rate"] for p in _timeseries_cache],
        "p99_latency_ms": [p["p99_latency_ms"] for p in _timeseries_cache],
        "requests": [p["api_requests"] for p in _timeseries_cache],
        "errors": [int(p["api_requests"] * p["error_rate"]) for p in _timeseries_cache],
        "cpu": [p["cpu"] for p in _timeseries_cache],
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
