from typing import Any
from datetime import timedelta
import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import PolynomialFeatures

from app.core.deps import get_current_user, get_db
from app.repositories.dataset import DatasetRepository
from app.services.profiling_service import ProfilingService

router = APIRouter()

# ── Built-in mock metrics available without a dataset ────────────────────────
_MOCK_METRICS = [
    {"id": "revenue", "label": "Revenue", "unit": "$", "description": "Daily revenue in USD"},
    {"id": "events", "label": "Events / min", "unit": "events/min", "description": "Streaming event throughput"},
    {"id": "api_requests", "label": "API Requests", "unit": "req/hr", "description": "Hourly API request volume"},
    {"id": "churn_rate", "label": "Churn Rate", "unit": "%", "description": "Monthly customer churn rate"},
    {"id": "customers", "label": "Customers", "unit": "count", "description": "Active customer count"},
]

_MOCK_SERIES: dict[str, tuple[list[float], str]] = {
    "revenue": ([round(150_000 + i * 1_200 + (i % 7) * 3_000, 2) for i in range(60)], "$"),
    "events": ([float(int(1_200_000 + i * 5_000 + (i % 7) * 20_000)) for i in range(60)], "events/min"),
    "api_requests": ([float(int(40_000 + i * 200 + (i % 7) * 500)) for i in range(60)], "req/hr"),
    "churn_rate": ([round(2.8 - i * 0.012 + (i % 5) * 0.02, 3) for i in range(60)], "%"),
    "customers": ([float(int(18_000 + i * 120 + (i % 7) * 200)) for i in range(60)], "count"),
}

_AVAILABLE_ALGORITHMS = [
    {"id": "linear", "name": "Linear Trend Model", "description": "Simple linear regression on sequential data"},
    {"id": "polynomial", "name": "Polynomial Trend Model", "description": "Polynomial regression (degree 2-3) for capturing non-linear trends"},
    {"id": "moving_average", "name": "Moving Average", "description": "Weighted moving average with trend extrapolation"},
]


class ForecastRequest(BaseModel):
    dataset_id: int | None = None
    target_column: str
    date_column: str | None = None
    horizon: int = 30
    algorithm: str = "linear"  # linear | polynomial | moving_average


def _linear_forecast(y: np.ndarray, horizon: int) -> tuple:
    n = len(y)
    X = np.arange(n).reshape(-1, 1)
    model = LinearRegression()
    model.fit(X, y)
    y_pred = model.predict(X)
    mape = float(np.mean(np.abs((y - y_pred) / (y + 1e-9))) * 100)
    mae = float(np.mean(np.abs(y - y_pred)))
    X_future = np.arange(n, n + horizon).reshape(-1, 1)
    y_future = model.predict(X_future)
    std_dev = float(np.std(y - y_pred))
    lower = [float(val - std_dev * 1.96 * (1 + i * 0.02)) for i, val in enumerate(y_future)]
    upper = [float(val + std_dev * 1.96 * (1 + i * 0.02)) for i, val in enumerate(y_future)]
    return y_future, y_pred, lower, upper, mape, mae, "Linear Trend Model"


def _polynomial_forecast(y: np.ndarray, horizon: int, degree: int = 3) -> tuple:
    n = len(y)
    X = np.arange(n).reshape(-1, 1)
    poly = PolynomialFeatures(degree=degree, include_bias=False)
    X_poly = poly.fit_transform(X)
    model = LinearRegression()
    model.fit(X_poly, y)
    y_pred = model.predict(X_poly)
    mape = float(np.mean(np.abs((y - y_pred) / (y + 1e-9))) * 100)
    mae = float(np.mean(np.abs(y - y_pred)))
    X_future = np.arange(n, n + horizon).reshape(-1, 1)
    X_future_poly = poly.transform(X_future)
    y_future = model.predict(X_future_poly)
    std_dev = float(np.std(y - y_pred))
    lower = [float(val - std_dev * 1.96 * (1 + i * 0.03)) for i, val in enumerate(y_future)]
    upper = [float(val + std_dev * 1.96 * (1 + i * 0.03)) for i, val in enumerate(y_future)]
    return y_future, y_pred, lower, upper, mape, mae, f"Polynomial Trend Model (degree={degree})"


def _moving_average_forecast(y: np.ndarray, horizon: int, window: int = 7) -> tuple:
    n = len(y)
    # Compute moving average for fitted values
    ma = np.convolve(y, np.ones(window) / window, mode='valid')
    # Pad beginning with NaN-free values
    y_pred = np.concatenate([y[:window - 1], ma])
    mape = float(np.mean(np.abs((y[window - 1:] - ma) / (y[window - 1:] + 1e-9))) * 100)
    mae = float(np.mean(np.abs(y[window - 1:] - ma)))

    # Extrapolate using trend from last window
    last_vals = y[-window:]
    # Calculate weighted trend (recent values count more)
    weights = np.arange(1, window + 1, dtype=float)
    weights /= weights.sum()
    weighted_mean = float(np.sum(last_vals * weights))
    # Linear trend in last window
    trend_x = np.arange(window).reshape(-1, 1)
    trend_model = LinearRegression()
    trend_model.fit(trend_x, last_vals)
    slope = float(trend_model.coef_[0])

    y_future = np.array([weighted_mean + slope * (i + 1) for i in range(horizon)])
    std_dev = float(np.std(y[-window:]))
    lower = [float(val - std_dev * 1.96 * (1 + i * 0.04)) for i, val in enumerate(y_future)]
    upper = [float(val + std_dev * 1.96 * (1 + i * 0.04)) for i, val in enumerate(y_future)]
    return y_future, y_pred, lower, upper, mape, mae, f"Moving Average (window={window})"


