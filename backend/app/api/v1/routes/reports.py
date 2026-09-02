from datetime import datetime, timezone
from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
import json

from app.core.deps import get_current_user, get_db
from app.repositories.dataset import DatasetRepository
from app.services.report_service import ReportService
from app.models.report import Report

router = APIRouter()
report_service = ReportService()


class ReportCreateRequest(BaseModel):
    title: str
    format: str = "pdf"  # pdf, docx, excel, csv
    dataset_ids: list[int] = []
    sections: list[str] = ["executive_summary", "profiling_charts", "ml_metrics"]


class ScheduleCreateRequest(BaseModel):
    title: str
    cron_expression: str = "0 8 * * *"
    format: str = "pdf"
    recipients: list[str] = []


_REPORTS_DB: list[dict[str, Any]] = []
_SCHEDULES_DB: list[dict[str, Any]] = []


@router.get("/")
def list_reports(db: Session = Depends(get_db), _: object = Depends(get_current_user)):
    reports = db.query(Report).all()
    return [
        {
            "id": r.id,
            "title": r.title,
            "format": r.format,
            "status": r.status,
            "created_at": r.created_at.isoformat(),
            "download_url": f"/api/v1/reports/{r.id}/download",
            "file_path": r.file_path
        }
        for r in reports
    ]


@router.post("/generate")
def generate_report(payload: ReportCreateRequest, db: Session = Depends(get_db), _: object = Depends(get_current_user)):
    dataset = None
    dataset_path = None
    profile_json = {}
    if payload.dataset_ids:
        dataset = DatasetRepository(db).get_by_id(payload.dataset_ids[0])
        if dataset:
            dataset_path = dataset.file_path
            try:
                profile_json = json.loads(dataset.profiling_json) if dataset.profiling_json else {}
            except Exception:
                pass

    try:
        file_path = report_service.generate_report(payload.title, payload.format, dataset_path, profile_json)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    report = Report(
        title=payload.title,
        format=payload.format,
        status="COMPLETED",
        file_path=file_path
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    return {
        "id": report.id,
        "title": report.title,
        "format": report.format,
        "status": report.status,
        "created_at": report.created_at.isoformat(),
        "download_url": f"/api/v1/reports/{report.id}/download",
        "file_path": report.file_path
    }


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
def download_report(report_id: int, db: Session = Depends(get_db), _: object = Depends(get_current_user)):
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
        
    mime_types = {
        "pdf": "application/pdf",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "excel": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "csv": "text/csv",
        "html": "text/html",
        "json": "application/json",
    }
    
    return FileResponse(
        report.file_path,
        media_type=mime_types.get(report.format, "application/octet-stream"),
        filename=f"{report.title}.{report.format.replace('excel', 'xlsx')}"
    )


@router.get("/{report_id}")
def get_report(report_id: int, db: Session = Depends(get_db), _: object = Depends(get_current_user)):
    """Get details for a single report."""
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return {
        "id": report.id,
        "title": report.title,
        "format": report.format,
        "status": report.status,
        "created_at": report.created_at.isoformat(),
        "download_url": f"/api/v1/reports/{report.id}/download",
        "file_path": report.file_path,
    }


@router.delete("/{report_id}")
def delete_report(report_id: int, db: Session = Depends(get_db), _: object = Depends(get_current_user)):
    """Delete a report."""
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    # Delete file from disk
    if report.file_path:
        from pathlib import Path
        p = Path(report.file_path)
        if p.exists():
            p.unlink()
    db.delete(report)
    db.commit()
    return {"status": "deleted", "report_id": report_id}

