from typing import Any
import numpy as np
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.repositories.dataset import DatasetRepository
from app.services.profiling_service import ProfilingService

router = APIRouter()

# ── Built-in mock business data (used when no dataset is uploaded) ────────────
_MOCK_KPIS = {
    "revenue": {"value": 5_180_000, "prev": 4_726_000, "change_pct": 9.6, "trend": "up"},
    "customers": {"value": 24_812, "prev": 19_850, "change_pct": 25.0, "trend": "up"},
    "churn_rate": {"value": 2.1, "prev": 2.6, "change_pct": -0.5, "trend": "up"},
    "avg_order_value": {"value": 208.74, "prev": 198.32, "change_pct": 5.3, "trend": "up"},
    "conversion_rate": {"value": 4.2, "prev": 3.8, "change_pct": 10.5, "trend": "up"},
    "nps": {"value": 72, "prev": 65, "change_pct": 10.8, "trend": "up"},
}

_MOCK_TIMESERIES: dict[str, list] = {
    "timestamps": [f"Day {i+1}" for i in range(30)],
    "revenue": [round(150_000 + i * 1_200 + (i % 7) * 3_000, 2) for i in range(30)],
    "customers": [int(800 + i * 12 + (i % 7) * 30) for i in range(30)],
    "events": [int(1_200_000 + i * 5000 + (i % 7) * 20000) for i in range(30)],
    "api_requests": [int(40000 + i * 200 + (i % 7) * 500) for i in range(30)],
}

_MOCK_SEGMENTS = [
    {"segment": "Enterprise", "customers": 990, "revenue_share": 41.2, "avg_ltv": 12500, "growth_pct": 18.4},
    {"segment": "Mid-Market", "customers": 4_820, "revenue_share": 32.6, "avg_ltv": 3_500, "growth_pct": 12.1},
    {"segment": "SMB", "customers": 15_340, "revenue_share": 20.8, "avg_ltv": 720, "growth_pct": 8.7},
    {"segment": "Startup", "customers": 3_662, "revenue_share": 5.4, "avg_ltv": 280, "growth_pct": 32.5},
]

_MOCK_TOP_PRODUCTS = [
    {"rank": 1, "product": "AI Analytics Suite Pro", "revenue": 2_140_000, "units": 142, "margin_pct": 72.4, "growth_pct": 28.2},
    {"rank": 2, "product": "Data Pipeline Engine", "revenue": 980_000, "units": 327, "margin_pct": 61.8, "growth_pct": 14.6},
    {"rank": 3, "product": "ML Platform Starter", "revenue": 760_000, "units": 1_520, "margin_pct": 55.2, "growth_pct": 22.1},
    {"rank": 4, "product": "Real-Time Streaming", "revenue": 640_000, "units": 213, "margin_pct": 68.9, "growth_pct": 38.4},
    {"rank": 5, "product": "Enterprise Security Add-on", "revenue": 410_000, "units": 410, "margin_pct": 81.2, "growth_pct": 11.3},
]

_MOCK_REGIONS = [
    {"region": "North America", "revenue": 2_280_000, "customers": 10_840, "growth_pct": 9.2},
    {"region": "Europe", "revenue": 1_420_000, "customers": 7_120, "growth_pct": 14.8},
    {"region": "Asia Pacific", "revenue": 980_000, "customers": 5_340, "growth_pct": 38.6},
    {"region": "Latin America", "revenue": 320_000, "customers": 1_120, "growth_pct": 22.4},
    {"region": "Middle East & Africa", "revenue": 180_000, "customers": 392, "growth_pct": 18.9},
]

_MOCK_FUNNEL = [
    {"stage": "Visitors", "count": 120_000, "conversion_pct": 100},
    {"stage": "Sign-ups", "count": 18_600, "conversion_pct": 15.5},
    {"stage": "Trial Activated", "count": 8_200, "conversion_pct": 44.1},
    {"stage": "Paid Conversion", "count": 5_040, "conversion_pct": 61.5},
    {"stage": "Retained (90d)", "count": 4_090, "conversion_pct": 81.2},
]


