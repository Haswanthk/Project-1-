"""
Feature Drift Detection and Upstream Lineage Quality Service.
Implements two-sample Kolmogorov-Smirnov (KS) testing, Population Stability Index (PSI),
Benjamini-Hochberg FDR adjustments, and serialized reference baselines.
Zero external network calls; isolated statistical computing.
"""
from dataclasses import dataclass, field, asdict
from datetime import datetime, UTC
from enum import Enum
from typing import Dict, List, Optional, Tuple, Any
import hashlib
import json
import math
import numpy as np
import pandas as pd
from scipy import stats


class DriftState(str, Enum):
    STABLE = "STABLE"
    DRIFT = "DRIFT"
    MODERATE_DRIFT = "MODERATE_DRIFT"
    SEVERE_DRIFT = "SEVERE_DRIFT"
    INSUFFICIENT_DATA = "INSUFFICIENT_DATA"
    UNKNOWN = "UNKNOWN"


@dataclass
class FeatureDriftResult:
    feature_name: str
    feature_type: str  # "numerical" or "categorical"
    reference_sample_count: int
    current_sample_count: int
    drift_state: DriftState
    ks_statistic: Optional[float] = None
    ks_p_value: Optional[float] = None
    ks_p_value_adjusted: Optional[float] = None
    psi_score: Optional[float] = None
    unseen_category_rate: Optional[float] = None
    significance_level: float = 0.05
    psi_warn_threshold: float = 0.10
    psi_fail_threshold: float = 0.25
    evaluation_timestamp: str = field(default_factory=lambda: datetime.now(UTC).isoformat())
    explanation: str = ""

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["drift_state"] = self.drift_state.value
        return d


@dataclass
class DriftConfig:
    alpha: float = 0.05
    psi_warn: float = 0.10
    psi_fail: float = 0.25
    psi_threshold: float = 0.25
    psi_warning_threshold: float = 0.10
    min_sample_size: int = 5
    num_bins: int = 10
    epsilon: float = 1e-4
    random_seed: int = 42


