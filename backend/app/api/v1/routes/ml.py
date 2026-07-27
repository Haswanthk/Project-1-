from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.schemas.ml import PredictionRequest, TrainRequest
from app.services.ml_service import MLService

router = APIRouter()


@router.post("/train")
def train_model(payload: TrainRequest, db: Session = Depends(get_db), _: object = Depends(get_current_user)):
    try:
        return MLService(db).train(payload)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.post("/predict")
def predict(payload: PredictionRequest, db: Session = Depends(get_db), _: object = Depends(get_current_user)):
    try:
        return MLService(db).predict(payload.model_name, payload.features)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="Model not found") from error


@router.get("/models")
def list_models(db: Session = Depends(get_db), _: object = Depends(get_current_user)):
    return MLService(db).list_models()


@router.get("/explain/{model_name}")
def explain_model(model_name: str, db: Session = Depends(get_db), _: object = Depends(get_current_user)):
    try:
        return MLService(db).explain_model(model_name)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="Model not found") from error


@router.delete("/models/{model_name}")
def delete_model(model_name: str, db: Session = Depends(get_db), _: object = Depends(get_current_user)):
    try:
        return MLService(db).delete_model(model_name)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="Model not found") from error


