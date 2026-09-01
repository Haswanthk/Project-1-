from typing import Any
from datetime import timedelta
import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sklearn.linear_model import LinearRegression

from app.core.deps import get_current_user, get_db
from app.repositories.dataset import DatasetRepository
from app.services.profiling_service import ProfilingService

router = APIRouter()

class ForecastRequest(BaseModel):
    dataset_id: int
    target_column: str
    date_column: str | None = None
    horizon: int = 30

@router.post("/run")
def run_forecast(payload: ForecastRequest, db: Session = Depends(get_db), _: object = Depends(get_current_user)):
    dataset = DatasetRepository(db).get_by_id(payload.dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    profiling_service = ProfilingService()
    try:
        df = profiling_service.load_dataset(dataset.file_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load dataset: {e}")

    if payload.target_column not in df.columns:
        raise HTTPException(status_code=400, detail="Target column not found in dataset")
        
    if not pd.api.types.is_numeric_dtype(df[payload.target_column]):
        raise HTTPException(status_code=400, detail="Target column must be numeric")

    df = df.dropna(subset=[payload.target_column])
    
    timestamps = []
    if payload.date_column and payload.date_column in df.columns:
        df[payload.date_column] = pd.to_datetime(df[payload.date_column], errors='coerce')
        df = df.dropna(subset=[payload.date_column])
        df = df.sort_values(payload.date_column)
        timestamps = df[payload.date_column].dt.strftime('%Y-%m-%d').tolist()
    else:
        timestamps = [f"Step {i+1}" for i in range(len(df))]

    y = df[payload.target_column].values
    n = len(y)
    
    if n < 5:
        raise HTTPException(status_code=400, detail="Not enough data points for forecasting (need at least 5)")

    X = np.arange(n).reshape(-1, 1)
    
    model = LinearRegression()
    model.fit(X, y)
    
    # historical predictions for metrics
    y_pred = model.predict(X)
    mape = np.mean(np.abs((y - y_pred) / (y + 1e-9))) * 100
    mae = np.mean(np.abs(y - y_pred))
    
    # forecast
    X_future = np.arange(n, n + payload.horizon).reshape(-1, 1)
    y_future = model.predict(X_future)
    
    # generate future timestamps
    future_timestamps = []
    if payload.date_column and payload.date_column in df.columns:
        last_date = df[payload.date_column].iloc[-1]
        for i in range(1, payload.horizon + 1):
            next_date = last_date + timedelta(days=i)
            future_timestamps.append(next_date.strftime('%Y-%m-%d'))
    else:
        future_timestamps = [f"Step {n+i+1}" for i in range(payload.horizon)]
        
    std_dev = np.std(y - y_pred)
    # confidence interval expands slightly over time
    lower_bound = [val - (std_dev * 1.96 * (1 + i*0.02)) for i, val in enumerate(y_future)]
    upper_bound = [val + (std_dev * 1.96 * (1 + i*0.02)) for i, val in enumerate(y_future)]

    direction = "neutral"
    change_pct = 0
    if y_future[0] != 0:
        change_pct = ((y_future[-1] - y_future[0]) / abs(y_future[0])) * 100
        if change_pct > 1: direction = "upward"
        elif change_pct < -1: direction = "downward"

    return {
        "metric": payload.target_column,
        "label": payload.target_column.replace("_", " ").title(),
        "unit": "",
        "algorithm": "Linear Trend Model",
        "model_performance": {"mape": round(mape, 2), "mae": round(mae, 2)},
        "historical": {"timestamps": timestamps, "values": y.tolist()},
        "forecast": {
            "timestamps": future_timestamps,
            "values": y_future.tolist(),
            "lower_bound": lower_bound,
            "upper_bound": upper_bound,
        },
        "summary": {
            "direction": direction,
            "horizon_days": payload.horizon,
            "projected_change_pct": change_pct,
            "confidence_level": 95,
        },
    }

