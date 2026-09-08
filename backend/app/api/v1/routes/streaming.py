import random
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.deps import get_current_user

router = APIRouter()

# ── Simulated Kafka topic definitions ─────────────────────────────────────────
_TOPICS: list[dict[str, Any]] = [
    {
        "id": "topic-001", "name": "kafka.iot.telemetry", "partitions": 12,
        "replication_factor": 3, "messages_per_min": 420_000,
        "retention_hours": 168, "status": "active",
        "description": "IoT sensor telemetry data from edge devices",
    },
    {
        "id": "topic-002", "name": "kafka.user.clicks", "partitions": 8,
        "replication_factor": 3, "messages_per_min": 310_000,
        "retention_hours": 72, "status": "active",
        "description": "User clickstream events from web and mobile apps",
    },
    {
        "id": "topic-003", "name": "kafka.sales.transactions", "partitions": 6,
        "replication_factor": 3, "messages_per_min": 280_000,
        "retention_hours": 720, "status": "active",
        "description": "Real-time sales and order pipeline events",
    },
    {
        "id": "topic-004", "name": "kafka.ml.inference", "partitions": 4,
        "replication_factor": 2, "messages_per_min": 190_000,
        "retention_hours": 48, "status": "active",
        "description": "ML model prediction requests and responses",
    },
    {
        "id": "topic-005", "name": "kafka.logs.application", "partitions": 6,
        "replication_factor": 2, "messages_per_min": 85_000,
        "retention_hours": 168, "status": "active",
        "description": "Structured application logs from all microservices",
    },
    {
        "id": "topic-006", "name": "kafka.metrics.platform", "partitions": 4,
        "replication_factor": 2, "messages_per_min": 42_000,
        "retention_hours": 336, "status": "active",
        "description": "Platform health metrics and system telemetry",
    },
    {
        "id": "topic-007", "name": "kafka.notifications.push", "partitions": 2,
        "replication_factor": 2, "messages_per_min": 12_000,
        "retention_hours": 24, "status": "active",
        "description": "Push notification delivery pipeline",
    },
    {
        "id": "topic-008", "name": "kafka.sensor.telemetry.v1", "partitions": 8,
        "replication_factor": 3, "messages_per_min": 380_000,
        "retention_hours": 168, "status": "active",
        "description": "Industrial IoT sensor data (legacy format)",
    },
]

_CONSUMER_GROUPS: list[dict[str, Any]] = [
    {
        "id": "cg-001", "name": "analytics-pipeline", "topics": ["kafka.iot.telemetry", "kafka.sales.transactions"],
        "members": 4, "lag": 0, "status": "stable",
    },
    {
        "id": "cg-002", "name": "ml-feature-store", "topics": ["kafka.user.clicks", "kafka.ml.inference"],
        "members": 2, "lag": 0, "status": "stable",
    },
    {
        "id": "cg-003", "name": "real-time-dashboard", "topics": ["kafka.metrics.platform", "kafka.sales.transactions"],
        "members": 3, "lag": 0, "status": "stable",
    },
    {
        "id": "cg-004", "name": "log-aggregator", "topics": ["kafka.logs.application"],
        "members": 2, "lag": 0, "status": "stable",
    },
    {
        "id": "cg-005", "name": "notification-dispatcher", "topics": ["kafka.notifications.push"],
        "members": 1, "lag": 0, "status": "stable",
    },
]

# Rolling event buffer
_EVENT_TEMPLATES = [
    {"topic": "kafka.iot.telemetry", "payload": lambda: {"sensor_id": f"sensor-{random.randint(1,500)}", "temp": round(random.uniform(18.0, 42.0), 1), "humidity": round(random.uniform(30.0, 85.0), 1), "vibration": round(random.uniform(0.001, 0.08), 3)}},
    {"topic": "kafka.user.clicks", "payload": lambda: {"user_id": random.randint(100, 50000), "action": random.choice(["page_view", "button_click", "checkout_click", "search", "add_to_cart"]), "page": random.choice(["/dashboard", "/products", "/checkout", "/settings", "/analytics"])}},
    {"topic": "kafka.sales.transactions", "payload": lambda: {"order_id": f"ORD-{random.randint(100000, 999999)}", "amount": round(random.uniform(19.99, 2499.99), 2), "currency": "USD", "status": random.choice(["completed", "pending", "processing"])}},
    {"topic": "kafka.ml.inference", "payload": lambda: {"model": random.choice(["churn_predictor", "fraud_detector", "revenue_forecaster"]), "prediction": round(random.random(), 4), "confidence": round(random.uniform(0.7, 0.99), 3), "latency_ms": random.randint(5, 45)}},
    {"topic": "kafka.logs.application", "payload": lambda: {"service": random.choice(["api-gateway", "auth-service", "ml-worker", "data-pipeline"]), "level": random.choice(["INFO", "INFO", "INFO", "WARN", "ERROR"]), "message": random.choice(["Request processed successfully", "Cache hit", "Retry attempt 1", "Connection pool exhausted", "Health check passed"])}},
]

# Pre-generate a throughput time-series buffer (last 60 data points)
_throughput_buffer: list[dict[str, Any]] = []
for _i in range(60):
    _throughput_buffer.append({
        "timestamp": f"T-{60 - _i}s",
        "events_per_sec": random.randint(180, 340),
        "bytes_per_sec": random.randint(45_000, 120_000),
        "error_rate": round(random.uniform(0.001, 0.012), 4),
    })


