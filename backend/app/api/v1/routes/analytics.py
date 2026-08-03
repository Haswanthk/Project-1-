import random
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends

from app.core.deps import get_current_user

router = APIRouter()


def _generate_kpis(period_days: int) -> dict[str, Any]:
    base = {
        7:  {"revenue": 1_240_500, "prev_revenue": 1_102_300, "customers": 3_812, "prev_customers": 3_540, "churn_rate": 2.4, "prev_churn": 2.9, "aov": 325.10, "prev_aov": 311.20},
        30: {"revenue": 5_182_400, "prev_revenue": 4_730_000, "customers": 15_204, "prev_customers": 13_980, "churn_rate": 2.1, "prev_churn": 2.6, "aov": 340.50, "prev_aov": 328.90},
        90: {"revenue": 15_640_000, "prev_revenue": 13_820_000, "customers": 44_800, "prev_customers": 39_200, "churn_rate": 1.9, "prev_churn": 2.3, "aov": 349.20, "prev_aov": 352.40},
        365: {"revenue": 62_800_000, "prev_revenue": 54_200_000, "customers": 182_000, "prev_customers": 156_000, "churn_rate": 1.7, "prev_churn": 2.0, "aov": 344.90, "prev_aov": 347.10},
    }
    d = base.get(period_days, base[30])

    def pct_change(curr, prev):
        return round((curr - prev) / prev * 100, 2)

    return {
        "revenue": {"value": d["revenue"], "prev": d["prev_revenue"], "change_pct": pct_change(d["revenue"], d["prev_revenue"]), "trend": "up"},
        "customers": {"value": d["customers"], "prev": d["prev_customers"], "change_pct": pct_change(d["customers"], d["prev_customers"]), "trend": "up"},
        "churn_rate": {"value": d["churn_rate"], "prev": d["prev_churn"], "change_pct": pct_change(d["churn_rate"], d["prev_churn"]), "trend": "down"},
        "avg_order_value": {"value": d["aov"], "prev": d["prev_aov"], "change_pct": pct_change(d["aov"], d["prev_aov"]), "trend": "up" if d["aov"] > d["prev_aov"] else "down"},
        "conversion_rate": {"value": 3.82, "prev": 3.54, "change_pct": 7.91, "trend": "up"},
        "nps": {"value": 67, "prev": 61, "change_pct": 9.84, "trend": "up"},
    }


def _generate_timeseries(metric: str, period_days: int) -> dict[str, Any]:
    seeds = {
        "revenue": (180_000, 12_000),
        "customers": (520, 60),
        "events": (1_200_000, 80_000),
        "api_requests": (42_000, 5_000),
        "churn": (0.08, 0.02),
    }
    base, noise = seeds.get(metric, (1000, 100))
    now = datetime.now(UTC)
    points = min(period_days, 90)
    timestamps, values = [], []
    v = base
    for i in range(points):
        ts = now - timedelta(days=points - i)
        v = max(0, v + random.gauss(0, noise))
        timestamps.append(ts.strftime("%Y-%m-%d"))
        values.append(round(v, 2))
    return {"metric": metric, "period_days": period_days, "timestamps": timestamps, "values": values}


_SEGMENTS = [
    {"segment": "Enterprise",   "customers": 1_820, "revenue_share": 41.2, "avg_ltv": 28_400, "growth_pct": 18.4},
    {"segment": "Mid-Market",   "customers": 6_340, "revenue_share": 31.8, "avg_ltv": 9_200,  "growth_pct": 12.1},
    {"segment": "SMB",          "customers": 22_800, "revenue_share": 19.6, "avg_ltv": 2_800,  "growth_pct": 8.7},
    {"segment": "Startup",      "customers": 13_240, "revenue_share": 7.4,  "avg_ltv": 980,   "growth_pct": 24.3},
]

_TOP_PRODUCTS = [
    {"rank": 1, "product": "AI Analytics Suite Pro",      "revenue": 14_820_000, "units": 3_241, "margin_pct": 72.4, "growth_pct": 28.2},
    {"rank": 2, "product": "Data Pipeline Orchestrator",  "revenue": 9_640_000,  "units": 2_180, "margin_pct": 68.1, "growth_pct": 19.5},
    {"rank": 3, "product": "ML Model Registry",           "revenue": 7_230_000,  "units": 1_820, "margin_pct": 74.8, "growth_pct": 34.1},
    {"rank": 4, "product": "Real-Time Streaming Engine",  "revenue": 6_180_000,  "units": 1_540, "margin_pct": 65.3, "growth_pct": 15.8},
    {"rank": 5, "product": "AutoML Training Platform",    "revenue": 5_420_000,  "units": 1_280, "margin_pct": 71.2, "growth_pct": 22.6},
    {"rank": 6, "product": "Enterprise Data Catalog",     "revenue": 4_920_000,  "units": 1_140, "margin_pct": 69.5, "growth_pct": 11.4},
    {"rank": 7, "product": "BI Insights Dashboard",       "revenue": 3_840_000,  "units": 980,   "margin_pct": 66.9, "growth_pct": 9.2},
    {"rank": 8, "product": "Anomaly Detection Module",    "revenue": 2_940_000,  "units": 720,   "margin_pct": 73.1, "growth_pct": 41.8},
    {"rank": 9, "product": "NLP Query Interface",         "revenue": 2_180_000,  "units": 540,   "margin_pct": 78.4, "growth_pct": 52.3},
    {"rank": 10,"product": "Compliance & Audit Engine",   "revenue": 1_640_000,  "units": 420,   "margin_pct": 61.2, "growth_pct": 7.8},
]

_FUNNEL = [
    {"stage": "Website Visits",    "count": 820_000, "conv_from_prev": None},
    {"stage": "Free Trial",        "count": 24_600,  "conv_from_prev": 3.0},
    {"stage": "Product Qualified", "count": 8_610,   "conv_from_prev": 35.0},
    {"stage": "Sales Demo",        "count": 3_444,   "conv_from_prev": 40.0},
    {"stage": "Proposal Sent",     "count": 1_722,   "conv_from_prev": 50.0},
    {"stage": "Closed Won",        "count": 861,     "conv_from_prev": 50.0},
]

_REGIONS = [
    {"region": "North America", "revenue": 28_400_000, "customers": 72_800, "growth_pct": 16.2},
    {"region": "Europe",        "revenue": 18_200_000, "customers": 48_400, "growth_pct": 21.4},
    {"region": "Asia Pacific",  "revenue": 10_400_000, "customers": 42_000, "growth_pct": 38.6},
    {"region": "Latin America", "revenue": 3_800_000,  "customers": 13_400, "growth_pct": 29.1},
    {"region": "Middle East",   "revenue": 2_000_000,  "customers": 5_400,  "growth_pct": 44.2},
]


@router.get("/kpis")
def get_kpis(period: int = 30, _: object = Depends(get_current_user)):
    """Business KPI summary for a given period (7, 30, 90, 365 days)."""
    return _generate_kpis(period)


@router.get("/timeseries")
def get_timeseries(metric: str = "revenue", period: int = 30, _: object = Depends(get_current_user)):
    """Time-series values for a given metric and period."""
    return _generate_timeseries(metric, period)


@router.get("/segments")
def get_segments(_: object = Depends(get_current_user)):
    return _SEGMENTS


@router.get("/top-products")
def get_top_products(_: object = Depends(get_current_user)):
    return _TOP_PRODUCTS


@router.get("/funnel")
def get_funnel(_: object = Depends(get_current_user)):
    return _FUNNEL


@router.get("/regions")
def get_regions(_: object = Depends(get_current_user)):
    return _REGIONS
