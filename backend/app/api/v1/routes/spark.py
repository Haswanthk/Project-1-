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
        "name": "ETL Pipeline — Enterprise Sales Mart",
        "master": "spark://cluster:7077",
        "status": "COMPLETED",
        "progress": 100,
        "start_time": "2026-09-07T08:00:00Z",
        "end_time": "2026-09-07T08:14:32Z",
        "duration_seconds": 872,
        "executor_memory": "4g",
        "num_executors": 4,
        "shuffle_read_mb": 1280.4,
        "shuffle_write_mb": 940.2,
        "stages": [
            {"stage_id": 0, "name": "ScanParquet[s3://lake/sales]", "tasks": 128, "completed": 128, "status": "SUCCESS"},
            {"stage_id": 1, "name": "HashAggregate(GroupBy customer_id)", "tasks": 64, "completed": 64, "status": "SUCCESS"},
            {"stage_id": 2, "name": "WriteToDelta[sales_summary]", "tasks": 32, "completed": 32, "status": "SUCCESS"},
        ],
        "logs": "INFO SparkContext: Successfully completed ETL pipeline. 2,410,920 records processed.\nINFO DAGScheduler: Job 0 finished: execute at SalesETL.scala:45, took 872.12 s",
    },
    {
        "id": "job-002",
        "name": "ML Feature Store Generation",
        "master": "local[*]",
        "status": "RUNNING",
        "progress": 65,
        "start_time": "2026-09-07T09:30:00Z",
        "end_time": None,
        "duration_seconds": 380,
        "executor_memory": "8g",
        "num_executors": 2,
        "shuffle_read_mb": 620.0,
        "shuffle_write_mb": 410.5,
        "stages": [
            {"stage_id": 0, "name": "Join(UserEvents, AccountProfiles)", "tasks": 96, "completed": 96, "status": "SUCCESS"},
            {"stage_id": 1, "name": "Window(Rolling 30D Sum & Average)", "tasks": 96, "completed": 62, "status": "RUNNING"},
            {"stage_id": 2, "name": "StandardScaler & Imputer", "tasks": 48, "completed": 0, "status": "PENDING"},
        ],
        "logs": "INFO SparkContext: Processing stage 1/3 — Window rolling aggregates on user partitions...\nINFO TaskSetManager: Finished task 62.0 in stage 1.0 (TID 158) in 410ms on executor 1",
    },
    {
        "id": "job-003",
        "name": "Anomaly Detection Batch Scan",
        "master": "local[*]",
        "status": "FAILED",
        "progress": 42,
        "start_time": "2026-09-07T07:00:00Z",
        "end_time": "2026-09-07T07:02:11Z",
        "duration_seconds": 131,
        "executor_memory": "2g",
        "num_executors": 2,
        "shuffle_read_mb": 450.2,
        "shuffle_write_mb": 110.0,
        "stages": [
            {"stage_id": 0, "name": "ScanCsv(kafka_events_staging)", "tasks": 40, "completed": 40, "status": "SUCCESS"},
            {"stage_id": 1, "name": "MultivariateOutlierScan", "tasks": 40, "completed": 17, "status": "FAILED"},
        ],
        "logs": "ERROR SparkContext: OutOfMemoryError on executor 1 during tree broadcast.\nCaused by: java.lang.OutOfMemoryError: Java heap space. Increase executor_memory to at least 4g.",
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


@router.get("/jobs/{job_id}/logs")
def get_spark_job_logs(job_id: str, _: object = Depends(get_current_user)):
    job = next((j for j in _SPARK_JOBS_DB if j["id"] == job_id), None)
    if not job:
        raise HTTPException(status_code=404, detail="Spark job not found")
    return {"job_id": job_id, "logs": job.get("logs", "No logs recorded for this job.")}


@router.delete("/jobs/{job_id}")
def cancel_spark_job(job_id: str, _: object = Depends(get_current_user)):
    job = next((j for j in _SPARK_JOBS_DB if j["id"] == job_id), None)
    if not job:
        raise HTTPException(status_code=404, detail="Spark job not found")
    job["status"] = "CANCELLED"
    return {"status": "cancelled", "job_id": job_id}

