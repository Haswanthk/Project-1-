import random
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

from fastapi import APIRouter, Depends

from pydantic import BaseModel
from sqlalchemy.orm import Session
import pandas as pd
from sklearn.ensemble import IsolationForest
import numpy as np
import uuid

from app.core.deps import get_current_user, get_db
from app.repositories.dataset import DatasetRepository
from app.services.profiling_service import ProfilingService

router = APIRouter()

_SEVERITY = Literal["CRITICAL", "HIGH", "MEDIUM", "LOW"]

_ANOMALIES_DB: list[dict[str, Any]] = [
    {
        "id": "anm-001", "metric": "API Error Rate", "dataset": "platform_metrics",
        "timestamp": "2026-08-29T22:10:00Z", "value": 620, "expected_value": 42,
        "z_score": 6.2, "severity": "CRITICAL", "status": "resolved",
        "description": "API error rate spiked to 620 errors/min — 6.2σ above baseline.",
        "root_cause": "Memory leak in API gateway v2.4.1 causing cascading 500 errors.",
        "affected_service": "API Gateway",
    },
    {
        "id": "anm-002", "metric": "DB Query Latency", "dataset": "platform_metrics",
        "timestamp": "2026-08-30T03:40:00Z", "value": 2840, "expected_value": 45,
        "z_score": 7.4, "severity": "CRITICAL", "status": "resolved",
        "description": "DB query latency reached 2,840ms avg — 63× normal.",
        "root_cause": "Missing index on user_events table after schema migration.",
        "affected_service": "PostgreSQL",
    },
    {
        "id": "anm-003", "metric": "Model Confidence Score", "dataset": "ml_inference_logs",
        "timestamp": "2026-08-30T14:22:00Z", "value": 0.47, "expected_value": 0.92,
        "z_score": 4.8, "severity": "HIGH", "status": "investigating",
        "description": "Churn model confidence dropped to 47% — well below 85% threshold.",
        "root_cause": "Feature drift in user_activity_score column (PSI=0.62).",
        "affected_service": "ML Inference",
    },
    {
        "id": "anm-004", "metric": "Kafka Consumer Lag", "dataset": "streaming_metrics",
        "timestamp": "2026-08-31T20:00:00Z", "value": 145_000, "expected_value": 200,
        "z_score": 5.1, "severity": "HIGH", "status": "resolved",
        "description": "sensor-telemetry-v1 consumer lag reached 145K messages.",
        "root_cause": "Consumer group restart after pod eviction.",
        "affected_service": "Kafka",
    },
    {
        "id": "anm-005", "metric": "Revenue Spike", "dataset": "sales_transactions",
        "timestamp": "2026-08-28T15:00:00Z", "value": 485_000, "expected_value": 180_000,
        "z_score": 4.2, "severity": "HIGH", "status": "open",
        "description": "Revenue spike detected on Aug 28 — 2.7× daily average.",
        "root_cause": "Large enterprise deal closed (Acme Corp — $285K contract).",
        "affected_service": "Billing",
    },
    {
        "id": "anm-006", "metric": "CPU Usage — spark-worker-01", "dataset": "infrastructure_metrics",
        "timestamp": "2026-09-01T08:30:00Z", "value": 88.7, "expected_value": 35.0,
        "z_score": 3.4, "severity": "MEDIUM", "status": "open",
        "description": "CPU usage sustained above 80% for 2+ hours on spark-worker-01.",
        "root_cause": "Large ML feature engineering job consuming excess resources.",
        "affected_service": "Spark Cluster",
    },
    {
        "id": "anm-007", "metric": "Prediction Throughput", "dataset": "ml_inference_logs",
        "timestamp": "2026-08-31T11:00:00Z", "value": 820, "expected_value": 2400,
        "z_score": 3.1, "severity": "MEDIUM", "status": "investigating",
        "description": "Prediction throughput dropped to 820 req/min from typical 2,400.",
        "root_cause": "Model serving container OOM — pod restarting periodically.",
        "affected_service": "ML Serving",
    },
    {
        "id": "anm-008", "metric": "New User Registrations", "dataset": "sales_transactions",
        "timestamp": "2026-08-27T10:00:00Z", "value": 840, "expected_value": 120,
        "z_score": 3.8, "severity": "MEDIUM", "status": "resolved",
        "description": "Registration spike detected — 7× normal rate over 6h window.",
        "root_cause": "Viral Product Hunt launch driving unusually high sign-ups.",
        "affected_service": "Auth Service",
    },
    {
        "id": "anm-009", "metric": "CDN Cache Miss Rate", "dataset": "platform_metrics",
        "timestamp": "2026-09-01T05:00:00Z", "value": 42.1, "expected_value": 8.2,
        "z_score": 2.4, "severity": "LOW", "status": "open",
        "description": "CDN cache miss rate elevated at 42% (normal: ~8%).",
        "root_cause": "Cache invalidation after content deployment cleared all entries.",
        "affected_service": "CDN",
    },
    {
        "id": "anm-010", "metric": "Email Delivery Rate", "dataset": "platform_metrics",
        "timestamp": "2026-08-30T18:00:00Z", "value": 87.4, "expected_value": 98.5,
        "z_score": 2.1, "severity": "LOW", "status": "resolved",
        "description": "Email delivery rate dropped to 87.4% — below 95% SLA.",
        "root_cause": "Third-party email provider (SendGrid) regional outage.",
        "affected_service": "Email Service",
    },
]


