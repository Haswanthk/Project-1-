from fastapi import APIRouter

from app.api.v1.routes import (
    admin, ai, analytics, anomaly, auth, datasets, forecast,
    ml, monitoring, notifications, projects, rag, reports, sources, spark, users, ws,
)

api_router = APIRouter()
api_router.include_router(auth.router,          prefix="/auth",         tags=["auth"])
api_router.include_router(users.router,         prefix="/users",        tags=["users"])
api_router.include_router(projects.router,      prefix="/projects",     tags=["projects"])
api_router.include_router(datasets.router,      prefix="/datasets",     tags=["datasets"])
api_router.include_router(sources.router,       prefix="/sources",      tags=["data-sources"])
api_router.include_router(ml.router,            prefix="/ml",           tags=["ml"])
api_router.include_router(ai.router,            prefix="/ai",           tags=["ai"])
api_router.include_router(rag.router,           prefix="/rag",          tags=["rag-placeholders"])
api_router.include_router(analytics.router,     prefix="/analytics",    tags=["analytics"])
api_router.include_router(anomaly.router,       prefix="/anomalies",    tags=["anomaly-detection"])
api_router.include_router(forecast.router,      prefix="/forecast",     tags=["forecasting"])
api_router.include_router(monitoring.router,    prefix="/monitoring",   tags=["monitoring"])
api_router.include_router(ws.router,            prefix="/realtime",     tags=["realtime"])
api_router.include_router(reports.router,       prefix="/reports",      tags=["reports"])
api_router.include_router(spark.router,         prefix="/spark",        tags=["spark"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(admin.router,         prefix="/admin",        tags=["admin"])
