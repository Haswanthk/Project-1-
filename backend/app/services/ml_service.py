import json
import pickle
from pathlib import Path
from typing import Any

import mlflow
import numpy as np
import pandas as pd

from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import accuracy_score, mean_squared_error
from sklearn.model_selection import train_test_split
from sqlalchemy.orm import Session

from app.models.dataset import Dataset
from app.schemas.ml import TrainRequest


class MLService:
    def __init__(self, db: Session):
        self.db = db
        self.model_dir = Path("models")
        self.model_dir.mkdir(exist_ok=True)
        mlflow.set_tracking_uri("file:./mlruns")

    def train(self, payload: TrainRequest) -> dict[str, Any]:
        dataset = self.db.get(Dataset, payload.dataset_id)
        if not dataset:
            raise ValueError("Dataset not found")

        df = self._load_dataframe(dataset.file_path)
        if payload.target_column not in df.columns:
            raise ValueError("Target column not found")
        x = pd.get_dummies(df.drop(columns=[payload.target_column]), drop_first=True).fillna(0)
        y = df[payload.target_column]
        x_train, x_test, y_train, y_test = train_test_split(x, y, test_size=0.2, random_state=42)

        if payload.problem_type == "classification":
            model = RandomForestClassifier(n_estimators=200, random_state=42)
            metric_name = "accuracy"
        else:
            model = RandomForestRegressor(n_estimators=200, random_state=42)
            metric_name = "rmse"

        with mlflow.start_run(run_name=f"{payload.model_type}-{payload.problem_type}"):
            model.fit(x_train, y_train)
            predictions = model.predict(x_test)
            metric_value = (
                accuracy_score(y_test, predictions)
                if payload.problem_type == "classification"
                else mean_squared_error(y_test, predictions, squared=False)
            )
            mlflow.log_param("problem_type", payload.problem_type)
            mlflow.log_param("model_type", payload.model_type)
            mlflow.log_metric(metric_name, float(metric_value))
            mlflow.sklearn.log_model(model, artifact_path="model")

        model_name = f"{payload.model_type}_{payload.dataset_id}.pkl"
        with open(self.model_dir / model_name, "wb") as file:
            pickle.dump({"model": model, "features": list(x.columns), "problem_type": payload.problem_type, "target_column": payload.target_column}, file)
        return {"model_name": model_name, "metric_name": metric_name, "metric_value": float(metric_value), "features": list(x.columns)}

    def predict(self, model_name: str, features: dict[str, float]) -> dict[str, Any]:
        with open(self.model_dir / model_name, "rb") as file:
            artifact = pickle.load(file)
        model = artifact["model"]
        model_features = artifact["features"]
        row = {feature: features.get(feature, 0.0) for feature in model_features}
        frame = pd.DataFrame([row], columns=model_features)
        prediction = model.predict(frame)[0]
        return {"prediction": float(prediction) if isinstance(prediction, (int, float, np.number)) else str(prediction)}

    def list_models(self) -> list[dict[str, Any]]:
        models = []
        for p in self.model_dir.glob("*.pkl"):
            try:
                with open(p, "rb") as file:
                    artifact = pickle.load(file)
                model = artifact.get("model")
                features = artifact.get("features", [])
                models.append({
                    "model_name": p.name,
                    "model_type": type(model).__name__ if model else "Unknown",
                    "features": features,
                    "problem_type": artifact.get("problem_type", "unknown"),
                    "target_column": artifact.get("target_column", ""),
                    "file_size": p.stat().st_size,
                    "created_at": p.stat().st_mtime,
                })
            except Exception:
                continue
        return models

    def explain_model(self, model_name: str) -> dict[str, Any]:
        path = self.model_dir / model_name
        if not path.exists():
            raise FileNotFoundError("Model not found")
        with open(path, "rb") as file:
            artifact = pickle.load(file)
        model = artifact["model"]
        features = artifact["features"]
        importances = getattr(model, "feature_importances_", None)
        if importances is not None:
            importance_map = dict(zip(features, [float(i) for i in importances]))
        else:
            importance_map = {f: 1.0 / max(len(features), 1) for f in features}
        sorted_imp = dict(sorted(importance_map.items(), key=lambda item: item[1], reverse=True))
        return {
            "model_name": model_name,
            "feature_importances": sorted_imp,
            "top_feature": next(iter(sorted_imp.keys()), None),
        }

    def delete_model(self, model_name: str) -> dict[str, Any]:
        path = self.model_dir / model_name
        if not path.exists():
            raise FileNotFoundError("Model not found")
        path.unlink()
        return {"status": "deleted", "model_name": model_name}

    def _load_dataframe(self, path: str) -> pd.DataFrame:

        suffix = Path(path).suffix.lower()
        if suffix == ".csv":
            return pd.read_csv(path)
        if suffix in {".xlsx", ".xls"}:
            return pd.read_excel(path)
        if suffix == ".json":
            return pd.read_json(path)
        raise ValueError("Unsupported dataset type for ML training")

