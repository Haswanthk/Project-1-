from datetime import datetime, timezone
from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.deps import get_current_user

router = APIRouter()


class ReportCreateRequest(BaseModel):
    title: str
    format: str = "pdf"  # pdf, html, excel, json
    dataset_ids: list[int] = []
    sections: list[str] = ["executive_summary", "profiling_charts", "ml_metrics"]


class ScheduleCreateRequest(BaseModel):
    title: str
    cron_expression: str = "0 8 * * *"
    format: str = "pdf"
    recipients: list[str] = []


_REPORTS_DB: list[dict[str, Any]] = [
    {
        "id": 1,
        "title": "Quarterly Data Profiling & ML Health",
        "format": "pdf",
        "status": "COMPLETED",
        "created_at": "2026-07-20T10:00:00Z",
        "download_url": "/api/v1/reports/1/download",
    },
    {
        "id": 2,
        "title": "Weekly Streaming Performance Audit",
        "format": "excel",
        "status": "COMPLETED",
        "created_at": "2026-07-25T14:30:00Z",
        "download_url": "/api/v1/reports/2/download",
    },
]

_SCHEDULES_DB: list[dict[str, Any]] = [
    {
        "id": 101,
        "title": "Daily Executive Analytics Digest",
        "cron_expression": "0 8 * * *",
        "format": "pdf",
        "recipients": ["executive@enterprise.ai"],
        "active": True,
    }
]


@router.get("/")
def list_reports(_: object = Depends(get_current_user)):
    return _REPORTS_DB


@router.post("/generate")
def generate_report(payload: ReportCreateRequest, _: object = Depends(get_current_user)):
    new_id = len(_REPORTS_DB) + 1
    report = {
        "id": new_id,
        "title": payload.title,
        "format": payload.format,
        "status": "COMPLETED",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "download_url": f"/api/v1/reports/{new_id}/download",
    }
    _REPORTS_DB.append(report)
    return report


@router.get("/schedules")
def list_schedules(_: object = Depends(get_current_user)):
    return _SCHEDULES_DB


@router.post("/schedules")
def create_schedule(payload: ScheduleCreateRequest, _: object = Depends(get_current_user)):
    new_id = len(_SCHEDULES_DB) + 100
    sched = {
        "id": new_id,
        "title": payload.title,
        "cron_expression": payload.cron_expression,
        "format": payload.format,
        "recipients": payload.recipients,
        "active": True,
    }
    _SCHEDULES_DB.append(sched)
    return sched


@router.get("/{report_id}/download")
def download_report(report_id: int, _: object = Depends(get_current_user)):
    report = next((r for r in _REPORTS_DB if r["id"] == report_id), None)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return {
        "report_id": report_id,
        "content_type": f"application/{report['format']}",
        "data": f"Report Content for '{report['title']}' generated on {report['created_at']}",
    }
