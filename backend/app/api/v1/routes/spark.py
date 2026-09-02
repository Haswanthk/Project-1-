from datetime import datetime, timezone
from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.deps import get_current_user

router = APIRouter()


class SparkJobSubmitRequest(BaseModel):
    name: str
    script: str
    master: str = "local[*]"
    executor_memory: str = "2g"
    num_executors: int = 2


_SPARK_JOBS_DB: list[dict[str, Any]] = [
    {
        "id": "job-001",
        "name": "ETL Pipeline — Sales Data",
        "master": "spark://cluster:7077",
        "status": "COMPLETED",
        "start_time": "2026-09-01T08:00:00Z",
        "end_time": "2026-09-01T08:14:32Z",
        "duration_seconds": 872,
        "executor_memory": "4g",
        "num_executors": 4,
        "logs": "INFO SparkContext: Successfully completed ETL pipeline. 2.4M records processed.",
    },
    {
        "id": "job-002",
        "name": "ML Feature Engineering",
        "master": "local[*]",
        "status": "RUNNING",
        "start_time": "2026-09-01T09:30:00Z",
        "end_time": None,
        "duration_seconds": 0,
        "executor_memory": "8g",
        "num_executors": 2,
        "logs": "INFO SparkContext: Processing stage 3/5 — aggregating user-level features...",
    },
    {
        "id": "job-003",
        "name": "Anomaly Detection Batch Scan",
        "master": "local[*]",
        "status": "FAILED",
        "start_time": "2026-09-01T07:00:00Z",
        "end_time": "2026-09-01T07:02:11Z",
        "duration_seconds": 131,
        "executor_memory": "2g",
        "num_executors": 2,
        "logs": "ERROR SparkContext: OutOfMemoryError on executor 1. Increase executor_memory to at least 4g.",
    },
]


@router.get("/jobs")
def list_spark_jobs(_: object = Depends(get_current_user)):
    return _SPARK_JOBS_DB


@router.post("/submit")
def submit_spark_job(payload: SparkJobSubmitRequest, _: object = Depends(get_current_user)):
    new_id = f"job-{len(_SPARK_JOBS_DB) + 101}"
    job = {
        "id": new_id,
        "name": payload.name,
        "master": payload.master,
        "status": "RUNNING",
        "start_time": datetime.now(timezone.utc).isoformat(),
        "end_time": None,
        "duration_seconds": 0,
        "executor_memory": payload.executor_memory,
        "num_executors": payload.num_executors,
        "logs": f"INFO SparkContext: Initializing PySpark job '{payload.name}' on {payload.master}...\nINFO DAGScheduler: Submitting 1 missing tasks from Stage 0",
    }
    _SPARK_JOBS_DB.append(job)
    return job


@router.get("/jobs/{job_id}")
def get_spark_job(job_id: str, _: object = Depends(get_current_user)):
    job = next((j for j in _SPARK_JOBS_DB if j["id"] == job_id), None)
    if not job:
        raise HTTPException(status_code=404, detail="Spark job not found")
    return job


@router.delete("/jobs/{job_id}")
def cancel_spark_job(job_id: str, _: object = Depends(get_current_user)):
    job = next((j for j in _SPARK_JOBS_DB if j["id"] == job_id), None)
    if not job:
        raise HTTPException(status_code=404, detail="Spark job not found")
    job["status"] = "CANCELLED"
    return {"status": "cancelled", "job_id": job_id}