def _try_load_df(dataset_id: int | None, db: Session):
    if dataset_id is None:
        return None
    dataset = DatasetRepository(db).get_by_id(dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    try:
        return ProfilingService().load_dataset(dataset.file_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load dataset: {e}")


@router.get("/kpis")
def get_kpis(
    dataset_id: int | None = None,
    period: int = 30,
    db: Session = Depends(get_db),
    _: object = Depends(get_current_user),
):
    df = _try_load_df(dataset_id, db)
    if df is None:
        return _MOCK_KPIS

    num_cols = df.select_dtypes(include=np.number).columns
    revenue = float(df[num_cols[0]].sum()) if len(num_cols) > 0 else 0.0
    customers = len(df)
    churn = float(df[num_cols[1]].mean()) if len(num_cols) > 1 else 5.2
    aov = float(df[num_cols[2]].mean()) if len(num_cols) > 2 else (revenue / customers if customers > 0 else 0)

    return {
        "revenue": {"value": revenue, "prev": revenue * 0.9, "change_pct": 10.5, "trend": "up"},
        "customers": {"value": customers, "prev": customers * 0.8, "change_pct": 25.0, "trend": "up"},
        "churn_rate": {"value": round(churn, 1), "prev": churn + 1.2, "change_pct": -1.2, "trend": "up"},
        "avg_order_value": {"value": round(aov, 2), "prev": round(aov * 0.95, 2), "change_pct": 5.2, "trend": "up"},
        "conversion_rate": {"value": 4.2, "prev": 3.8, "change_pct": 0.4, "trend": "up"},
        "nps": {"value": 72, "prev": 65, "change_pct": 7.0, "trend": "up"},
    }


@router.get("/timeseries")
def get_timeseries(
    dataset_id: int | None = None,
    metric: str = "revenue",
    period: int = 30,
    db: Session = Depends(get_db),
    _: object = Depends(get_current_user),
):
    df = _try_load_df(dataset_id, db)
    if df is None:
        timestamps = _MOCK_TIMESERIES["timestamps"][-period:]
        values_key = metric if metric in _MOCK_TIMESERIES else "revenue"
        values = _MOCK_TIMESERIES[values_key][-period:]
        return {"metric": metric, "period_days": period, "timestamps": timestamps, "values": values}

    num_cols = df.select_dtypes(include=np.number).columns
    if not len(num_cols):
        return {"metric": metric, "period_days": period, "timestamps": [], "values": []}

    col = num_cols[0]
    vals = df[col].dropna().values
    n = min(period, len(vals))
    ts_vals = vals[-n:].tolist()
    timestamps = [f"Day {i+1}" for i in range(n)]
    return {"metric": metric, "period_days": n, "timestamps": timestamps, "values": ts_vals}


@router.get("/segments")
def get_segments(
    dataset_id: int | None = None,
    db: Session = Depends(get_db),
    _: object = Depends(get_current_user),
):
    df = _try_load_df(dataset_id, db)
    if df is None:
        return _MOCK_SEGMENTS

    cat_cols = df.select_dtypes(exclude=np.number).columns
    if len(cat_cols) == 0:
        return [{"segment": "Default", "customers": len(df), "revenue_share": 100.0, "avg_ltv": 0, "growth_pct": 0}]

    counts = df[cat_cols[0]].value_counts().head(4)
    total = len(df)
    return [
        {
            "segment": str(k),
            "customers": int(v),
            "revenue_share": round((v / total) * 100, 1),
            "avg_ltv": 500,
            "growth_pct": 5.0,
        }
        for k, v in counts.items()
    ]


@router.get("/top-products")
def get_top_products(
    dataset_id: int | None = None,
    db: Session = Depends(get_db),
    _: object = Depends(get_current_user),
):
    df = _try_load_df(dataset_id, db)
    if df is None:
        return _MOCK_TOP_PRODUCTS

    cat_cols = df.select_dtypes(exclude=np.number).columns
    num_cols = df.select_dtypes(include=np.number).columns
    if len(cat_cols) == 0 or len(num_cols) == 0:
        return []

    grouped = df.groupby(cat_cols[0])[num_cols[0]].sum().sort_values(ascending=False).head(10)
    return [
        {
            "rank": i + 1,
            "product": str(k),
            "revenue": float(v),
            "units": int(v / 10),
            "margin_pct": 25.0,
            "growth_pct": 12.0,
        }
        for i, (k, v) in enumerate(grouped.items())
    ]


@router.get("/funnel")
def get_funnel(_: object = Depends(get_current_user)):
    return _MOCK_FUNNEL


@router.get("/regions")
def get_regions(
    dataset_id: int | None = None,
    db: Session = Depends(get_db),
    _: object = Depends(get_current_user),
):
    df = _try_load_df(dataset_id, db)
    if df is None:
        return _MOCK_REGIONS

    cat_cols = df.select_dtypes(exclude=np.number).columns
    num_cols = df.select_dtypes(include=np.number).columns
    col_idx = 1 if len(cat_cols) > 1 else 0
    if len(cat_cols) == 0 or len(num_cols) == 0:
        return []

    grouped = df.groupby(cat_cols[col_idx])[num_cols[0]].sum().sort_values(ascending=False).head(5)
    return [
        {
            "region": str(k),
            "revenue": float(v),
            "customers": int(v / 50),
            "growth_pct": 8.0,
        }
        for k, v in grouped.items()
    ]
