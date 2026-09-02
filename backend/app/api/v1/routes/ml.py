from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.schemas.ml import BatchPredictionRequest, ModelCompareRequest, PredictionRequest, TrainRequest
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


@router.post("/batch-predict")
def batch_predict(payload: BatchPredictionRequest, db: Session = Depends(get_db), _: object = Depends(get_current_user)):
    """Predict on multiple rows at once."""
    try:
        return MLService(db).batch_predict(payload.model_name, payload.rows)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="Model not found") from error


@router.post("/compare")
def compare_models(payload: ModelCompareRequest, db: Session = Depends(get_db), _: object = Depends(get_current_user)):
    """Train all algorithms on the same dataset and compare metrics."""
    try:
        return MLService(db).compare_models(
            payload.dataset_id, payload.target_column,
            payload.feature_columns, payload.problem_type,
            payload.test_size,
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


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


@router.get("/algorithms")
def list_algorithms(_: object = Depends(get_current_user)):
    """Return supported ML algorithms by problem type."""
    return [
        {"id": "random_forest", "name": "Random Forest", "problem_types": ["classification", "regression"],
         "description": "Ensemble of decision trees, robust to overfitting"},
        {"id": "gradient_boosting", "name": "Gradient Boosting", "problem_types": ["classification", "regression"],
         "description": "Sequential ensemble that corrects errors of prior models"},
        {"id": "xgboost", "name": "XGBoost (Gradient Boosting)", "problem_types": ["classification", "regression"],
         "description": "Optimized gradient boosting with tuned hyperparameters"},
        {"id": "logistic_regression", "name": "Logistic Regression", "problem_types": ["classification"],
         "description": "Linear model for binary/multi-class classification"},
        {"id": "linear_regression", "name": "Linear Regression", "problem_types": ["regression"],
         "description": "Ordinary least squares linear regression"},
        {"id": "svm", "name": "Support Vector Machine", "problem_types": ["classification", "regression"],
         "description": "Finds optimal hyperplane for classification/regression"},
        {"id": "knn", "name": "K-Nearest Neighbors", "problem_types": ["classification", "regression"],
         "description": "Instance-based learning using k nearest data points"},
        {"id": "decision_tree", "name": "Decision Tree", "problem_types": ["classification", "regression"],
         "description": "Tree-based model, interpretable and fast"},
    ]


@router.get("/models/{model_name}")
def get_model(model_name: str, db: Session = Depends(get_db), _: object = Depends(get_current_user)):
    """Get detailed metadata for a single trained model."""
    try:
        return MLService(db).get_model_metadata(model_name)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="Model not found") from error
