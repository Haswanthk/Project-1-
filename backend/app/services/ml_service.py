import json
import pickle
from pathlib import Path
from typing import Any
from datetime import datetime, timezone

import mlflow
import numpy as np
import pandas as pd

from sklearn.ensemble import (
    RandomForestClassifier, RandomForestRegressor,
    GradientBoostingClassifier, GradientBoostingRegressor,
)
from sklearn.linear_model import LogisticRegression, LinearRegression
from sklearn.svm import SVC, SVR
from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix, mean_squared_error, mean_absolute_error, r2_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split, cross_val_score, GridSearchCV
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sqlalchemy.orm import Session

from app.models.dataset import Dataset
from app.schemas.ml import TrainRequest


# ── Hyperparameter grids for GridSearchCV ────────────────────────────────────
_PARAM_GRIDS: dict[str, dict[str, list]] = {
    "random_forest": {
        "n_estimators": [50, 100, 200],
        "max_depth": [5, 10, 20, None],
        "min_samples_split": [2, 5, 10],
    },
    "gradient_boosting": {
        "n_estimators": [50, 100, 200],
        "learning_rate": [0.01, 0.1, 0.2],
        "max_depth": [3, 5, 7],
    },
    "logistic_regression": {
        "C": [0.01, 0.1, 1.0, 10.0],
        "max_iter": [200, 500],
    },
    "linear_regression": {},  # no hyperparameters to tune
    "svm": {
        "C": [0.1, 1.0, 10.0],
        "kernel": ["rbf", "linear"],
    },
    "knn": {
        "n_neighbors": [3, 5, 7, 11],
        "weights": ["uniform", "distance"],
    },
    "decision_tree": {
        "max_depth": [5, 10, 20, None],
        "min_samples_split": [2, 5, 10],
    },
}


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

        # Scale features for algorithms that benefit from it
        scaler = None
        algo = payload.algorithm_id.lower()
        if algo in ("svm", "svc", "svr", "knn", "knn_classifier", "knn_regressor",
                     "logistic_regression"):
            scaler = StandardScaler()
            x_train = pd.DataFrame(scaler.fit_transform(x_train), columns=x_train.columns, index=x_train.index)
            x_test = pd.DataFrame(scaler.transform(x_test), columns=x_test.columns, index=x_test.index)

        # Select model based on algorithm_id
        model = self._build_model(payload.algorithm_id, payload.problem_type)

        # ── Hyperparameter tuning via GridSearchCV ────────────────────────
        best_params: dict[str, Any] = {}
        if payload.hyperparameters:
            # User-provided hyperparameters override
            model.set_params(**payload.hyperparameters)
            best_params = payload.hyperparameters
        elif algo in _PARAM_GRIDS and _PARAM_GRIDS[algo]:
            scoring = "accuracy" if payload.problem_type == "classification" else "r2"
            grid = GridSearchCV(
                model, _PARAM_GRIDS[algo],
                cv=3, scoring=scoring, n_jobs=-1, error_score="raise",
            )
            grid.fit(x_train, y_train)
            model = grid.best_estimator_
            best_params = grid.best_params_

        with mlflow.start_run(run_name=f"{payload.algorithm_id}-{payload.problem_type}"):
            if not best_params:
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
                # ROC AUC for binary classification
                if len(set(y)) == 2 and hasattr(model, "predict_proba"):
                    try:
                        proba = model.predict_proba(x_test)[:, 1]
                        metrics["roc_auc"] = float(roc_auc_score(y_test, proba))
                    except Exception:
                        pass
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
            if best_params:
                for pk, pv in best_params.items():
                    mlflow.log_param(pk, pv)
            mlflow.sklearn.log_model(model, artifact_path="model")

        # Real cross-validation
        cv_scores: list[float] = []
        if payload.cross_validation:
            cv_metric = "accuracy" if payload.problem_type == "classification" else "r2"
            # If scaler was used, scale all data for CV
            if scaler is not None:
                x_scaled = pd.DataFrame(scaler.fit_transform(x), columns=x.columns, index=x.index)
                cv_results = cross_val_score(model, x_scaled, y, cv=5, scoring=cv_metric)
            else:
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
                "scaler": scaler,
                "best_params": best_params,
                "training_samples": len(x_train),
                "test_samples": len(x_test),
                "feature_columns_original": feature_cols,
            }, file)

        return {
            "modelId": model_name,
            "modelName": model_name,
            "metrics": metrics,
            "featuresUsed": list(x.columns),
            "cvScores": cv_scores,
            "bestParams": best_params,
        }

    def predict(self, model_name: str, features: dict[str, float]) -> dict[str, Any]:
        artifact = self._load_artifact(model_name)
        model = artifact["model"]
        model_features = artifact["features"]
        scaler = artifact.get("scaler")

        row = {feature: features.get(feature, 0.0) for feature in model_features}
        frame = pd.DataFrame([row], columns=model_features)

        if scaler is not None:
            frame = pd.DataFrame(scaler.transform(frame), columns=model_features)

        prediction = model.predict(frame)[0]

        result: dict[str, Any] = {
            "prediction": float(prediction) if isinstance(prediction, (int, float, np.number)) else str(prediction),
        }

        # Add probability for classification models
        if artifact.get("problem_type") == "classification" and hasattr(model, "predict_proba"):
            try:
                proba = model.predict_proba(frame)[0]
                result["probabilities"] = {str(i): float(p) for i, p in enumerate(proba)}
                result["confidence"] = float(max(proba))
            except Exception:
                pass

        # Decode label if label encoder was used
        le = artifact.get("label_encoder")
        if le is not None and isinstance(prediction, (int, np.integer)):
            try:
                result["predicted_label"] = str(le.inverse_transform([int(prediction)])[0])
            except Exception:
                pass

        return result

    def batch_predict(self, model_name: str, rows: list[dict[str, float]]) -> dict[str, Any]:
        """Predict on multiple rows at once."""
        artifact = self._load_artifact(model_name)
        model = artifact["model"]
        model_features = artifact["features"]
        scaler = artifact.get("scaler")
        le = artifact.get("label_encoder")

        data = [{f: row.get(f, 0.0) for f in model_features} for row in rows]
        frame = pd.DataFrame(data, columns=model_features)

        if scaler is not None:
            frame = pd.DataFrame(scaler.transform(frame), columns=model_features)

        predictions = model.predict(frame)

        results = []
        for i, pred in enumerate(predictions):
            entry: dict[str, Any] = {
                "index": i,
                "prediction": float(pred) if isinstance(pred, (int, float, np.number)) else str(pred),
            }
            if le is not None and isinstance(pred, (int, np.integer)):
                try:
                    entry["predicted_label"] = str(le.inverse_transform([int(pred)])[0])
                except Exception:
                    pass
            results.append(entry)

        return {
            "model_name": model_name,
            "total_predictions": len(results),
            "predictions": results,
        }

    def compare_models(self, dataset_id: int, target_column: str,
                       feature_columns: list[str] | None, problem_type: str,
                       test_size: float = 0.2) -> dict[str, Any]:
        """Train multiple algorithms on the same data and return comparison."""
        dataset = self.db.get(Dataset, dataset_id)
        if not dataset:
            raise ValueError("Dataset not found")

        df = self._load_dataframe(dataset.file_path)
        if target_column not in df.columns:
            raise ValueError(f"Target column '{target_column}' not found")

        feat_cols = feature_columns or [c for c in df.columns if c != target_column]
        x = pd.get_dummies(df[feat_cols].copy(), drop_first=True).fillna(0)
        y = df[target_column]

        label_encoder = None
        if problem_type == "classification" and y.dtype == object:
            label_encoder = LabelEncoder()
            y = pd.Series(label_encoder.fit_transform(y), index=y.index)

        x_train, x_test, y_train, y_test = train_test_split(x, y, test_size=test_size, random_state=42)

        if problem_type == "classification":
            algorithms = {
                "random_forest": RandomForestClassifier(n_estimators=100, random_state=42),
                "gradient_boosting": GradientBoostingClassifier(n_estimators=100, random_state=42),
                "logistic_regression": LogisticRegression(max_iter=500, random_state=42),
                "decision_tree": DecisionTreeClassifier(max_depth=10, random_state=42),
                "knn": KNeighborsClassifier(n_neighbors=5),
                "svm": SVC(random_state=42),
            }
        else:
            algorithms = {
                "random_forest": RandomForestRegressor(n_estimators=100, random_state=42),
                "gradient_boosting": GradientBoostingRegressor(n_estimators=100, random_state=42),
                "linear_regression": LinearRegression(),
                "decision_tree": DecisionTreeRegressor(max_depth=10, random_state=42),
                "knn": KNeighborsRegressor(n_neighbors=5),
                "svm": SVR(),
            }

        # Scale data for algorithms that need it
        scaler = StandardScaler()
        x_train_scaled = pd.DataFrame(scaler.fit_transform(x_train), columns=x_train.columns, index=x_train.index)
        x_test_scaled = pd.DataFrame(scaler.transform(x_test), columns=x_test.columns, index=x_test.index)

        scale_algos = {"logistic_regression", "svm", "knn"}
        comparisons = []
        for algo_name, algo_model in algorithms.items():
            try:
                xt = x_train_scaled if algo_name in scale_algos else x_train
                xte = x_test_scaled if algo_name in scale_algos else x_test
                algo_model.fit(xt, y_train)
                preds = algo_model.predict(xte)

                if problem_type == "classification":
                    avg = "weighted" if len(set(y)) > 2 else "binary"
                    m = {
                        "accuracy": float(accuracy_score(y_test, preds)),
                        "precision": float(precision_score(y_test, preds, average=avg, zero_division=0)),
                        "recall": float(recall_score(y_test, preds, average=avg, zero_division=0)),
                        "f1": float(f1_score(y_test, preds, average=avg, zero_division=0)),
                    }
                else:
                    mse_val = mean_squared_error(y_test, preds)
                    m = {
                        "rmse": float(np.sqrt(mse_val)),
                        "mse": float(mse_val),
                        "mae": float(mean_absolute_error(y_test, preds)),
                        "r2": float(r2_score(y_test, preds)),
                    }
                comparisons.append({"algorithm": algo_name, "metrics": m, "status": "success"})
            except Exception as e:
                comparisons.append({"algorithm": algo_name, "metrics": {}, "status": f"failed: {e}"})

        # Sort by primary metric
        primary = "accuracy" if problem_type == "classification" else "r2"
        comparisons.sort(
            key=lambda c: c["metrics"].get(primary, -999), reverse=True
        )

        return {
            "dataset_id": dataset_id,
            "problem_type": problem_type,
            "target_column": target_column,
            "training_samples": len(x_train),
            "test_samples": len(x_test),
            "comparisons": comparisons,
            "best_algorithm": comparisons[0]["algorithm"] if comparisons else None,
        }

    def get_model_metadata(self, model_name: str) -> dict[str, Any]:
        """Return detailed metadata for a single model."""
        path = self.model_dir / model_name
        if not path.exists():
            raise FileNotFoundError("Model not found")
        artifact = self._load_artifact(model_name)
        model = artifact["model"]
        return {
            "model_name": model_name,
            "algorithm": artifact.get("algorithm_id", type(model).__name__),
            "problem_type": artifact.get("problem_type", "unknown"),
            "target_column": artifact.get("target_column", ""),
            "features": artifact.get("features", []),
            "feature_count": len(artifact.get("features", [])),
            "feature_columns_original": artifact.get("feature_columns_original", []),
            "metrics": artifact.get("metrics", {}),
            "best_params": artifact.get("best_params", {}),
            "training_samples": artifact.get("training_samples", 0),
            "test_samples": artifact.get("test_samples", 0),
            "model_class": type(model).__name__,
            "has_scaler": artifact.get("scaler") is not None,
            "has_label_encoder": artifact.get("label_encoder") is not None,
            "file_size_bytes": path.stat().st_size,
            "created_at": datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).isoformat(),
        }

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
                    "target_column": artifact.get("target_column", ""),
                    "best_params": artifact.get("best_params", {}),
                    "training_samples": artifact.get("training_samples", 0),
                    "test_samples": artifact.get("test_samples", 0),
                    "created_at": datetime.fromtimestamp(p.stat().st_mtime, tz=timezone.utc).isoformat(),
                })
            except Exception:
                continue
        return models

    def _build_model(self, algorithm_id: str, problem_type: str):
        """Return a sklearn model based on algorithm_id."""
        algo = algorithm_id.lower()
        if problem_type == "classification":
            classifiers = {
                "random_forest": RandomForestClassifier(n_estimators=100, random_state=42),
                "random_forest_classifier": RandomForestClassifier(n_estimators=100, random_state=42),
                "gradient_boosting": GradientBoostingClassifier(n_estimators=100, random_state=42),
                "gradient_boosting_classifier": GradientBoostingClassifier(n_estimators=100, random_state=42),
                "xgboost": GradientBoostingClassifier(n_estimators=200, learning_rate=0.1, max_depth=5, random_state=42),
                "logistic_regression": LogisticRegression(max_iter=500, random_state=42),
                "svm": SVC(probability=True, random_state=42),
                "svc": SVC(probability=True, random_state=42),
                "knn": KNeighborsClassifier(n_neighbors=5),
                "knn_classifier": KNeighborsClassifier(n_neighbors=5),
                "decision_tree": DecisionTreeClassifier(max_depth=10, random_state=42),
                "decision_tree_classifier": DecisionTreeClassifier(max_depth=10, random_state=42),
            }
            return classifiers.get(algo, RandomForestClassifier(n_estimators=100, random_state=42))
        else:
            regressors = {
                "random_forest": RandomForestRegressor(n_estimators=100, random_state=42),
                "random_forest_regressor": RandomForestRegressor(n_estimators=100, random_state=42),
                "gradient_boosting": GradientBoostingRegressor(n_estimators=100, random_state=42),
                "gradient_boosting_regressor": GradientBoostingRegressor(n_estimators=100, random_state=42),
                "xgboost": GradientBoostingRegressor(n_estimators=200, learning_rate=0.1, max_depth=5, random_state=42),
                "linear_regression": LinearRegression(),
                "svm": SVR(),
                "svr": SVR(),
                "knn": KNeighborsRegressor(n_neighbors=5),
                "knn_regressor": KNeighborsRegressor(n_neighbors=5),
                "decision_tree": DecisionTreeRegressor(max_depth=10, random_state=42),
                "decision_tree_regressor": DecisionTreeRegressor(max_depth=10, random_state=42),
            }
            return regressors.get(algo, RandomForestRegressor(n_estimators=100, random_state=42))

    def explain_model(self, model_name: str) -> dict[str, Any]:
        path = self.model_dir / model_name
        if not path.exists():
            raise FileNotFoundError("Model not found")
        artifact = self._load_artifact(model_name)
        model = artifact["model"]
        features = artifact["features"]
        importances = getattr(model, "feature_importances_", None)
        if importances is not None:
            importance_map = dict(zip(features, [float(i) for i in importances]))
        elif hasattr(model, "coef_"):
            coefs = np.abs(model.coef_).flatten()
            if len(coefs) == len(features):
                importance_map = dict(zip(features, [float(c) for c in coefs]))
            else:
                importance_map = {f: 1.0 / max(len(features), 1) for f in features}
        else:
            importance_map = {f: 1.0 / max(len(features), 1) for f in features}
        sorted_imp = dict(sorted(importance_map.items(), key=lambda item: item[1], reverse=True)[:20])

        # Generate plain-text explanation
        top_features = list(sorted_imp.keys())[:5]
        explanation_text = (
            f"Model '{model_name}' ({type(model).__name__}) uses {len(features)} features. "
            f"The top contributing features are: {', '.join(top_features)}. "
        )
        metrics = artifact.get("metrics", {})
        if "accuracy" in metrics:
            explanation_text += f"The model achieves {metrics['accuracy']:.1%} accuracy on the test set."
        elif "r2" in metrics:
            explanation_text += f"The model achieves an R² score of {metrics['r2']:.4f} on the test set."

        return {
            "model_name": model_name,
            "feature_importances": sorted_imp,
            "top_feature": next(iter(sorted_imp.keys()), None),
            "explanation": explanation_text,
            "model_type": type(model).__name__,
            "metrics": metrics,
        }

    def delete_model(self, model_name: str) -> dict[str, Any]:
        path = self.model_dir / model_name
        if not path.exists():
            raise FileNotFoundError("Model not found")
        path.unlink()
        return {"status": "deleted", "model_name": model_name}

    def _load_artifact(self, model_name: str) -> dict[str, Any]:
        path = self.model_dir / model_name
        if not path.exists():
            raise FileNotFoundError("Model not found")
        with open(path, "rb") as file:
            return pickle.load(file)

    def _load_dataframe(self, path: str) -> pd.DataFrame:

        suffix = Path(path).suffix.lower()
        if suffix == ".csv":
            return pd.read_csv(path)
        if suffix in {".xlsx", ".xls"}:
            return pd.read_excel(path)
        if suffix == ".json":
            return pd.read_json(path)
        raise ValueError("Unsupported dataset type for ML training")