class DetectRequest(BaseModel):
    dataset_id: int
    columns: list[str]
    contamination: float = 0.05


@router.get("/")
def list_anomalies(
    severity: str = "",
    status: str = "",
    limit: int = 50,
    _: object = Depends(get_current_user),
):
    items = list(reversed(_ANOMALIES_DB))
    if severity:
        items = [a for a in items if a["severity"] == severity.upper()]
    if status:
        items = [a for a in items if a["status"] == status.lower()]
    return items[:limit]


@router.get("/summary")
def anomaly_summary(_: object = Depends(get_current_user)):
    counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
    statuses = {"open": 0, "investigating": 0, "resolved": 0}
    for a in _ANOMALIES_DB:
        counts[a["severity"]] = counts.get(a["severity"], 0) + 1
        statuses[a["status"]] = statuses.get(a["status"], 0) + 1
    return {
        "total": len(_ANOMALIES_DB),
        "by_severity": counts,
        "by_status": statuses,
        "last_detected": _ANOMALIES_DB[-1]["timestamp"] if _ANOMALIES_DB else None,
    }


@router.post("/detect")
def detect_anomalies(payload: DetectRequest, db: Session = Depends(get_db), _: object = Depends(get_current_user)):
    dataset = DatasetRepository(db).get_by_id(payload.dataset_id)
    if not dataset:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    profiling_service = ProfilingService()
    try:
        df = profiling_service.load_dataset(dataset.file_path)
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=f"Failed to load dataset: {e}")

    # Keep only selected columns that exist and are numeric
    cols = [c for c in payload.columns if c in df.columns and pd.api.types.is_numeric_dtype(df[c])]
    if not cols:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="No valid numeric columns selected")

    df_subset = df[cols].dropna()
    if len(df_subset) < 10:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Not enough valid rows to detect anomalies")

    # Run Isolation Forest
    model = IsolationForest(contamination=payload.contamination, random_state=42)
    model.fit(df_subset)
    
    # -1 for anomalies, 1 for normal
    predictions = model.predict(df_subset)
    
    # decision_function: lower is more anomalous
    scores = model.decision_function(df_subset)
    
    anomaly_indices = np.where(predictions == -1)[0]
    
    results = []
    timestamp = datetime.now(UTC).isoformat()
    
    for idx in anomaly_indices:
        # compute z-score approximation from decision scores
        score = float(scores[idx])
        # decision function is roughly centered around 0. Let's map it to a z-score like value
        z_score = -score * 10  # approximate scaling for visualization
        
        # Calculate severity based on score
        severity = "LOW"
        if z_score > 3: severity = "MEDIUM"
        if z_score > 5: severity = "HIGH"
        if z_score > 8: severity = "CRITICAL"
        
        val = float(df_subset.iloc[idx][cols[0]])
        mean_val = float(df_subset[cols[0]].mean())
        
        anomaly = {
            "id": str(uuid.uuid4()),
            "metric": cols[0] if len(cols) == 1 else f"Multivariate ({len(cols)} cols)",
            "dataset": dataset.name,
            "timestamp": timestamp,
            "value": val,
            "expected_value": mean_val,
            "z_score": round(z_score, 2),
            "severity": severity,
            "status": "open",
            "description": f"Detected anomaly in {dataset.name} on row {idx}",
            "root_cause": "IsolationForest detected data point outside normal distribution boundaries.",
            "affected_service": dataset.source_type
        }
        results.append(anomaly)
    
    # Store in memory for now
    _ANOMALIES_DB.extend(results)
    
    return {
        "total_records": len(df_subset),
        "anomalies_detected": len(results),
        "anomalies": results
    }


