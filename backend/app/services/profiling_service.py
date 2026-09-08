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
            df = pd.read_csv(path)
        elif suffix in {".xlsx", ".xls"}:
            df = pd.read_excel(path)
        elif suffix == ".json":
            df = pd.read_json(path)
        else:
            raise ValueError(f"Unsupported file format: {suffix}")
        df.columns = [str(c).strip() for c in df.columns]
        return df

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

        distribution = self._distribution_analysis(numeric)
        data_quality = self._data_quality_score(frame, outliers)

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
            "distribution_analysis": distribution,
            "data_quality": data_quality,
        }

    def _distribution_analysis(self, numeric: pd.DataFrame) -> dict[str, Any]:
        """Compute skewness and kurtosis for each numeric column."""
        result: dict[str, Any] = {}
        for col in numeric.columns:
            series = numeric[col].dropna()
            if len(series) < 3:
                continue
            skew_val = float(series.skew())
            kurt_val = float(series.kurtosis())
            # Classify distribution shape
            if abs(skew_val) < 0.5:
                skew_label = "approximately symmetric"
            elif skew_val > 0:
                skew_label = "right-skewed (positive)"
            else:
                skew_label = "left-skewed (negative)"

            if kurt_val > 1:
                kurt_label = "leptokurtic (heavy tails)"
            elif kurt_val < -1:
                kurt_label = "platykurtic (light tails)"
            else:
                kurt_label = "mesokurtic (normal-like)"

            result[col] = {
                "skewness": round(skew_val, 4),
                "skewness_label": skew_label,
                "kurtosis": round(kurt_val, 4),
                "kurtosis_label": kurt_label,
                "range": float(series.max() - series.min()),
                "iqr": float(series.quantile(0.75) - series.quantile(0.25)),
                "coefficient_of_variation": round(float(series.std() / series.mean()), 4) if series.mean() != 0 else 0.0,
            }
        return result

    def _data_quality_score(self, frame: pd.DataFrame, outliers: dict[str, int]) -> dict[str, Any]:
        """Compute a data quality score across completeness, uniqueness, consistency."""
        total_cells = len(frame) * len(frame.columns) if len(frame.columns) > 0 else 1
        total_missing = int(frame.isna().sum().sum())
        completeness = max(0, round((1 - total_missing / total_cells) * 100, 1))

        duplicates = int(frame.duplicated().sum())
        uniqueness = max(0, round((1 - duplicates / max(len(frame), 1)) * 100, 1))

        total_outliers = sum(outliers.values())
        consistency = max(0, round((1 - total_outliers / max(total_cells, 1)) * 100, 1))

        overall = round(completeness * 0.4 + uniqueness * 0.3 + consistency * 0.3, 1)

        return {
            "overall_score": min(100, overall),
            "dimensions": {
                "completeness": completeness,
                "uniqueness": uniqueness,
                "consistency": consistency,
            },
            "details": {
                "total_cells": total_cells,
                "total_missing": total_missing,
                "total_duplicates": duplicates,
                "total_outliers": total_outliers,
            },
        }

    def compute_pca(self, frame: pd.DataFrame, n_components: int = 2) -> dict[str, Any]:
        numeric = frame.select_dtypes(include=["number"]).dropna()
        if numeric.empty or numeric.shape[1] < 2:
            return {"points": [], "explained_variance": [], "columns": list(numeric.columns)}
        from sklearn.decomposition import PCA
        from sklearn.preprocessing import StandardScaler

        scaled = StandardScaler().fit_transform(numeric)
        n_comps = min(n_components, numeric.shape[1])
        pca = PCA(n_components=n_comps)
        coords = pca.fit_transform(scaled)
        
        points = [{"x": float(row[0]), "y": float(row[1])} for row in coords] if coords.shape[1] >= 2 else []
        
        return {
            "points": points,
            "explained_variance": [float(v) for v in pca.explained_variance_ratio_],
            "columns": list(numeric.columns),
        }
