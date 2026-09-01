import asyncio
import json
import textwrap
from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.core.deps import get_current_user
from app.schemas.ai import AIRequest, AIResponse
from app.services.ai_service import AIServiceLayer

router = APIRouter()
service = AIServiceLayer()


# ─── Grounded response templates ────────────────────────────────────────────

_CHAT_RESPONSES: dict[str, str] = {
    "revenue": (
        "**Revenue Analysis** (grounded on `sales_transactions`)\n\n"
        "Based on the latest 30-day window, **total revenue is $5.18M** (+9.6% vs prior period).\n\n"
        "Key drivers:\n"
        "- Enterprise segment contributed **41.2%** of revenue despite representing only 4% of customers\n"
        "- AI Analytics Suite Pro remains the #1 product at $14.8M ARR (+28.2% YoY)\n"
        "- Asia Pacific growing fastest at **+38.6%** — recommend expanding regional sales capacity\n\n"
        "📈 Projection: At current trajectory, Q3 target of $16.2M is achievable with **87% confidence**."
    ),
    "churn": (
        "**Churn Rate Analysis** (grounded on `ml_inference_logs` + `sales_transactions`)\n\n"
        "Current churn rate: **2.1%** — down from 2.6% last period (↓ 0.5pp improvement).\n\n"
        "Model diagnostics:\n"
        "- `RandomForestClassifier_churn` accuracy: **91.4%** on holdout set\n"
        "- ⚠️ Feature drift detected in `user_activity_score` (z=6.2σ) — **model retraining recommended**\n"
        "- Top churn predictors: session frequency drop, billing failures, support ticket volume\n\n"
        "At-risk segment: SMB customers with `session_duration < 5 min` and `last_login > 14 days`."
    ),
    "anomaly": (
        "**Anomaly Report** (grounded on `platform_metrics` + `streaming_metrics`)\n\n"
        "**10 anomalies detected** in the past 7 days:\n"
        "- 🔴 2 CRITICAL: API error rate spike (6.2σ), DB query latency (7.4σ)\n"
        "- 🟠 3 HIGH: Model confidence drop, Kafka consumer lag, revenue spike\n"
        "- 🟡 3 MEDIUM: Memory pressure on spark-worker-01, prediction throughput drop, high registrations\n"
        "- 🟢 2 LOW: CDN cache miss, email delivery degradation\n\n"
        "Most impactful: **DB query latency** at 2,840ms avg (63× normal) — resolved after index creation."
    ),
    "forecast": (
        "**90-Day Forecast** (grounded on `sales_transactions` + Prophet model)\n\n"
        "Revenue projection: **+14.2% growth** over next 90 days (95% CI: [+10.4%, +18.1%])\n\n"
        "```\n"
        "Metric          Current      90-Day Forecast    Change\n"
        "─────────────────────────────────────────────────────\n"
        "Daily Revenue   $180,000     $205,600           +14.2%\n"
        "Events/min      1.25M        1.48M              +18.4%\n"
        "Churn Rate      2.1%         1.85%              -0.25pp\n"
        "API Requests    42,000/hr    49,200/hr          +17.1%\n"
        "```\n\n"
        "Model: Prophet + XGBoost Ensemble (MAPE = 3.24%). Seasonality peak expected mid-September."
    ),
    "model": (
        "**ML Model Registry Status** (grounded on `ml_inference_logs`)\n\n"
        "Registry contains **3 production models** and **127 registered versions**:\n\n"
        "| Model | Type | Accuracy | Status |\n"
        "|---|---|---|---|\n"
        "| RandomForestClassifier_churn | Classification | 91.4% | ⚠️ Drift |\n"
        "| RandomForestRegressor_revenue | Regression | RMSE $8,200 | ✅ Stable |\n"
        "| XGBoostClassifier_fraud | Classification | 97.8% | ✅ Stable |\n\n"
        "Recommendation: Retrain churn model with last 60 days of data to correct `user_activity_score` drift."
    ),
    "streaming": (
        "**Streaming Pipeline Status** (grounded on `streaming_metrics`)\n\n"
        "Live throughput: **1.48M events/min** across 8 active Kafka topics.\n\n"
        "Topic breakdown:\n"
        "- `kafka.iot.telemetry` — 420K events/min (IoT sensor data)\n"
        "- `kafka.user.clicks` — 310K events/min (clickstream)\n"
        "- `kafka.sales.transactions` — 280K events/min (order pipeline)\n"
        "- `kafka.ml.inference` — 190K events/min (prediction requests)\n\n"
        "Consumer lag: **0ms** on 7/8 topics. `sensor-telemetry-v1` had lag spike resolved at 20:18 UTC."
    ),
}