@router.get("/{anomaly_id}/explain")
def explain_anomaly(anomaly_id: str, _: object = Depends(get_current_user)):
    anomaly = next((a for a in _ANOMALIES_DB if a["id"] == anomaly_id), None)
    if not anomaly:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Anomaly not found")

    explanation = (
        f"**Anomaly Detected**: {anomaly['metric']} at {anomaly['timestamp']}\n\n"
        f"**Observed Value**: {anomaly['value']:,}  |  **Expected Baseline**: {anomaly['expected_value']:,}\n\n"
        f"**Statistical Significance**: Z-score of {anomaly['z_score']:.1f} ({abs(anomaly['z_score']):.1f}σ from mean — "
        f"{'extremely rare event (<0.01% probability)' if abs(anomaly['z_score']) > 5 else 'statistically significant deviation'})\n\n"
        f"**Root Cause Analysis**: {anomaly['root_cause']}\n\n"
        f"**Recommended Action**: "
        + (
            "Escalate immediately to on-call SRE. Review affected service logs and consider rollback."
            if anomaly["severity"] == "CRITICAL"
            else "Investigate affected service within 4 hours. Monitor for recurrence."
            if anomaly["severity"] == "HIGH"
            else "Schedule review in next engineering stand-up."
            if anomaly["severity"] == "MEDIUM"
            else "Log for reference. Monitor passively."
        )
    )
    return {
        "anomaly_id": anomaly_id,
        "explanation": explanation,
        "severity": anomaly["severity"],
        "provider": "Internal Analytics Engine",
        "grounded_on": anomaly["dataset"],
    }


@router.post("/{anomaly_id}/resolve")
def resolve_anomaly(anomaly_id: str, _: object = Depends(get_current_user)):
    """Mark an anomaly as resolved."""
    anomaly = next((a for a in _ANOMALIES_DB if a["id"] == anomaly_id), None)
    if not anomaly:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Anomaly not found")
    anomaly["status"] = "resolved"
    return {"anomaly_id": anomaly_id, "status": "resolved"}


@router.post("/{anomaly_id}/acknowledge")
def acknowledge_anomaly(anomaly_id: str, _: object = Depends(get_current_user)):
    """Mark an anomaly as investigating (acknowledged)."""
    anomaly = next((a for a in _ANOMALIES_DB if a["id"] == anomaly_id), None)
    if not anomaly:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Anomaly not found")
    anomaly["status"] = "investigating"
    return {"anomaly_id": anomaly_id, "status": "investigating"}


@router.get("/statistics/trends")
def anomaly_statistics(_: object = Depends(get_current_user)):
    """Return trend analysis and detailed statistics for anomalies."""
    severity_counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
    status_counts = {"open": 0, "investigating": 0, "resolved": 0}
    affected_services: dict[str, int] = {}
    z_scores: list[float] = []

    for a in _ANOMALIES_DB:
        severity_counts[a["severity"]] = severity_counts.get(a["severity"], 0) + 1
        status_counts[a["status"]] = status_counts.get(a["status"], 0) + 1
        svc = a.get("affected_service", "Unknown")
        affected_services[svc] = affected_services.get(svc, 0) + 1
        z_scores.append(a.get("z_score", 0))

    avg_z = sum(z_scores) / len(z_scores) if z_scores else 0
    max_z = max(z_scores) if z_scores else 0
    resolution_rate = (
        status_counts["resolved"] / len(_ANOMALIES_DB) * 100
        if _ANOMALIES_DB else 0
    )

    return {
        "total": len(_ANOMALIES_DB),
        "by_severity": severity_counts,
        "by_status": status_counts,
        "affected_services": dict(sorted(affected_services.items(), key=lambda x: x[1], reverse=True)),
        "z_score_stats": {
            "average": round(avg_z, 2),
            "max": round(max_z, 2),
        },
        "resolution_rate_pct": round(resolution_rate, 1),
        "open_critical": sum(1 for a in _ANOMALIES_DB if a["severity"] == "CRITICAL" and a["status"] != "resolved"),
    }

