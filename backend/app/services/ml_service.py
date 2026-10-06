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


def _to_json_safe(obj: Any) -> Any:
    """Recursively convert numpy/pandas types to native Python JSON-serializable types."""
    if isinstance(obj, dict):
        return {str(k): _to_json_safe(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple, set)):
        return [_to_json_safe(item) for item in obj]
    elif isinstance(obj, np.ndarray):
        return [_to_json_safe(item) for item in obj.tolist()]
    elif isinstance(obj, (np.integer,)):
        return int(obj)
    elif isinstance(obj, (np.floating,)):
        val = float(obj)
        if np.isnan(val) or np.isinf(val):
            return None
        return val
    elif isinstance(obj, (np.bool_,)):
        return bool(obj)
    elif isinstance(obj, float):
        if np.isnan(obj) or np.isinf(obj):
            return None
        return obj
    return obj


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
        col_lookup = {str(c).strip().lower(): str(c).strip() for c in df.columns}

        target_raw = str(payload.target_column).strip()
        if target_raw.lower() not in col_lookup:
            raise ValueError(f"Target column '{target_raw}' not found in dataset. Available columns: {list(df.columns)}")
        target_col_clean = col_lookup[target_raw.lower()]

        algo = (payload.algorithm_id or payload.algorithm or "random_forest").lower()

        # Resolve feature columns with case & whitespace resilience
        raw_features = payload.feature_columns or payload.features
        if isinstance(raw_features, str):
            candidate_cols = [c.strip() for c in raw_features.split(",") if c.strip()]
        elif isinstance(raw_features, list) and len(raw_features) > 0:
            candidate_cols = [str(c).strip() for c in raw_features if str(c).strip()]
        else:
            candidate_cols = [c for c in df.columns if c != target_col_clean]

        feature_cols = []
        for c in candidate_cols:
            c_low = str(c).strip().lower()
            if c_low in col_lookup and col_lookup[c_low] != target_col_clean:
                actual_name = col_lookup[c_low]
                if actual_name not in feature_cols:
                    feature_cols.append(actual_name)

        if not feature_cols:
            feature_cols = [c for c in df.columns if c != target_col_clean]

        # Auto-detect problem type if not supplied
        problem_type = (payload.problem_type or "").lower().strip()
        if not problem_type:
            target_series = df[target_col_clean].dropna()
            if target_series.dtype == object or target_series.nunique() <= 10:
                problem_type = "classification"
            else:
                problem_type = "regression"

        x_raw = df[feature_cols].copy()
        
        # Clean missing values intelligently for high accuracy
        num_cols_raw = x_raw.select_dtypes(include=np.number).columns
        cat_cols_raw = x_raw.select_dtypes(exclude=np.number).columns
        for col in num_cols_raw:
            median_val = x_raw[col].median()
            x_raw[col] = x_raw[col].fillna(median_val if not pd.isna(median_val) else 0.0)
        for col in cat_cols_raw:
            mode_series = x_raw[col].mode()
            mode_val = mode_series[0] if not mode_series.empty else "unknown"
            x_raw[col] = x_raw[col].fillna(mode_val)

        # Encode categorical features with one-hot encoding
        x = pd.get_dummies(x_raw, drop_first=True, dtype=float).fillna(0.0)
        y = df[target_col_clean].copy()

        # Handle missing in target
        if y.isna().any():
            valid_idx = y.dropna().index
            x = x.loc[valid_idx]
            y = y.loc[valid_idx]

        # For classification, encode string labels
        label_encoder = None
        if problem_type == "classification":
            if y.dtype == object or str(y.dtype) == "category" or not np.issubdtype(y.dtype, np.number):
                label_encoder = LabelEncoder()
                y = pd.Series(label_encoder.fit_transform(y.astype(str)), index=y.index)
            else:
                # Numerical labels (e.g. 0, 1, 2)
                label_encoder = LabelEncoder()
                y = pd.Series(label_encoder.fit_transform(y), index=y.index)

        # Stratify classification train/test split if each class has >= 2 samples
        stratify_target = None
        if problem_type == "classification" and len(y) > 0:
            val_counts = y.value_counts()
            if val_counts.min() >= 2:
                stratify_target = y

        x_train, x_test, y_train, y_test = train_test_split(
            x, y, test_size=payload.test_size, random_state=42, stratify=stratify_target
        )

        # Scale features for algorithms that benefit from it
        scaler = None
        if algo in ("svm", "svc", "svr", "knn", "knn_classifier", "knn_regressor",
                     "logistic_regression", "linear_regression"):
            scaler = StandardScaler()
            x_train = pd.DataFrame(scaler.fit_transform(x_train), columns=x_train.columns, index=x_train.index)
            x_test = pd.DataFrame(scaler.transform(x_test), columns=x_test.columns, index=x_test.index)

        # Select model based on algorithm_id
        model = self._build_model(algo, problem_type)

        # ── Fit model & extract hyperparameters ───────────────────────────
        best_params: dict[str, Any] = {}
        if payload.hyperparameters:
            model.set_params(**payload.hyperparameters)
            best_params = payload.hyperparameters

        model.fit(x_train, y_train)
        if not best_params:
            for param in ["n_estimators", "max_depth", "learning_rate", "C", "n_neighbors"]:
                if hasattr(model, param):
                    val = getattr(model, param)
                    if val is not None:
                        best_params[param] = val

        predictions = model.predict(x_test)

        # Build metrics dict
        metrics: dict[str, Any] = {}
        if problem_type == "classification":
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
            residuals = y_test.values - predictions
            metrics["residual_mean"] = float(round(float(np.mean(residuals)), 4))
            metrics["residual_std"] = float(round(float(np.std(residuals)), 4))
            metrics["scatter_preview"] = [
                {"actual": float(round(float(a), 3)), "predicted": float(round(float(p), 3)), "residual": float(round(float(a - p), 3))}
                for a, p in zip(y_test.values[:30], predictions[:30])
            ]

        try:
            with mlflow.start_run(run_name=f"{algo}-{problem_type}"):
                for k, v in metrics.items():
                    if isinstance(v, float):
                        mlflow.log_metric(k, v)
                mlflow.log_param("problem_type", problem_type)
                mlflow.log_param("algorithm", algo)
                if best_params:
                    for pk, pv in best_params.items():
                        mlflow.log_param(pk, pv)
                mlflow.sklearn.log_model(model, artifact_path="model")
        except Exception:
            pass

        # Real cross-validation
        cv_scores: list[float] = []
        cv_mean: float | None = None
        cv_std: float | None = None
        if payload.cross_validation:
            cv_metric = "accuracy" if problem_type == "classification" else "r2"
            try:
                from sklearn.model_selection import StratifiedKFold, KFold
                if problem_type == "classification":
                    min_class_count = int(y.value_counts().min()) if len(y) > 0 else 2
                    n_splits = min(5, max(2, min_class_count))
                    cv_split = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)
                else:
                    cv_split = KFold(n_splits=5, shuffle=True, random_state=42)

                # If scaler was used, scale all data for CV
                if scaler is not None:
                    x_scaled = pd.DataFrame(scaler.fit_transform(x), columns=x.columns, index=x.index)
                    cv_results = cross_val_score(model, x_scaled, y, cv=cv_split, scoring=cv_metric)
                else:
                    cv_results = cross_val_score(model, x, y, cv=cv_split, scoring=cv_metric)
                cv_scores = [float(round(s, 4)) for s in cv_results]
                cv_mean = float(round(np.mean(cv_scores), 4))
                cv_std = float(round(np.std(cv_scores), 4))
            except Exception:
                pass

        raw_name = payload.model_name or f"{algo}_{payload.dataset_id}"
        clean_name = raw_name.replace(".pkl", "").strip()
        model_name = f"{clean_name}.pkl"
        with open(self.model_dir / model_name, "wb") as file:
            pickle.dump({
                "model": model,
                "features": list(x.columns),
                "problem_type": problem_type,
                "target_column": payload.target_column,
                "algorithm_id": algo,
                "metrics": metrics,
                "label_encoder": label_encoder,
                "scaler": scaler,
                "best_params": best_params,
                "training_samples": len(x_train),
                "test_samples": len(x_test),
                "feature_columns_original": feature_cols,
            }, file)

        # Feature importances
        feature_importance: dict[str, float] = {}
        importances = getattr(model, "feature_importances_", None)
        if importances is not None:
            feature_importance = {f: round(float(i), 4) for f, i in zip(x.columns, importances)}
        elif hasattr(model, "coef_"):
            coefs = np.abs(model.coef_).flatten()
            if len(coefs) == len(x.columns):
                feature_importance = {f: round(float(c), 4) for f, c in zip(x.columns, coefs)}

        return {
            "model_id": model_name,
            "model_name": model_name,
            "modelId": model_name,
            "modelName": model_name,
            "metrics": metrics,
            "feature_importance": feature_importance,
            "features_used": list(x.columns),
            "featuresUsed": list(x.columns),
            "cv_scores": cv_scores,
            "cvScores": cv_scores,
            "cv_mean": cv_mean,
            "cvMean": cv_mean,
            "cv_std": cv_std,
            "cvStd": cv_std,
            "best_params": best_params,
            "bestParams": best_params,
            "training_samples": len(x_train),
            "test_samples": len(x_test),
            "problem_type": problem_type,
            "algorithm": algo,
            "target_column": payload.target_column,
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
        col_lookup = {str(c).strip().lower(): str(c).strip() for c in df.columns}

        target_raw = str(target_column).strip()
        if target_raw.lower() not in col_lookup:
            raise ValueError(f"Target column '{target_raw}' not found in dataset. Available: {list(df.columns)}")
        target_col_clean = col_lookup[target_raw.lower()]

        candidate_cols = feature_columns or [c for c in df.columns if c != target_col_clean]
        feat_cols = []
        for c in candidate_cols:
            c_low = str(c).strip().lower()
            if c_low in col_lookup and col_lookup[c_low] != target_col_clean:
                actual_name = col_lookup[c_low]
                if actual_name not in feat_cols:
                    feat_cols.append(actual_name)

        if not feat_cols:
            feat_cols = [c for c in df.columns if c != target_col_clean]

        x_raw = df[feat_cols].copy()

        # Clean missing values intelligently
        num_cols_raw = x_raw.select_dtypes(include=np.number).columns
        cat_cols_raw = x_raw.select_dtypes(exclude=np.number).columns
        for col in num_cols_raw:
            median_val = x_raw[col].median()
            x_raw[col] = x_raw[col].fillna(median_val if not pd.isna(median_val) else 0.0)
        for col in cat_cols_raw:
            mode_series = x_raw[col].mode()
            mode_val = mode_series[0] if not mode_series.empty else "unknown"
            x_raw[col] = x_raw[col].fillna(mode_val)

        x = pd.get_dummies(x_raw, drop_first=True, dtype=float).fillna(0.0)
        y = df[target_col_clean].copy()

        if y.isna().any():
            valid_idx = y.dropna().index
            x = x.loc[valid_idx]
            y = y.loc[valid_idx]

        label_encoder = None
        if problem_type == "classification":
            label_encoder = LabelEncoder()
            y = pd.Series(label_encoder.fit_transform(y.astype(str)), index=y.index)

        stratify_target = None
        if problem_type == "classification" and len(y) > 0:
            val_counts = y.value_counts()
            if val_counts.min() >= 2:
                stratify_target = y

        x_train, x_test, y_train, y_test = train_test_split(
            x, y, test_size=test_size, random_state=42, stratify=stratify_target
        )

        if problem_type == "classification":
            algorithms = {
                "random_forest": RandomForestClassifier(n_estimators=100, random_state=42),
                "gradient_boosting": GradientBoostingClassifier(n_estimators=100, random_state=42),
                "xgboost": GradientBoostingClassifier(n_estimators=150, learning_rate=0.1, max_depth=4, random_state=42),
                "logistic_regression": LogisticRegression(max_iter=500, random_state=42),
                "decision_tree": DecisionTreeClassifier(max_depth=10, random_state=42),
                "knn": KNeighborsClassifier(n_neighbors=5),
                "svm": SVC(random_state=42),
            }
        else:
            algorithms = {
                "random_forest": RandomForestRegressor(n_estimators=100, random_state=42),
                "gradient_boosting": GradientBoostingRegressor(n_estimators=100, random_state=42),
                "xgboost": GradientBoostingRegressor(n_estimators=150, learning_rate=0.1, max_depth=4, random_state=42),
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
            df = pd.read_csv(path)
        elif suffix in {".xlsx", ".xls"}:
            df = pd.read_excel(path)
        elif suffix == ".json":
            df = pd.read_json(path)
        else:
            raise ValueError("Unsupported dataset type for ML training")
        df.columns = [str(c).strip() for c in df.columns]
        return df
