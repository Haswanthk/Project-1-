import random
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends

from app.core.deps import get_current_user

router = APIRouter()

_NODES = [
    {"id": "node-1", "name": "api-server-01", "host": "localhost:8001", "role": "api", "region": "us-east-1"},
    {"id": "node-2", "name": "spark-worker-01", "host": "spark:7077", "role": "spark", "region": "us-east-1"},
    {"id": "node-3", "name": "kafka-broker-01", "host": "kafka:9092", "role": "streaming", "region": "us-east-1"},
    {"id": "node-4", "name": "mlflow-server", "host": "localhost:5000", "role": "mlflow", "region": "us-east-1"},
    {"id": "node-5", "name": "postgres-primary", "host": "localhost:5432", "role": "database", "region": "us-east-1"},
    {"id": "node-6", "name": "redis-cache", "host": "localhost:6379", "role": "cache", "region": "us-east-1"},
]

_MODEL_DRIFT: list[dict[str, Any]] = [
    {
        "model_name": "RandomForestClassifier_churn.pkl",
        "last_checked": "2026-07-26T19:00:00Z",
        "feature_drift_score": 0.062,
        "prediction_drift_score": 0.031,
        "status": "WARNING",
        "drifted_features": ["user_activity_score", "session_duration"],
    },
    {
        "model_name": "RandomForestRegressor_revenue.pkl",
        "last_checked": "2026-07-26T20:00:00Z",
        "feature_drift_score": 0.012,
        "prediction_drift_score": 0.008,
        "status": "OK",
        "drifted_features": [],
    },
]


@router.get("/health")
def health(_: object = Depends(get_current_user)):
    return {
        "status": "healthy",
        "timestamp": datetime.now(UTC).isoformat(),
        "version": "1.0.0",
        "services": {
            "database": "connected",
            "redis": "connected",
            "kafka": "degraded",
            "spark": "connected",
        },
    }


@router.get("/nodes")
def list_nodes(_: object = Depends(get_current_user)):
    enriched = []
    for node in _NODES:
        enriched.append({
            **node,
            "status": "ONLINE" if random.random() > 0.1 else "DEGRADED",
            "cpu_usage": round(random.uniform(5, 45), 1),
            "memory_mb": random.randint(512, 8192),
            "latency_ms": round(random.uniform(2, 40), 1),
            "uptime_hours": random.randint(10, 720),
        })
    return enriched


@router.get("/metrics/summary")
def metrics_summary(_: object = Depends(get_current_user)):
    return {
        "api_requests_total": random.randint(10000, 50000),
        "api_errors_total": random.randint(10, 200),
        "api_p99_latency_ms": round(random.uniform(10, 40), 1),
        "streaming_events_per_min": random.randint(800000, 1500000),
        "spark_jobs_active": random.randint(0, 5),
        "models_in_registry": random.randint(100, 150),
        "datasets_total": random.randint(30, 60),
        "uptime_percent": round(random.uniform(99.8, 100.0), 3),
        "timestamp": datetime.now(UTC).isoformat(),
    }


@router.get("/metrics/timeseries")
def metrics_timeseries(_: object = Depends(get_current_user)):
    hours = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"]
    return {
        "timestamps": hours,
        "api_requests": [1200, 1800, 2400, 2100, 3100, 4200, 3900, 4800, 5200, 4900, 5800, 6100],
        "events_per_min": [850000, 920000, 1100000, 1050000, 1250000, 1380000, 1310000, 1420000, 1490000, 1410000, 1530000, 1600000],
        "error_rate": [0.02, 0.01, 0.03, 0.01, 0.02, 0.04, 0.02, 0.01, 0.03, 0.02, 0.01, 0.02],
        "p99_latency_ms": [18.2, 19.5, 21.0, 18.8, 22.4, 25.1, 23.0, 20.2, 19.8, 21.5, 18.9, 19.2],
    }


@router.get("/model-drift")
def model_drift(_: object = Depends(get_current_user)):
    return _MODEL_DRIFT


@router.get("/alerts")
def get_alerts(_: object = Depends(get_current_user)):
    return [
        {
            "id": 1,
            "severity": "warning",
            "title": "Feature drift detected",
            "description": "RandomForestClassifier_churn: user_activity_score drift = 6.2%",
            "fired_at": "2026-07-26T19:10:00Z",
            "resolved": False,
        },
        {
            "id": 2,
            "severity": "info",
            "title": "Spark job completed",
            "description": "ETL_Sales_Aggregation processed 1.2M records in 45s",
            "fired_at": "2026-07-26T18:01:00Z",
            "resolved": True,
        },
        {
            "id": 3,
            "severity": "error",
            "title": "Kafka consumer lag spike",
            "description": "Topic sensor-telemetry-v1 consumer lag at 12,400 messages",
            "fired_at": "2026-07-26T20:00:00Z",
            "resolved": False,
        },
    ]
