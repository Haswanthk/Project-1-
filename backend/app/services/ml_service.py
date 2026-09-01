import json
import pickle
from pathlib import Path
from typing import Any
from datetime import datetime, timezone

import mlflow
import numpy as np
import pandas as pd

from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.linear_model import LogisticRegression, LinearRegression
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix, mean_squared_error, mean_absolute_error, r2_score
)
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import LabelEncoder
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
            raise ValueError(f"Target column '{payload.target_column}' not found in dataset")

        # Use only the explicitly selected feature columns
        feature_cols = payload.feature_columns or [c for c in df.columns if c != payload.target_column]
        missing = [c for c in feature_cols if c not in df.columns]
        if missing:
            raise ValueError(f"Feature columns not found: {missing}")

        x_raw = df[feature_cols].copy()
        # Encode categorical features with one-hot encoding
        x = pd.get_dummies(x_raw, drop_first=True).fillna(0)
        y = df[payload.target_column]

        # For classification, encode string labels
        label_encoder = None
        if payload.problem_type == "classification" and y.dtype == object:
            label_encoder = LabelEncoder()
            y = pd.Series(label_encoder.fit_transform(y), index=y.index)

        x_train, x_test, y_train, y_test = train_test_split(
            x, y, test_size=payload.test_size, random_state=42
        )

        # Select model based on algorithm_id
        model = self._build_model(payload.algorithm_id, payload.problem_type)

        with mlflow.start_run(run_name=f"{payload.algorithm_id}-{payload.problem_type}"):
            model.fit(x_train, y_train)
            predictions = model.predict(x_test)

            # Build metrics dict
            metrics: dict[str, Any] = {}
            if payload.problem_type == "classification":
                avg = "weighted" if len(set(y)) > 2 else "binary"
                metrics["accuracy"] = float(accuracy_score(y_test, predictions))
                metrics["precision"] = float(precision_score(y_test, predictions, average=avg, zero_division=0))
                metrics["recall"] = float(recall_score(y_test, predictions, average=avg, zero_division=0))
                metrics["f1"] = float(f1_score(y_test, predictions, average=avg, zero_division=0))
                cm = confusion_matrix(y_test, predictions).tolist()
                metrics["confusion_matrix"] = cm
                if label_encoder is not None:
                    metrics["class_labels"] = list(label_encoder.classes_)
            else:
                mse = mean_squared_error(y_test, predictions)
                metrics["rmse"] = float(np.sqrt(mse))
                metrics["mse"] = float(mse)
                metrics["mae"] = float(mean_absolute_error(y_test, predictions))
                metrics["r2"] = float(r2_score(y_test, predictions))

            for k, v in metrics.items():
                if isinstance(v, float):
                    mlflow.log_metric(k, v)
            mlflow.log_param("problem_type", payload.problem_type)
            mlflow.log_param("algorithm", payload.algorithm_id)
            mlflow.sklearn.log_model(model, artifact_path="model")

        # Real cross-validation
        cv_scores: list[float] = []
        if payload.cross_validation:
            cv_metric = "accuracy" if payload.problem_type == "classification" else "r2"
            cv_results = cross_val_score(model, x, y, cv=5, scoring=cv_metric)
            cv_scores = [float(s) for s in cv_results]

        model_name = f"{payload.algorithm_id}_{payload.dataset_id}.pkl"
        with open(self.model_dir / model_name, "wb") as file:
            pickle.dump({
                "model": model,
                "features": list(x.columns),
                "problem_type": payload.problem_type,
                "target_column": payload.target_column,
                "algorithm_id": payload.algorithm_id,
                "metrics": metrics,
                "label_encoder": label_encoder,
            }, file)

        return {
            "modelId": model_name,
            "modelName": model_name,
            "metrics": metrics,
            "featuresUsed": list(x.columns),
            "cvScores": cv_scores,
        }

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
                    "algorithm": artifact.get("algorithm_id", type(model).__name__ if model else "Unknown"),
                    "problem_type": artifact.get("problem_type", "unknown"),
                    "metrics": artifact.get("metrics", {}),
                    "feature_count": len(features),
                    "created_at": datetime.fromtimestamp(p.stat().st_mtime, tz=timezone.utc).isoformat(),
                })
            except Exception:
                continue
        return models

    def _build_model(self, algorithm_id: str, problem_type: str):
        """Return a sklearn model based on algorithm_id."""
        algo = algorithm_id.lower()
        if problem_type == "classification":
            if algo in ("random_forest", "random_forest_classifier"):
                return RandomForestClassifier(n_estimators=100, random_state=42)
            elif algo in ("logistic_regression",):
                return LogisticRegression(max_iter=500, random_state=42)
            else:
                return RandomForestClassifier(n_estimators=100, random_state=42)
        else:
            if algo in ("random_forest", "random_forest_regressor"):
                return RandomForestRegressor(n_estimators=100, random_state=42)
            elif algo in ("linear_regression",):
                return LinearRegression()
            else:
                return RandomForestRegressor(n_estimators=100, random_state=42)

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
        sorted_imp = dict(sorted(importance_map.items(), key=lambda item: item[1], reverse=True)[:20])
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

