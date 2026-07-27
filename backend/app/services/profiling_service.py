import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd


class ProfilingService:
    def load_dataset(self, path: str) -> pd.DataFrame:
        file = Path(path)
        suffix = file.suffix.lower()
        if suffix == ".csv":
            return pd.read_csv(path)
        if suffix in {".xlsx", ".xls"}:
            return pd.read_excel(path)
        if suffix == ".json":
            return pd.read_json(path)
        raise ValueError(f"Unsupported file format: {suffix}")

    def profile(self, frame: pd.DataFrame) -> dict[str, Any]:
        numeric = frame.select_dtypes(include=["number"])
        correlations = numeric.corr().fillna(0.0) if not numeric.empty else pd.DataFrame()
        outliers: dict[str, int] = {}
        for column in numeric.columns:
            q1 = numeric[column].quantile(0.25)
            q3 = numeric[column].quantile(0.75)
            iqr = q3 - q1
            if iqr == 0:
                outliers[column] = 0
                continue
            mask = (numeric[column] < (q1 - 1.5 * iqr)) | (numeric[column] > (q3 + 1.5 * iqr))
            outliers[column] = int(mask.sum())

        class_imbalance: dict[str, float] = {}
        for column in frame.select_dtypes(include=["object", "category"]).columns:
            value_counts = frame[column].value_counts(normalize=True, dropna=False)
            class_imbalance[column] = float(value_counts.max()) if not value_counts.empty else 0.0

        chart_payload = {
            "histograms": {
                col: np.histogram(numeric[col].dropna(), bins=10)[0].tolist() for col in numeric.columns
            },
            "correlation_matrix": correlations.to_dict(),
        }
        return {
            "schema": {column: str(dtype) for column, dtype in frame.dtypes.items()},
            "statistics": json.loads(frame.describe(include="all").fillna("").to_json()),
            "missing_values": frame.isna().sum().astype(int).to_dict(),
            "duplicates": int(frame.duplicated().sum()),
            "unique_values": frame.nunique(dropna=False).astype(int).to_dict(),
            "correlations": correlations.to_dict(),
            "outliers": outliers,
            "class_imbalance": class_imbalance,
            "chart_payload": chart_payload,
        }

    def compute_pca(self, frame: pd.DataFrame, n_components: int = 2) -> dict[str, Any]:
        numeric = frame.select_dtypes(include=["number"]).dropna()
        if numeric.empty or numeric.shape[1] < 2:
            return {"components": [], "explained_variance": [], "columns": list(numeric.columns)}
        from sklearn.decomposition import PCA
        from sklearn.preprocessing import StandardScaler

        scaled = StandardScaler().fit_transform(numeric)
        n_comps = min(n_components, numeric.shape[1])
        pca = PCA(n_components=n_comps)
        coords = pca.fit_transform(scaled)
        return {
            "components": coords.tolist(),
            "explained_variance": [float(v) for v in pca.explained_variance_ratio_],
            "columns": list(numeric.columns),
        }


