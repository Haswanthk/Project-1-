"""
Fault Injection Engine for Claim-Level Trust Research Evaluation.
Applies deterministic perturbations on evaluation copies only; original files are untouched.
"""
from dataclasses import dataclass
from enum import Enum
from typing import Dict, Any, List, Optional, Tuple
import numpy as np
import pandas as pd


class FaultType(str, Enum):
    CLEAN = "clean"
    NUMERIC_SHIFT_SMALL = "numeric_shift_small"
    NUMERIC_SHIFT_MODERATE = "numeric_shift_moderate"
    NUMERIC_SHIFT_SEVERE = "numeric_shift_severe"
    CATEGORICAL_DISTRIBUTION_SHIFT = "categorical_distribution_shift"
    UNSEEN_CATEGORICAL_INJECTION = "unseen_categorical_injection"
    MISSING_VALUE_LOW = "missing_value_low"
    MISSING_VALUE_MODERATE = "missing_value_moderate"
    MISSING_VALUE_HIGH = "missing_value_high"
    INSUFFICIENT_DATA = "insufficient_data"
    SCHEMA_CORRUPTION = "schema_corruption"
    UNRELATED_FEATURE_DRIFT = "unrelated_feature_drift"
    ARITHMETIC_HALLUCINATION = "arithmetic_hallucination"
    COMBINED_DRIFT_AND_ARITHMETIC = "combined_drift_and_arithmetic"

    # Backward-compatibility aliases
    NUMERIC_DISTRIBUTION_SHIFT = "numeric_distribution_shift"
    MISSING_VALUE_INJECTION = "missing_value_injection"
    UNSUPPORTED_METRIC = "unsupported_metric"
    STALE_DATA = "stale_data"
    MISSING_LINEAGE_HANDLE = "missing_lineage_handle"


@dataclass(frozen=True)
class FaultScenario:
    scenario_id: str
    fault_type: FaultType
    target_column: Optional[str]
    description: str
    expected_signal: str
    expected_release_decision: str  # "VERIFIED", "QUALIFIED", "WITHHELD"
    seed: int = 42
    magnitude: float = 0.0
    unrelated_column: Optional[str] = None


class FaultInjector:
    """Applies isolated, deterministic mutations onto copies of evaluation datasets."""

    def __init__(self, random_seed: int = 42):
        self.random_seed = random_seed

    def inject(self, df: pd.DataFrame, scenario: FaultScenario) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """
        Returns a perturbed deep-copy of df along with fault execution metadata.
        """
        mutated_df = df.copy(deep=True)
        meta = {
            "scenario_id": scenario.scenario_id,
            "fault_type": scenario.fault_type.value,
            "target_column": scenario.target_column,
            "magnitude": scenario.magnitude,
            "applied": False,
        }

        col = scenario.target_column

        if scenario.fault_type == FaultType.CLEAN:
            meta["applied"] = True
            return mutated_df, meta

        # Numerical Shifts (Small 0.5x, Moderate 1.5x, Severe 3.0x std)
        if scenario.fault_type in (
            FaultType.NUMERIC_SHIFT_SMALL,
            FaultType.NUMERIC_SHIFT_MODERATE,
            FaultType.NUMERIC_SHIFT_SEVERE,
            FaultType.NUMERIC_DISTRIBUTION_SHIFT,
            FaultType.COMBINED_DRIFT_AND_ARITHMETIC,
        ):
            if col and col in mutated_df.columns and pd.api.types.is_numeric_dtype(mutated_df[col]):
                std_val = float(mutated_df[col].std()) if mutated_df[col].std() > 0 else 1.0
                if scenario.fault_type == FaultType.NUMERIC_SHIFT_SMALL:
                    multiplier = 0.5
                elif scenario.fault_type == FaultType.NUMERIC_SHIFT_MODERATE:
                    multiplier = 1.5
                else:
                    multiplier = scenario.magnitude if scenario.magnitude > 0 else 3.0
                mutated_df[col] = mutated_df[col] + (multiplier * std_val)
                meta["applied"] = True
                meta["shift_multiplier"] = multiplier
            return mutated_df, meta

        if scenario.fault_type == FaultType.UNRELATED_FEATURE_DRIFT:
            # Shift unrelated feature only, leaving target_column completely untouched
            target_to_shift = scenario.unrelated_column or col
            if target_to_shift and target_to_shift in mutated_df.columns and pd.api.types.is_numeric_dtype(mutated_df[target_to_shift]):
                std_val = float(mutated_df[target_to_shift].std()) if mutated_df[target_to_shift].std() > 0 else 1.0
                multiplier = scenario.magnitude if scenario.magnitude > 0 else 3.0
                mutated_df[target_to_shift] = mutated_df[target_to_shift] + (multiplier * std_val)
                meta["applied"] = True
                meta["shifted_unrelated_column"] = target_to_shift
            return mutated_df, meta

        # Missing Value Injections: Low (5%), Moderate (15%), High (50%)
        if scenario.fault_type in (
            FaultType.MISSING_VALUE_LOW,
            FaultType.MISSING_VALUE_MODERATE,
            FaultType.MISSING_VALUE_HIGH,
            FaultType.MISSING_VALUE_INJECTION,
        ):
            if col and col in mutated_df.columns:
                if scenario.fault_type == FaultType.MISSING_VALUE_LOW:
                    null_rate = 0.05
                elif scenario.fault_type == FaultType.MISSING_VALUE_MODERATE:
                    null_rate = 0.15
                else:
                    null_rate = scenario.magnitude if scenario.magnitude > 0 else 0.50
                rng = np.random.RandomState(scenario.seed)
                mask = rng.rand(len(mutated_df)) < null_rate
                mutated_df.loc[mask, col] = np.nan
                meta["applied"] = True
                meta["injected_null_rate"] = null_rate
            return mutated_df, meta

        # Small sample / Insufficient data case (N < 5)
        if scenario.fault_type == FaultType.INSUFFICIENT_DATA:
            n_sub = min(4, len(mutated_df))
            mutated_df = mutated_df.iloc[:n_sub].copy().reset_index(drop=True)
            meta["applied"] = True
            meta["subsample_size"] = n_sub
            return mutated_df, meta

        # Schema Corruption
        if scenario.fault_type == FaultType.SCHEMA_CORRUPTION:
            if col and col in mutated_df.columns:
                mutated_df = mutated_df.rename(columns={col: f"{col}_corrupted_x"})
                meta["applied"] = True
            return mutated_df, meta

        # Categorical Shifts and Unseen Categories
        if scenario.fault_type == FaultType.CATEGORICAL_DISTRIBUTION_SHIFT:
            if col and col in mutated_df.columns:
                # Frequency distortion / swap categories deterministically
                cats = list(mutated_df[col].dropna().unique())
                if len(cats) >= 2:
                    swap_map = {cats[i]: cats[(i + 1) % len(cats)] for i in range(len(cats))}
                    mutated_df[col] = mutated_df[col].map(swap_map).fillna(mutated_df[col])
                meta["applied"] = True
            return mutated_df, meta

        if scenario.fault_type == FaultType.UNSEEN_CATEGORICAL_INJECTION:
            if col and col in mutated_df.columns:
                # Inject 40% novel unseen category
                rng = np.random.RandomState(scenario.seed)
                mask = rng.rand(len(mutated_df)) < 0.40
                mutated_df.loc[mask, col] = "unseen_category_novel"
                meta["applied"] = True
            return mutated_df, meta

        # Hallucinations affect claim definition rather than raw dataframe
        meta["applied"] = True
        return mutated_df, meta

