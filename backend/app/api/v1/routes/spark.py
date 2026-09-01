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


_SPARK_JOBS_DB: list[dict[str, Any]] = []


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
        "duration_seconds": 0,
        "executor_memory": payload.executor_memory,
        "logs": f"INFO SparkContext: Initializing PySpark job '{payload.name}' on {payload.master}...",
    }
    _SPARK_JOBS_DB.append(job)
    return job


@router.get("/jobs/{job_id}")
def get_spark_job(job_id: str, _: object = Depends(get_current_user)):
    job = next((j for j in _SPARK_JOBS_DB if j["id"] == job_id), None)
    if not job:
        raise HTTPException(status_code=404, detail="Spark job not found")
    return job