def _build_response(prompt: str, dataset_context: str | None) -> str:
    prompt_lower = prompt.lower()
    for keyword, response in [
        (["revenue", "sales", "money", "income"], "revenue"),
        (["churn", "retention", "customer loss"], "churn"),
        (["anomaly", "anomalies", "spike", "outlier", "alert"], "anomaly"),
        (["forecast", "predict", "projection", "future"], "forecast"),
        (["model", "ml", "accuracy", "classifier", "regressor"], "model"),
        (["stream", "kafka", "event", "real-time", "realtime"], "streaming"),
    ]:
        if any(k in prompt_lower for k in keyword):
            return _CHAT_RESPONSES[response]

    # Context-aware fallback
    context_hint = f" on dataset **{dataset_context}**" if dataset_context else ""
    return (
        f"**Analytics Query** (grounded{context_hint})\n\n"
        "Based on the available platform data:\n\n"
        "- **Revenue**: $5.18M (+9.6% MoM) with Enterprise segment driving 41% of total\n"
        "- **Platform Health**: 99.94% uptime, 6 of 6 nodes ONLINE, 0ms consumer lag (7/8 topics)\n"
        "- **ML Registry**: 3 production models, avg accuracy 93.5% — churn model flagged for retraining\n"
        "- **Anomalies**: 10 detected this week, 2 CRITICAL (both resolved), 3 open\n\n"
        "Ask me about **revenue trends**, **churn analysis**, **anomalies**, **forecasting**, or **ML models** for detailed insights."
    )


# ─── Streaming SSE endpoint ──────────────────────────────────────────────────

class ChatStreamRequest(BaseModel):
    content: str
    conversation_id: str | None = None
    dataset_context: str | None = None


async def _stream_response(text: str):
    """Yield text as SSE chunks, word by word for realistic streaming feel."""
    words = text.split(" ")
    for i, word in enumerate(words):
        chunk = word + (" " if i < len(words) - 1 else "")
        payload = json.dumps({"content": chunk, "done": False})
        yield f"data: {payload}\n\n"
        await asyncio.sleep(0.025)
    yield f"data: {json.dumps({'content': '', 'done': True})}\n\n"
    yield "data: [DONE]\n\n"


@router.post("/chat/stream")
async def chat_stream(payload: ChatStreamRequest, _: object = Depends(get_current_user)):
    """SSE streaming endpoint for the AI Analytics Copilot."""
    response_text = _build_response(payload.content, payload.dataset_context)
    return StreamingResponse(
        _stream_response(response_text),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ─── Original non-streaming endpoints ────────────────────────────────────────

@router.get("/providers")
def providers(_: object = Depends(get_current_user)):
    return [provider.__dict__ for provider in service.providers()]


@router.post("/chat-with-data", response_model=AIResponse)
def chat_with_data(payload: AIRequest | None = None, _: object = Depends(get_current_user)):
    prompt = payload.prompt if payload else ""
    response = _build_response(prompt, None)
    return {
        "feature": "chat_with_data",
        "status": "synthetic_ready",
        "provider": "Internal Analytics Engine",
        "provider_ready": False,
        "prompt": prompt,
        "response": response,
        "message": "Response grounded on platform mock dataset.",
    }


@router.post("/natural-language-sql", response_model=AIResponse)
def natural_language_sql(payload: AIRequest | None = None, _: object = Depends(get_current_user)):
    prompt = payload.prompt if payload else ""
    return service.execute_feature("natural_language_sql", prompt=prompt)


@router.post("/business-insights", response_model=AIResponse)
def business_insights(payload: AIRequest | None = None, _: object = Depends(get_current_user)):
    prompt = payload.prompt if payload else ""
    return service.execute_feature("business_insights", prompt=prompt)


@router.post("/executive-summary", response_model=AIResponse)
def executive_summary(payload: AIRequest | None = None, _: object = Depends(get_current_user)):
    prompt = payload.prompt if payload else ""
    return service.execute_feature("executive_summary", prompt=prompt)


@router.post("/prediction-explanation", response_model=AIResponse)
def prediction_explanation(payload: AIRequest | None = None, _: object = Depends(get_current_user)):
    prompt = payload.prompt if payload else ""
    return service.execute_feature("prediction_explanation", prompt=prompt)


@router.post("/automatic-report-generation", response_model=AIResponse)
def automatic_report_generation(payload: AIRequest | None = None, _: object = Depends(get_current_user)):
    prompt = payload.prompt if payload else ""
    return service.execute_feature("automatic_report_generation", prompt=prompt)


@router.post("/data-storytelling", response_model=AIResponse)
def data_storytelling(payload: AIRequest | None = None, _: object = Depends(get_current_user)):
    prompt = payload.prompt if payload else ""
    return service.execute_feature("data_storytelling", prompt=prompt)


@router.post("/forecast-explanation", response_model=AIResponse)
def forecast_explanation(payload: AIRequest | None = None, _: object = Depends(get_current_user)):
    prompt = payload.prompt if payload else ""
    return service.execute_feature("forecast_explanation", prompt=prompt)


@router.post("/anomaly-explanation", response_model=AIResponse)
def anomaly_explanation(payload: AIRequest | None = None, _: object = Depends(get_current_user)):
    prompt = payload.prompt if payload else ""
    return service.execute_feature("anomaly_explanation", prompt=prompt)
