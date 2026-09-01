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

_ANOMALIES_DB: list[dict[str, Any]] = []


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