@dataclass
class BaselineProfile:
    baseline_id: str
    dataset_name: str
    creation_timestamp: str
    protocol_version: str
    sample_count: int
    numeric_bin_edges: Dict[str, List[float]]  # column -> bin boundaries
    categorical_vocabularies: Dict[str, Dict[str, float]]  # column -> category probabilities
    baseline_hash: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class DriftDetectionService:
    """
    Statistically robust, reproducible feature-drift detector.
    Computes two-sample KS test and PSI on reference vs. current distribution.
    """

    def __init__(
        self,
        config: Optional[DriftConfig] = None,
        alpha: float = 0.05,
        psi_warn: float = 0.10,
        psi_fail: float = 0.25,
        min_sample_size: int = 5,
        num_bins: int = 10,
        epsilon: float = 1e-4,
    ):
        if config is not None:
            self.config = config
        else:
            self.config = DriftConfig(
                alpha=alpha,
                psi_warn=psi_warn,
                psi_fail=psi_fail,
                psi_threshold=psi_fail,
                psi_warning_threshold=psi_warn,
                min_sample_size=min_sample_size,
                num_bins=num_bins,
                epsilon=epsilon,
            )
        self.alpha = self.config.alpha
        self.psi_warn = self.config.psi_warning_threshold or self.config.psi_warn
        self.psi_fail = self.config.psi_threshold or self.config.psi_fail
        self.psi_warn_threshold = self.psi_warn
        self.psi_fail_threshold = self.psi_fail
        self.psi_threshold = self.psi_fail
        self.psi_warning_threshold = self.psi_warn
        self.min_sample_size = self.config.min_sample_size
        self.num_bins = self.config.num_bins
        self.epsilon = self.config.epsilon

    def create_reference_baseline(
        self,
        reference_df: Optional[pd.DataFrame] = None,
        dataset_name: str = "dataset",
        protocol_version: str = "1.0.0",
        df: Optional[pd.DataFrame] = None,
        dataset_id: Optional[str] = None,
        feature_names: Optional[List[str]] = None,
    ) -> BaselineProfile:
        """
        Fits baseline bin edges and category vocabularies exclusively on reference (training) data.
        Returns a deterministic, serializable baseline profile with cryptographic identity.
        """
        target_df = reference_df if reference_df is not None else df
        if target_df is None:
            raise ValueError("Must provide reference dataframe")
        effective_dataset_name = dataset_id or dataset_name

        bin_edges: Dict[str, List[float]] = {}
        vocabularies: Dict[str, Dict[str, float]] = {}

        cols_to_profile = feature_names if feature_names else list(target_df.columns)

        for col in cols_to_profile:
            if col not in target_df.columns:
                continue
            series = target_df[col].dropna()
            if series.empty:
                continue

            if pd.api.types.is_numeric_dtype(series):
                # Derive exact reference quantile boundaries
                quantiles = np.linspace(0.0, 1.0, self.num_bins + 1)
                edges = np.unique(np.quantile(series, quantiles))
                if len(edges) < 2:
                    # Constant feature fallback
                    val = float(edges[0])
                    edges = np.array([val - 1.0, val + 1.0])
                else:
                    # Expand outer boundaries to cover all future values
                    edges[0] = -np.inf
                    edges[-1] = np.inf
                bin_edges[col] = edges.tolist()
            else:
                # Categorical vocabulary and base probabilities
                counts = series.astype(str).value_counts(normalize=True)
                vocabularies[col] = counts.to_dict()

        # Deterministic hashing of profile contents
        profile_content = json.dumps(
            {"bins": bin_edges, "vocab": vocabularies, "dataset": effective_dataset_name, "version": protocol_version},
            sort_keys=True,
        )
        profile_hash = hashlib.sha256(profile_content.encode("utf-8")).hexdigest()
        baseline_id = f"base_{profile_hash[:16]}"

        return BaselineProfile(
            baseline_id=baseline_id,
            dataset_name=effective_dataset_name,
            creation_timestamp=datetime.now(UTC).isoformat(),
            protocol_version=protocol_version,
            sample_count=len(target_df),
            numeric_bin_edges=bin_edges,
            categorical_vocabularies=vocabularies,
            baseline_hash=profile_hash,
        )

    @staticmethod
    def _to_clean_numeric(arr: Any) -> np.ndarray:
        if isinstance(arr, pd.Series):
            return pd.to_numeric(arr, errors="coerce").dropna().values
        s = pd.Series(arr)
        return pd.to_numeric(s, errors="coerce").dropna().values

    @staticmethod
    def _to_clean_categorical(arr: Any) -> pd.Series:
        if isinstance(arr, pd.Series):
            return arr.dropna().astype(str)
        return pd.Series(arr).dropna().astype(str)

    def calculate_ks_test(
        self,
        ref_series: Any,
        curr_series: Any,
    ) -> Tuple[Optional[float], Optional[float], DriftState, str]:
        """
        Two-sample Kolmogorov-Smirnov test for continuous numerical features.
        """
        ref_clean = self._to_clean_numeric(ref_series)
        curr_clean = self._to_clean_numeric(curr_series)

        if len(ref_clean) < self.min_sample_size or len(curr_clean) < self.min_sample_size:
            return (
                None,
                None,
                DriftState.INSUFFICIENT_DATA,
                f"Sample size below threshold ({len(ref_clean)} ref, {len(curr_clean)} curr < {self.min_sample_size}).",
            )

        # Constant identical samples check
        if np.all(ref_clean == ref_clean[0]) and np.all(curr_clean == ref_clean[0]):
            return 0.0, 1.0, DriftState.STABLE, "Both distributions are identical constant values."

        ks_stat, p_val = stats.ks_2samp(ref_clean, curr_clean)
        ks_stat = float(ks_stat)
        p_val = float(p_val)

        state = DriftState.DRIFT if p_val < self.alpha else DriftState.STABLE
        msg = f"KS stat={ks_stat:.4f}, p={p_val:.4e} (alpha={self.alpha})."
        return ks_stat, p_val, state, msg

    def calculate_numerical_psi(
        self,
        ref_series: Any,
        curr_series: Any,
        edges: Optional[List[float]] = None,
    ) -> Tuple[Optional[float], DriftState, str]:
        """
        Population Stability Index for numerical features using fixed reference bin edges.
        """
        ref_clean = self._to_clean_numeric(ref_series)
        curr_clean = self._to_clean_numeric(curr_series)

        if len(ref_clean) < self.min_sample_size or len(curr_clean) < self.min_sample_size:
            return None, DriftState.INSUFFICIENT_DATA, "Insufficient sample size for numerical PSI."

        if edges is None:
            quantiles = np.linspace(0.0, 1.0, self.num_bins + 1)
            edges_arr = np.unique(np.quantile(ref_clean, quantiles))
            if len(edges_arr) < 2:
                edges_arr = np.array([-np.inf, np.inf])
            else:
                edges_arr[0] = -np.inf
                edges_arr[-1] = np.inf
        else:
            edges_arr = np.array(edges)

        ref_counts, _ = np.histogram(ref_clean, bins=edges_arr)
        curr_counts, _ = np.histogram(curr_clean, bins=edges_arr)

        # Smooth zero counts
        ref_pct = (ref_counts + self.epsilon) / (len(ref_clean) + self.epsilon * len(ref_counts))
        curr_pct = (curr_counts + self.epsilon) / (len(curr_clean) + self.epsilon * len(curr_counts))

        psi = float(np.sum((curr_pct - ref_pct) * np.log(curr_pct / ref_pct)))

        if psi >= self.psi_fail:
            state = DriftState.SEVERE_DRIFT
        elif psi >= self.psi_warn:
            state = DriftState.MODERATE_DRIFT
        else:
            state = DriftState.STABLE

        msg = f"Numerical PSI={psi:.4f} (warn={self.psi_warn}, fail={self.psi_fail})."
        return psi, state, msg

    def calculate_categorical_psi(
        self,
        ref_series: Any,
        curr_series: Any,
        vocabulary: Optional[Dict[str, float]] = None,
    ) -> Tuple[Optional[float], float, DriftState, str]:
        """
        Population Stability Index for categorical features with explicit unseen-category handling.
        """
        ref_clean = self._to_clean_categorical(ref_series)
        curr_clean = self._to_clean_categorical(curr_series)

        if len(ref_clean) < self.min_sample_size or len(curr_clean) < self.min_sample_size:
            return None, 0.0, DriftState.INSUFFICIENT_DATA, "Insufficient sample size for categorical PSI."

        vocab = set(vocabulary.keys()) if vocabulary else set(ref_clean.unique())
        vocab_list = sorted(list(vocab)) + ["_OTHER_UNSEEN_"]

        # Map unseen categories to _OTHER_UNSEEN_
        ref_mapped = ref_clean.apply(lambda x: x if x in vocab else "_OTHER_UNSEEN_")
        curr_mapped = curr_clean.apply(lambda x: x if x in vocab else "_OTHER_UNSEEN_")

        unseen_count = (curr_mapped == "_OTHER_UNSEEN_").sum()
        unseen_rate = float(unseen_count / len(curr_clean)) if len(curr_clean) > 0 else 0.0

        ref_counts = ref_mapped.value_counts()
        curr_counts = curr_mapped.value_counts()

        ref_dist = np.array([ref_counts.get(cat, 0) for cat in vocab_list], dtype=float)
        curr_dist = np.array([curr_counts.get(cat, 0) for cat in vocab_list], dtype=float)

        ref_pct = (ref_dist + self.epsilon) / (len(ref_clean) + self.epsilon * len(vocab_list))
        curr_pct = (curr_dist + self.epsilon) / (len(curr_clean) + self.epsilon * len(vocab_list))

        psi = float(np.sum((curr_pct - ref_pct) * np.log(curr_pct / ref_pct)))

        if psi >= self.psi_fail or unseen_rate > 0.20:
            state = DriftState.SEVERE_DRIFT
        elif psi >= self.psi_warn or unseen_rate > 0.05:
            state = DriftState.MODERATE_DRIFT
        else:
            state = DriftState.STABLE

        msg = f"Categorical PSI={psi:.4f}, unseen_rate={unseen_rate:.2%}."
        return psi, unseen_rate, state, msg

    @staticmethod
    def adjust_p_values_fdr(p_values: List[float]) -> List[float]:
        """
        Benjamini-Hochberg False Discovery Rate (FDR) adjustment for multiple feature tests.
        """
        n = len(p_values)
        if n == 0:
            return []
        
        # Track original indices
        sorted_indices = np.argsort(p_values)
        sorted_p = np.array(p_values)[sorted_indices]
        
        adjusted = np.zeros(n)
        for i in range(n):
            adjusted[i] = sorted_p[i] * n / (i + 1)
        
        # Enforce monotonicity backwards
        for i in range(n - 2, -1, -1):
            adjusted[i] = min(adjusted[i], adjusted[i + 1])
        
        adjusted = np.clip(adjusted, 0.0, 1.0)
        
        # Reconstruct original order
        final_adjusted = np.zeros(n)
        final_adjusted[sorted_indices] = adjusted
        return final_adjusted.tolist()

    def evaluate_feature(
        self,
        ref_series: pd.Series,
        curr_series: pd.Series,
        feature_name: str,
        baseline: Optional[BaselineProfile] = None,
    ) -> FeatureDriftResult:
        """
        Full feature-level evaluation combining KS test (if numerical) and PSI.
        """
        is_num = pd.api.types.is_numeric_dtype(ref_series)
        f_type = "numerical" if is_num else "categorical"

        n_ref = len(ref_series.dropna())
        n_curr = len(curr_series.dropna())

        if is_num:
            ks_stat, p_val, ks_state, ks_msg = self.calculate_ks_test(ref_series, curr_series)
            edges = baseline.numeric_bin_edges.get(feature_name) if baseline else None
            psi_val, psi_state, psi_msg = self.calculate_numerical_psi(ref_series, curr_series, edges)

            # Robust statistical decision for numerical features:
            # - Severe drift: KS test rejects null AND PSI indicates significant shift (>= psi_warn), OR PSI severely shifts (>= psi_fail and ks p < 0.10)
            # - Moderate drift: either KS rejects null (p < alpha) or PSI warning reached
            if (ks_state == DriftState.DRIFT and psi_state in (DriftState.MODERATE_DRIFT, DriftState.SEVERE_DRIFT)) or (psi_state == DriftState.SEVERE_DRIFT and p_val is not None and p_val < 0.10):
                combined_state = DriftState.SEVERE_DRIFT
            elif ks_state == DriftState.DRIFT or psi_state == DriftState.MODERATE_DRIFT:
                combined_state = DriftState.MODERATE_DRIFT
            elif ks_state == DriftState.INSUFFICIENT_DATA or psi_state == DriftState.INSUFFICIENT_DATA:
                combined_state = DriftState.INSUFFICIENT_DATA
            else:
                combined_state = DriftState.STABLE

            explanation = f"{ks_msg} | {psi_msg}"
            return FeatureDriftResult(
                feature_name=feature_name,
                feature_type=f_type,
                reference_sample_count=n_ref,
                current_sample_count=n_curr,
                drift_state=combined_state,
                ks_statistic=ks_stat,
                ks_p_value=p_val,
                ks_p_value_adjusted=p_val,  # updated in batch if multiple features
                psi_score=psi_val,
                unseen_category_rate=None,
                significance_level=self.alpha,
                psi_warn_threshold=self.psi_warn,
                psi_fail_threshold=self.psi_fail,
                explanation=explanation,
            )
        else:
            vocab = baseline.categorical_vocabularies.get(feature_name) if baseline else None
            psi_val, unseen_rate, cat_state, cat_msg = self.calculate_categorical_psi(ref_series, curr_series, vocab)

            return FeatureDriftResult(
                feature_name=feature_name,
                feature_type=f_type,
                reference_sample_count=n_ref,
                current_sample_count=n_curr,
                drift_state=cat_state,
                ks_statistic=None,
                ks_p_value=None,
                ks_p_value_adjusted=None,
                psi_score=psi_val,
                unseen_category_rate=unseen_rate,
                significance_level=self.alpha,
                psi_warn_threshold=self.psi_warn,
                psi_fail_threshold=self.psi_fail,
                explanation=cat_msg,
            )

    def evaluate_dataset_drift(
        self,
        ref_df: Optional[pd.DataFrame] = None,
        curr_df: Optional[pd.DataFrame] = None,
        baseline: Optional[BaselineProfile] = None,
        train_df: Optional[pd.DataFrame] = None,
        current_df: Optional[pd.DataFrame] = None,
    ) -> Dict[str, FeatureDriftResult]:
        """
        Evaluates drift across all common features and applies Benjamini-Hochberg FDR correction.
        """
        effective_ref = ref_df if ref_df is not None else train_df
        effective_curr = curr_df if curr_df is not None else current_df
        if effective_ref is None or effective_curr is None:
            raise ValueError("Must provide reference and current datasets")

        results: Dict[str, FeatureDriftResult] = {}
        num_features = []
        raw_p_values = []

        common_cols = [c for c in effective_ref.columns if c in effective_curr.columns]
        for col in common_cols:
            res = self.evaluate_feature(effective_ref[col], effective_curr[col], col, baseline)
            results[col] = res
            if res.feature_type == "numerical" and res.ks_p_value is not None:
                num_features.append(col)
                raw_p_values.append(res.ks_p_value)

        # Apply FDR correction across numerical features
        if raw_p_values:
            adj_p_values = self.adjust_p_values_fdr(raw_p_values)
            for col, adj_p in zip(num_features, adj_p_values):
                results[col].ks_p_value_adjusted = round(adj_p, 6)

        return results
