import json
from pathlib import Path

import pandas as pd
from fastapi import APIRouter, Depends
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.dataset import Dataset
from app.schemas.source import RestSourceRequest, SqlSourceRequest, StreamSourceRequest
from app.services.profiling_service import ProfilingService

router = APIRouter()
upload_dir = Path("uploads")
upload_dir.mkdir(exist_ok=True)
profiling_service = ProfilingService()


@router.post("/rest")
def ingest_rest(payload: RestSourceRequest, db: Session = Depends(get_db), user=Depends(get_current_user)):
    frame = pd.read_json(payload.url.unicode_string())
    file_path = upload_dir / f"{user.id}_{payload.name}_rest.json"
    frame.to_json(file_path, orient="records")
    profile = profiling_service.profile(frame)
    dataset = Dataset(
        name=payload.name,
        source_type="rest_api",
        file_path=str(file_path),
        uploaded_by=user.id,
        schema_json=json.dumps(profile["schema"]),
        profiling_json=json.dumps(profile),
    )
    db.add(dataset)
    db.commit()
    db.refresh(dataset)
    return {"dataset_id": dataset.id, "status": "ingested"}


@router.post("/sql")
def ingest_sql(payload: SqlSourceRequest, db: Session = Depends(get_db), user=Depends(get_current_user)):
    engine = create_engine(payload.connection_url)
    frame = pd.read_sql(payload.query, engine)
    file_path = upload_dir / f"{user.id}_{payload.name}_sql.csv"
    frame.to_csv(file_path, index=False)
    profile = profiling_service.profile(frame)
    dataset = Dataset(
        name=payload.name,
        source_type="sql_database",
        file_path=str(file_path),
        uploaded_by=user.id,
        schema_json=json.dumps(profile["schema"]),
        profiling_json=json.dumps(profile),
    )
    db.add(dataset)
    db.commit()
    db.refresh(dataset)
    return {"dataset_id": dataset.id, "status": "ingested"}


@router.post("/stream")
def register_stream_source(payload: StreamSourceRequest, _: object = Depends(get_current_user)):
    if payload.source_type not in {"kafka", "iot", "web_logs"}:
        return {"status": "rejected", "message": "source_type must be kafka, iot, or web_logs"}
    return {"status": "registered", "source": payload.model_dump()}

