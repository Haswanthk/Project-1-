import json
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db, require_role
from app.models.dataset import Dataset
from app.models.user import Role
from app.repositories.dataset import DatasetRepository
from app.schemas.dataset import DatasetRead, ProfileResponse
from app.services.profiling_service import ProfilingService

router = APIRouter()
upload_dir = Path("uploads")
upload_dir.mkdir(exist_ok=True)
profiling_service = ProfilingService()


@router.post("/upload", response_model=DatasetRead, status_code=status.HTTP_201_CREATED)
def upload_dataset(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(require_role(Role.admin, Role.analyst)),
):
    extension = Path(file.filename or "").suffix.lower()
    if extension not in {".csv", ".xlsx", ".xls", ".json"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported file type")
    destination = upload_dir / f"{current_user.id}_{file.filename}"
    with open(destination, "wb") as out:
        out.write(file.file.read())
    frame = profiling_service.load_dataset(str(destination))
    profile = profiling_service.profile(frame)
    dataset = Dataset(
        name=file.filename or "dataset",
        source_type=extension.replace(".", ""),
        file_path=str(destination),
        uploaded_by=current_user.id,
        schema_json=json.dumps(profile["schema"]),
        profiling_json=json.dumps(profile),
    )
    return DatasetRepository(db).create(dataset)


@router.get("/")
def list_datasets(db: Session = Depends(get_db), _: object = Depends(get_current_user)):
    datasets = DatasetRepository(db).list_all()
    return [
        {
            **DatasetRead.model_validate(dataset).model_dump(by_alias=True),
            "rows": len(profiling_service.load_dataset(dataset.file_path)) if Path(dataset.file_path).exists() else 0,
            "columns": len(json.loads(dataset.schema_json or "{}")),
            "size_bytes": Path(dataset.file_path).stat().st_size if Path(dataset.file_path).exists() else 0,
            "upload_date": dataset.created_at,
        }
        for dataset in datasets
    ]


@router.get("/{dataset_id}/profile", response_model=ProfileResponse)
def get_profile(dataset_id: int, db: Session = Depends(get_db), _: object = Depends(get_current_user)):
    dataset = DatasetRepository(db).get_by_id(dataset_id)
    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
    return json.loads(dataset.profiling_json)


@router.get("/{dataset_id}/pca")
def get_pca(dataset_id: int, db: Session = Depends(get_db), _: object = Depends(get_current_user)):
    dataset = DatasetRepository(db).get_by_id(dataset_id)
    if not dataset or not dataset.file_path or not Path(dataset.file_path).exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset file not found")
    frame = profiling_service.load_dataset(dataset.file_path)
    return profiling_service.compute_pca(frame)


@router.get("/{dataset_id}/preview")
def preview_dataset(
    dataset_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    _: object = Depends(get_current_user),
):
    dataset = DatasetRepository(db).get_by_id(dataset_id)
    if not dataset or not dataset.file_path or not Path(dataset.file_path).exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset file not found")
    frame = profiling_service.load_dataset(dataset.file_path)
    start = (page - 1) * limit
    values = frame.iloc[start : start + limit].where(frame.notna(), None).values.tolist()
    return {"headers": [str(column) for column in frame.columns], "rows": values, "total": len(frame)}


@router.get("/{dataset_id}/download")
def download_dataset(dataset_id: int, db: Session = Depends(get_db), _: object = Depends(get_current_user)):
    dataset = DatasetRepository(db).get_by_id(dataset_id)
    if not dataset or not dataset.file_path or not Path(dataset.file_path).exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset file not found")
    return FileResponse(dataset.file_path, filename=Path(dataset.file_path).name)


@router.get("/{dataset_id}/export")
def export_dataset(dataset_id: int, db: Session = Depends(get_db), _: object = Depends(get_current_user)):
    dataset = DatasetRepository(db).get_by_id(dataset_id)
    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
    return {
        "id": dataset.id,
        "name": dataset.name,
        "source_type": dataset.source_type,
        "created_at": dataset.created_at.isoformat() if dataset.created_at else None,
        "profile": json.loads(dataset.profiling_json) if dataset.profiling_json else {},
    }


@router.delete("/{dataset_id}")
def delete_dataset(dataset_id: int, db: Session = Depends(get_db), current_user=Depends(require_role(Role.admin, Role.analyst))):
    dataset = DatasetRepository(db).get_by_id(dataset_id)
    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
    db.delete(dataset)
    db.commit()
    return {"status": "deleted", "id": dataset_id}