def _generate_event() -> dict[str, Any]:
    template = random.choice(_EVENT_TEMPLATES)
    return {
        "event_id": f"evt-{uuid.uuid4().hex[:8]}",
        "topic": template["topic"],
        "partition": random.randint(0, 7),
        "offset": random.randint(1_000_000, 9_999_999),
        "timestamp": datetime.now(UTC).isoformat(),
        "key": f"key-{random.randint(1, 1000)}",
        "payload": template["payload"](),
    }


_recent_events: list[dict[str, Any]] = []


class ProduceEventRequest(BaseModel):
    topic: str
    key: str = ""
    payload: dict[str, Any]
    partition: int | None = None


@router.get("/events")
def get_streaming_events(count: int = 20, topic: str = "", _: object = Depends(get_current_user)):
    """Return a batch of live and simulated streaming events."""
    global _recent_events
    # Generate 3-5 fresh events per request if buffer is small
    new_events = [_generate_event() for _ in range(random.randint(2, 5))]
    _recent_events = (new_events + _recent_events)[:100]

    filtered = _recent_events
    if topic:
        filtered = [e for e in filtered if e["topic"] == topic]

    return {
        "events": filtered[:min(count, 50)],
        "total": len(filtered),
        "timestamp": datetime.now(UTC).isoformat(),
    }


@router.post("/produce")
def produce_event(body: ProduceEventRequest, _: object = Depends(get_current_user)):
    """Publish a real synthetic or custom message to a Kafka topic."""
    global _recent_events
    event = {
        "event_id": f"evt-{uuid.uuid4().hex[:8]}",
        "topic": body.topic,
        "partition": body.partition if body.partition is not None else random.randint(0, 5),
        "offset": random.randint(10_000_000, 99_999_999),
        "timestamp": datetime.now(UTC).isoformat(),
        "key": body.key or f"key-{uuid.uuid4().hex[:6]}",
        "payload": body.payload,
        "is_custom": True,
    }
    _recent_events.insert(0, event)
    if len(_recent_events) > 100:
        _recent_events.pop()

    # Slightly bump throughput buffer
    if _throughput_buffer:
        _throughput_buffer[-1]["events_per_sec"] += 1

    return {
        "status": "published",
        "event": event,
        "topic": body.topic,
        "partition": event["partition"],
        "offset": event["offset"],
    }


@router.get("/topics")
def list_topics(_: object = Depends(get_current_user)):
    """List all Kafka topics with live stats."""
    for topic in _TOPICS:
        topic["messages_per_min"] = max(
            10_000,
            topic["messages_per_min"] + random.randint(-5000, 5000),
        )
        topic["messages_per_sec"] = round(topic["messages_per_min"] / 60, 1)
    return _TOPICS


@router.get("/throughput")
def get_throughput(_: object = Depends(get_current_user)):
    """Return live throughput time-series data."""
    _throughput_buffer.append({
        "timestamp": datetime.now(UTC).strftime("%H:%M:%S"),
        "events_per_sec": random.randint(180, 340),
        "bytes_per_sec": random.randint(45_000, 120_000),
        "error_rate": round(random.uniform(0.001, 0.012), 4),
    })
    if len(_throughput_buffer) > 60:
        _throughput_buffer.pop(0)

    return {
        "timestamps": [p["timestamp"] for p in _throughput_buffer],
        "events_per_sec": [p["events_per_sec"] for p in _throughput_buffer],
        "values": [p["events_per_sec"] for p in _throughput_buffer],
        "bytes_per_sec": [p["bytes_per_sec"] for p in _throughput_buffer],
        "error_rate": [p["error_rate"] for p in _throughput_buffer],
    }


@router.get("/consumer-groups")
def list_consumer_groups(_: object = Depends(get_current_user)):
    """List Kafka consumer groups with lag info."""
    for cg in _CONSUMER_GROUPS:
        cg["lag"] = random.randint(0, 50) if random.random() > 0.7 else 0
        cg["state"] = "stable" if cg["lag"] < 50 else "rebalancing"
    return _CONSUMER_GROUPS


@router.get("/summary")
def streaming_summary(_: object = Depends(get_current_user)):
    """Aggregated streaming platform summary."""
    total_msgs_per_min = sum(t["messages_per_min"] for t in _TOPICS)
    current_eps = _throughput_buffer[-1]["events_per_sec"] if _throughput_buffer else 240
    return {
        "total_topics": len(_TOPICS),
        "active_topics": len(_TOPICS),
        "total_partitions": sum(t["partitions"] for t in _TOPICS),
        "total_messages_per_min": total_msgs_per_min,
        "total_consumer_groups": len(_CONSUMER_GROUPS),
        "consumer_groups": len(_CONSUMER_GROUPS),
        "total_consumers": sum(cg["members"] for cg in _CONSUMER_GROUPS),
        "total_lag": sum(cg["lag"] for cg in _CONSUMER_GROUPS),
        "avg_events_per_sec": current_eps,
        "events_per_second": current_eps,
        "total_events_per_sec": current_eps,
        "total_events_24h": 412_890_000,
        "status": "healthy",
        "timestamp": datetime.now(UTC).isoformat(),
    }