@router.get("/metrics")
def list_metrics(
    dataset_id: int | None = None,
    db: Session = Depends(get_db),
    _: object = Depends(get_current_user),
):
    """List available metrics for forecasting."""
    if dataset_id is None:
        return _MOCK_METRICS

    dataset = DatasetRepository(db).get_by_id(dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    try:
        df = ProfilingService().load_dataset(dataset.file_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load dataset: {e}")

    num_cols = df.select_dtypes(include=np.number).columns
    return [
        {"id": col, "label": col.replace("_", " ").title(), "unit": "", "description": f"Column '{col}' from {dataset.name}"}
        for col in num_cols
    ]


@router.get("/algorithms")
def list_forecast_algorithms(_: object = Depends(get_current_user)):
    """Return available forecasting algorithms."""
    return _AVAILABLE_ALGORITHMS


@router.post("/run")
def run_forecast(
    payload: ForecastRequest,
    db: Session = Depends(get_db),
    _: object = Depends(get_current_user),
):
    # ── Mock mode: use built-in data ──────────────────────────────────────────
    if payload.dataset_id is None:
        metric_key = payload.target_column if payload.target_column in _MOCK_SERIES else "revenue"
        y_all, unit = _MOCK_SERIES[metric_key]
        y = np.array(y_all)
        n = len(y)

        y_future, y_pred, lower, upper, mape, mae, algo_name = _dispatch_forecast(
            y, payload.horizon, payload.algorithm
        )

        change_pct = float(((y_future[-1] - y_future[0]) / abs(y_future[0])) * 100) if y_future[0] != 0 else 0.0
        direction = "upward" if change_pct > 1 else ("downward" if change_pct < -1 else "neutral")

        timestamps = [f"Day {i+1}" for i in range(n)]
        future_timestamps = [f"Day {n+i+1}" for i in range(payload.horizon)]

        metric_meta = next((m for m in _MOCK_METRICS if m["id"] == metric_key), _MOCK_METRICS[0])
        return {
            "metric": metric_key,
            "label": metric_meta["label"],
            "unit": unit,
            "algorithm": algo_name,
            "model_performance": {"mape": round(mape, 2), "mae": round(mae, 2)},
            "historical": {"timestamps": timestamps, "values": y.tolist()},
            "forecast": {
                "timestamps": future_timestamps,
                "values": y_future.tolist(),
                "lower_bound": lower,
                "upper_bound": upper,
            },
            "summary": {
                "direction": direction,
                "horizon_days": payload.horizon,
                "projected_change_pct": round(change_pct, 2),
                "confidence_level": 95,
            },
        }

    # ── Real dataset mode ─────────────────────────────────────────────────────
    dataset = DatasetRepository(db).get_by_id(payload.dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    try:
        df = ProfilingService().load_dataset(dataset.file_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load dataset: {e}")

    if payload.target_column not in df.columns:
        raise HTTPException(status_code=400, detail="Target column not found in dataset")

    if not pd.api.types.is_numeric_dtype(df[payload.target_column]):
        raise HTTPException(status_code=400, detail="Target column must be numeric")

    df = df.dropna(subset=[payload.target_column])

    timestamps = []
    if payload.date_column and payload.date_column in df.columns:
        df[payload.date_column] = pd.to_datetime(df[payload.date_column], errors="coerce")
        df = df.dropna(subset=[payload.date_column]).sort_values(payload.date_column)
        timestamps = df[payload.date_column].dt.strftime("%Y-%m-%d").tolist()
    else:
        timestamps = [f"Step {i+1}" for i in range(len(df))]

    y = df[payload.target_column].values
    n = len(y)

    if n < 5:
        raise HTTPException(status_code=400, detail="Need at least 5 data points for forecasting")

    y_future, y_pred, lower, upper, mape, mae, algo_name = _dispatch_forecast(
        y, payload.horizon, payload.algorithm
    )

    if payload.date_column and payload.date_column in df.columns:
        last_date = df[payload.date_column].iloc[-1]
        future_timestamps = [(last_date + timedelta(days=i+1)).strftime("%Y-%m-%d") for i in range(payload.horizon)]
    else:
        future_timestamps = [f"Step {n+i+1}" for i in range(payload.horizon)]

    change_pct = float(((y_future[-1] - y_future[0]) / abs(y_future[0])) * 100) if y_future[0] != 0 else 0.0
    direction = "upward" if change_pct > 1 else ("downward" if change_pct < -1 else "neutral")

    return {
        "metric": payload.target_column,
        "label": payload.target_column.replace("_", " ").title(),
        "unit": "",
        "algorithm": algo_name,
        "model_performance": {"mape": round(mape, 2), "mae": round(mae, 2)},
        "historical": {"timestamps": timestamps, "values": y.tolist()},
        "forecast": {
            "timestamps": future_timestamps,
            "values": y_future.tolist(),
            "lower_bound": lower,
            "upper_bound": upper,
        },
        "summary": {
            "direction": direction,
            "horizon_days": payload.horizon,
            "projected_change_pct": round(change_pct, 2),
            "confidence_level": 95,
        },
    }


def _dispatch_forecast(y: np.ndarray, horizon: int, algorithm: str) -> tuple:
    """Route to the correct forecasting algorithm."""
    algo = algorithm.lower()
    if algo == "polynomial":
        return _polynomial_forecast(y, horizon)
    elif algo in ("moving_average", "ma"):
        window = min(7, len(y) // 2) if len(y) > 4 else 2
        return _moving_average_forecast(y, horizon, window=window)
    else:
        return _linear_forecast(y, horizon)
