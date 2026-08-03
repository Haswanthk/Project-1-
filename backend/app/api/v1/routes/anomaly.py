import random
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

from fastapi import APIRouter, Depends

from app.core.deps import get_current_user

router = APIRouter()

_SEVERITY = Literal["CRITICAL", "HIGH", "MEDIUM", "LOW"]

# Seeded anomaly records — realistic enterprise dataset
_ANOMALIES_SEED: list[dict[str, Any]] = [
    {
        "id": "anm-001",
        "metric": "API Error Rate",
        "dataset": "platform_metrics",
        "timestamp": "2026-07-31T04:12:00Z",
        "value": 18.4,
        "expected_value": 1.2,
        "z_score": 6.2,
        "severity": "CRITICAL",
        "status": "investigating",
        "description": "Sudden 15× spike in API 5xx responses from IP range 192.168.1.0/24.",
        "root_cause": "Malformed request payload caused cascading validation failures in the inference endpoint.",
        "affected_service": "prediction-api",
    },
    {
        "id": "anm-002",
        "metric": "Revenue",
        "dataset": "sales_transactions",
        "timestamp": "2026-07-29T09:45:00Z",
        "value": 1_840_200,
        "expected_value": 980_000,
        "z_score": 4.8,
        "severity": "HIGH",
        "status": "resolved",
        "description": "Revenue 88% above daily average — correlated with successful Flash Sale campaign.",
        "root_cause": "Legitimate traffic surge from email marketing campaign launched at 09:00 UTC.",
        "affected_service": "sales-pipeline",
    },
    {
        "id": "anm-003",
        "metric": "Model Prediction Confidence",
        "dataset": "ml_inference_logs",
        "timestamp": "2026-07-30T14:22:00Z",
        "value": 0.41,
        "expected_value": 0.87,
        "z_score": -3.9,
        "severity": "HIGH",
        "status": "open",
        "description": "Churn classifier confidence dropped to 41% — well below 87% baseline.",
        "root_cause": "Feature drift in 'user_activity_score' and 'session_duration' degraded model performance.",
        "affected_service": "churn-predictor",
    },
    {
        "id": "anm-004",
        "metric": "Kafka Consumer Lag",
        "dataset": "streaming_metrics",
        "timestamp": "2026-07-28T20:00:00Z",
        "value": 12_400,
        "expected_value": 320,
        "z_score": 5.1,
        "severity": "HIGH",
        "status": "resolved",
        "description": "sensor-telemetry-v1 consumer lag exceeded 12k messages for 18 minutes.",
        "root_cause": "Spark consumer group rebalance during rolling upgrade caused 18-minute processing pause.",
        "affected_service": "kafka-consumer-group",
    },
    {
        "id": "anm-005",
        "metric": "Database Query Latency",
        "dataset": "platform_metrics",
        "timestamp": "2026-07-27T03:15:00Z",
        "value": 2_840,
        "expected_value": 45,
        "z_score": 7.4,
        "severity": "CRITICAL",
        "status": "resolved",
        "description": "Postgres p99 query latency spiked to 2.8 s — table lock contention on orders table.",
        "root_cause": "Missing index on orders.user_id combined with a full-table migration running concurrently.",
        "affected_service": "postgres-primary",
    },
    {
        "id": "anm-006",
        "metric": "New Customer Registrations",
        "dataset": "sales_transactions",
        "timestamp": "2026-07-26T11:00:00Z",
        "value": 1_820,
        "expected_value": 510,
        "z_score": 3.6,
        "severity": "MEDIUM",
        "status": "resolved",
        "description": "3.6× normal registration volume — linked to partner referral campaign launch.",
        "root_cause": "Expected behaviour from PromoCode campaign. No action required.",
        "affected_service": "user-service",
    },
    {
        "id": "anm-007",
        "metric": "Memory Usage",
        "dataset": "platform_metrics",
        "timestamp": "2026-07-25T07:30:00Z",
        "value": 91.2,
        "expected_value": 62.0,
        "z_score": 3.1,
        "severity": "MEDIUM",
        "status": "open",
        "description": "spark-worker-01 memory at 91% — approaching OOM threshold.",
        "root_cause": "Large join operation in ETL_Sales_Aggregation job consuming excessive executor memory.",
        "affected_service": "spark-worker-01",
    },
    {
        "id": "anm-008",
        "metric": "Prediction Throughput",
        "dataset": "ml_inference_logs",
        "timestamp": "2026-07-24T16:45:00Z",
        "value": 42,
        "expected_value": 380,
        "z_score": -3.3,
        "severity": "MEDIUM",
        "status": "investigating",
        "description": "ML inference throughput dropped 89% for 25 minutes during model hot-reload.",
        "root_cause": "Model registry reload triggered a cold-start penalty; auto-scaling did not trigger fast enough.",
        "affected_service": "model-serving",
    },
    {
        "id": "anm-009",
        "metric": "CDN Cache Hit Rate",
        "dataset": "platform_metrics",
        "timestamp": "2026-07-23T22:10:00Z",
        "value": 34.2,
        "expected_value": 91.5,
        "z_score": -2.8,
        "severity": "LOW",
        "status": "resolved",
        "description": "Cache hit rate dropped to 34% after CDN config push purged edge cache.",
        "root_cause": "Accidental cache invalidation in Nginx config deployment. Resolved within 15 min.",
        "affected_service": "cdn-edge",
    },
    {
        "id": "anm-010",
        "metric": "Email Delivery Rate",
        "dataset": "notification_logs",
        "timestamp": "2026-07-22T08:00:00Z",
        "value": 78.1,
        "expected_value": 98.5,
        "z_score": -2.4,
        "severity": "LOW",
        "status": "open",
        "description": "Email delivery rate declined to 78% — bounce rate elevated in EU region.",
        "root_cause": "IP reputation issue with EU-West SMTP relay. Warm-up required after IP rotation.",
        "affected_service": "notification-service",
    },
]


@router.get("/")
def list_anomalies(
    severity: str = "",
    status: str = "",
    limit: int = 50,
    _: object = Depends(get_current_user),
):
    """List detected anomalies with optional severity/status filter."""
    items = list(_ANOMALIES_SEED)
    if severity:
        items = [a for a in items if a["severity"] == severity.upper()]
    if status:
        items = [a for a in items if a["status"] == status.lower()]
    return items[:limit]


@router.get("/summary")
def anomaly_summary(_: object = Depends(get_current_user)):
    counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
    statuses = {"open": 0, "investigating": 0, "resolved": 0}
    for a in _ANOMALIES_SEED:
        counts[a["severity"]] = counts.get(a["severity"], 0) + 1
        statuses[a["status"]] = statuses.get(a["status"], 0) + 1
    return {
        "total": len(_ANOMALIES_SEED),
        "by_severity": counts,
        "by_status": statuses,
        "last_detected": _ANOMALIES_SEED[0]["timestamp"] if _ANOMALIES_SEED else None,
    }


@router.get("/{anomaly_id}/explain")
def explain_anomaly(anomaly_id: str, _: object = Depends(get_current_user)):
    anomaly = next((a for a in _ANOMALIES_SEED if a["id"] == anomaly_id), None)
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
