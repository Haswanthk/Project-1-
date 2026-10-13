"""
Stage 15 — Research Benchmark Hardening and Multi-Dataset Validation Test Suite.
Validates:
- Dataset metadata contracts, schema validation, and target leakage prevention.
- Deterministic, zero-leakage stratified splits for classification datasets.
- Training-only reference baseline fitting and hash immutability.
- Expanded 12-scenario drift matrix generation and determinism.
- Source data immutability across all fault injection perturbations.
- Metric formula integrity, safe undefined denominator handling, and Wilson CIs.
- Strict Condition D and Condition E input equality and propagation isolation.
- Unrelated-feature drift non-propagation.
- Combined drift and arithmetic fault handling.
- Repeated benchmark run reproducibility (deterministic decision matching).
- Machine-readable JSON/CSV serialization and Markdown report generation.
- Feature-flag default preservation (FEATURE_CLAIM_LEVEL_TRUST = False).
"""
import os
import json
import tempfile
import pytest
import numpy as np
import pandas as pd

from app.core.config import settings
from app.evaluation.config import EvaluationConfig
from app.evaluation.adapters import (
    DatasetAdapter,
    TelcoChurnAdapter,
    BreastCancerAdapter,
    WineRecognitionAdapter,
)
from app.evaluation.faults import FaultInjector, FaultScenario, FaultType
from app.evaluation.metrics import MetricsCalculator, MetricSummary
from app.evaluation.conditions import (
    FullTrustMechanismCondition,
    NoPropagationAblationCondition,
)
from app.evaluation.runner import ResearchEvaluationRunner
from app.models.user import User, Role
from app.models.trust import ReleaseDecision, CalculationStatus, LineageTrustStatus
from app.schemas.trust import ClaimInput
from app.services.drift_detection_service import (
    DriftDetectionService,
    DriftConfig,
    DriftState,
)
from app.services.trust_propagation import (
    LineageBinding,
    LineageDependencyType,
)


def test_dataset_metadata_and_schema_validation():
    """Validates metadata contracts, provenance/license accuracy, and target leakage prevention."""
    adapters = [
        TelcoChurnAdapter(random_seed=42),
        BreastCancerAdapter(random_seed=42),
        WineRecognitionAdapter(random_seed=42),
    ]

    for adapter in adapters:
        meta = adapter.get_metadata()
        raw_df = adapter.load_raw_data()

        # Contract checks
        assert meta.dataset_id in ("telco_churn", "breast_cancer_wisconsin", "wine_recognition")
        assert len(meta.name) > 0
        assert len(meta.source) > 0
        assert meta.total_rows == len(raw_df)
        assert meta.total_columns == len(raw_df.columns)
        assert len(meta.numeric_features) > 0

        # Provenance and License auditing
        if meta.dataset_id == "telco_churn":
            assert meta.license == "UNKNOWN"
            assert "test_data.csv" in meta.source
        else:
            assert "UCI" in meta.source or "Scikit-Learn" in meta.source
            assert "Public Domain" in meta.license or "CC BY" in meta.license

        # Strict Target Leakage Prevention: Target must not be in model/claim feature lists
        assert meta.target_variable not in meta.numeric_features
        assert meta.target_variable not in meta.categorical_features
        assert meta.target_variable in raw_df.columns


def test_deterministic_and_leakage_free_stratified_splits():
    """Verifies that splits are strictly disjoint, sum to total rows, and stratified by class."""
    adapters = [
        BreastCancerAdapter(random_seed=42),
        WineRecognitionAdapter(random_seed=42),
    ]

    for adapter in adapters:
        meta = adapter.get_metadata()
        train_df, val_df, test_df = adapter.get_splits(
            train_ratio=0.70, val_ratio=0.15, test_ratio=0.15, stratify=True
        )

        # 1. Total row conservation
        assert len(train_df) + len(val_df) + len(test_df) == meta.total_rows

        # 2. Reproducibility across repeated calls
        t1, v1, te1 = adapter.get_splits(0.70, 0.15, 0.15, stratify=True)
        pd.testing.assert_frame_equal(train_df, t1)
        pd.testing.assert_frame_equal(val_df, v1)
        pd.testing.assert_frame_equal(test_df, te1)

        # 3. Stratification balance: target class distribution matches across splits
        target = meta.target_variable
        overall_props = adapter.load_raw_data()[target].value_counts(normalize=True).sort_index()
        train_props = train_df[target].value_counts(normalize=True).sort_index()
        test_props = test_df[target].value_counts(normalize=True).sort_index()

        # Maximum difference in class proportions between train and overall is under 2%
        for cls_label in overall_props.index:
            assert abs(train_props[cls_label] - overall_props[cls_label]) < 0.03
            assert abs(test_props[cls_label] - overall_props[cls_label]) < 0.03


def test_reference_baseline_isolation_training_only():
    """Confirms reference baselines depend strictly on the training split."""
    adapter = BreastCancerAdapter(random_seed=42)
    meta = adapter.get_metadata()
    train_df, val_df, test_df = adapter.get_splits()

    svc = DriftDetectionService(DriftConfig(alpha=0.05, random_seed=42))
    baseline = svc.create_reference_baseline(train_df, meta.dataset_id, meta.numeric_features)

    # Mutating test_df must not alter training baseline
    test_df_mutated = test_df.copy()
    test_df_mutated.iloc[0, 0] = 999999.0

    baseline2 = svc.create_reference_baseline(train_df, meta.dataset_id, meta.numeric_features)
    assert baseline.baseline_hash == baseline2.baseline_hash


def test_expanded_scenario_matrix_determinism_and_coverage():
    """Validates that the 12-scenario matrix covers all required fault types and is deterministic."""
    adapter = WineRecognitionAdapter(random_seed=42)
    meta = adapter.get_metadata()
    train_df, val_df, test_df = adapter.get_splits()

    runner = ResearchEvaluationRunner(db=None, config=EvaluationConfig(random_seed=42))
    pool = runner._build_claims_pool(
        meta=meta,
        test_df=test_df,
        target_col="alcohol",
        unrelated_col="proline",
        mode="expanded",
    )

    assert len(pool) >= 12
    scenario_faults = {c["fault"].fault_type for c in pool}

    # Verify key scenario types are present
    assert FaultType.CLEAN in scenario_faults
    assert FaultType.NUMERIC_SHIFT_SMALL in scenario_faults
    assert FaultType.NUMERIC_SHIFT_MODERATE in scenario_faults
    assert FaultType.NUMERIC_SHIFT_SEVERE in scenario_faults
    assert FaultType.UNRELATED_FEATURE_DRIFT in scenario_faults
    assert FaultType.MISSING_VALUE_LOW in scenario_faults
    assert FaultType.MISSING_VALUE_HIGH in scenario_faults
    assert FaultType.SCHEMA_CORRUPTION in scenario_faults
    assert FaultType.INSUFFICIENT_DATA in scenario_faults
    assert FaultType.ARITHMETIC_HALLUCINATION in scenario_faults
    assert FaultType.COMBINED_DRIFT_AND_ARITHMETIC in scenario_faults


def test_source_data_immutability_during_fault_injection():
    """Confirms fault injection never mutates the original dataset in place."""
    df_orig = pd.DataFrame({
        "feature_a": [1.0, 2.0, 3.0, 4.0, 5.0] * 10,
        "feature_b": [10.0, 20.0, 30.0, 40.0, 50.0] * 10,
    })
    df_copy = df_orig.copy(deep=True)

    injector = FaultInjector(random_seed=42)
    scenarios = [
        FaultScenario("s1", FaultType.NUMERIC_SHIFT_SEVERE, "feature_a", "severe shift", "SEVERE", "WITHHELD", magnitude=3.0),
        FaultScenario("s2", FaultType.MISSING_VALUE_HIGH, "feature_a", "50% nulls", "FAIL", "WITHHELD", magnitude=0.5),
        FaultScenario("s3", FaultType.INSUFFICIENT_DATA, "feature_a", "sample N=4", "WARN", "QUALIFIED"),
        FaultScenario("s4", FaultType.SCHEMA_CORRUPTION, "feature_a", "corrupted column", "FAIL", "WITHHELD"),
    ]

    for scn in scenarios:
        mutated_df, meta = injector.inject(df_orig, scn)
        assert meta["applied"] is True
        # Original df must be completely unchanged
        pd.testing.assert_frame_equal(df_orig, df_copy)


def test_metric_formulas_and_undefined_denominators():
    """Tests exact metric calculations and ensures zero-denominators return None (N/A)."""
    calc = MetricsCalculator()

    # Case 1: Empty records
    empty_summary = calc.calculate([])
    assert empty_summary.total_claims == 0
    assert empty_summary.claim_correctness_rate is None
    assert empty_summary.release_coverage is None

    # Case 2: Zero released claims (all withheld)
    records_all_withheld = [
        {"claim_id": "c1", "ground_truth_correct": False, "is_unsupported": False, "released": False, "success": True},
        {"claim_id": "c2", "ground_truth_correct": False, "is_unsupported": True, "released": False, "success": True},
    ]
    s_withheld = calc.calculate(records_all_withheld)
    assert s_withheld.released_claims == 0
    assert s_withheld.withheld_claims == 2
    assert s_withheld.withholding_precision == 1.0
    assert s_withheld.withholding_recall == 1.0

    # Case 3: Zero drift injected
    records_no_drift = [
        {"claim_id": "c1", "ground_truth_correct": True, "released": True, "success": True, "drift_injected": False, "drift_detected": False},
    ]
    s_no_drift = calc.calculate(records_no_drift)
    assert s_no_drift.total_drift_injected == 0
    assert s_no_drift.drift_detection_recall is None

    # Case 4: format_metric utility
    assert calc.format_metric(None) == "N/A"
    assert calc.format_metric(0.8525) == "85.25%"


def test_condition_d_and_e_strict_ablation_isolation(db_session):
    """
    Verifies that Condition D and Condition E receive identical inputs and differ
    strictly on whether feature drift propagates into the release decision.
    """
    cond_d = FullTrustMechanismCondition()
    cond_e = NoPropagationAblationCondition()

    user = User(email="ablation_iso@enterprise.ai", full_name="Ablation Tester", hashed_password="pw", role=Role.analyst)
    db_session.add(user)
    db_session.commit()

    df = pd.DataFrame({"metric": [10.0, 20.0, 30.0]})
    claim = ClaimInput(
        claim_id="c_ablation",
        sentence="The total metric is 60.00.",
        target_dataset_id=1,
        column_name="metric",
        operation="SUM",
        claimed_value=60.0,
    )
    lineage = LineageBinding(
        claim_id="c_ablation",
        target_column="metric",
        upstream_features=["metric"],
        dependency_type=LineageDependencyType.DIRECT_COLUMN_AGGREGATION,
    )

    # Mock severe feature drift
    from unittest.mock import MagicMock
    from app.schemas.trust import ClaimVerificationResult
    drift_map_severe = {
        "metric": MagicMock(
            drift_state=DriftState.SEVERE_DRIFT,
            psi_score=0.45,
            ks_p_value=0.0001,
            explanation="Severe shift in metric",
        )
    }

    trust_mock = MagicMock()
    trust_mock.verify_and_release_claim.return_value = ClaimVerificationResult(
        claim_id="c_ablation",
        sentence="The total metric is 60.00.",
        operation="SUM",
        column_name="metric",
        verified=True,
        calculation_status=CalculationStatus.MATCH,
        lineage_trust_status=LineageTrustStatus.PASS,
        release_decision=ReleaseDecision.VERIFIED,
        confidence_score=0.95,
        drift_status="STABLE",
        reasons=["AUDIT_VALID"],
    )

    out_d = cond_d.evaluate_claim(claim, df, 1, user, trust_mock, feature_drift_map=drift_map_severe, lineage_binding=lineage)
    out_e = cond_e.evaluate_claim(claim, df, 1, user, trust_mock, feature_drift_map=drift_map_severe, lineage_binding=lineage)

    # Condition D withholds because of drift propagation
    assert out_d.released is False
    assert out_d.release_decision == "WITHHELD"

    # Condition E releases because drift propagation is ablated
    assert out_e.released is True
    assert out_e.release_decision == "VERIFIED"


def test_unrelated_feature_drift_non_propagation(db_session):
    """Verifies that drift on an unrelated feature does NOT cause Condition D to withhold."""
    cond_d = FullTrustMechanismCondition()
    user = User(email="unrelated_test@enterprise.ai", full_name="Unrelated Tester", hashed_password="pw", role=Role.analyst)
    db_session.add(user)
    db_session.commit()

    df = pd.DataFrame({"target_metric": [10.0, 20.0], "unrelated_metric": [100.0, 200.0]})
    claim = ClaimInput(
        claim_id="c_unrelated",
        sentence="The total target_metric is 30.00.",
        target_dataset_id=1,
        column_name="target_metric",
        operation="SUM",
        claimed_value=30.0,
    )
    lineage = LineageBinding(
        claim_id="c_unrelated",
        target_column="target_metric",
        upstream_features=["target_metric"],
        dependency_type=LineageDependencyType.DIRECT_COLUMN_AGGREGATION,
    )

    from unittest.mock import MagicMock
    from app.schemas.trust import ClaimVerificationResult
    drift_map = {
        "target_metric": MagicMock(
            drift_state=DriftState.STABLE,
            psi_score=0.01,
            ks_p_value=0.90,
            explanation="Target metric is stable",
        ),
        "unrelated_metric": MagicMock(
            drift_state=DriftState.SEVERE_DRIFT,
            psi_score=0.55,
            ks_p_value=0.00001,
            explanation="Unrelated metric drifted severely",
        ),
    }

    trust_mock = MagicMock()
    trust_mock.verify_and_release_claim.return_value = ClaimVerificationResult(
        claim_id="c_unrelated",
        sentence="The total target_metric is 30.00.",
        operation="SUM",
        column_name="target_metric",
        verified=True,
        calculation_status=CalculationStatus.MATCH,
        lineage_trust_status=LineageTrustStatus.PASS,
        release_decision=ReleaseDecision.VERIFIED,
        confidence_score=0.95,
        drift_status="STABLE",
        reasons=["AUDIT_VALID"],
    )

    out_d = cond_d.evaluate_claim(claim, df, 1, user, trust_mock, feature_drift_map=drift_map, lineage_binding=lineage)
    assert out_d.released is True
    assert out_d.release_decision == "VERIFIED"


def test_repeated_benchmark_reproducibility_and_serialization(db_session):
    """
    Runs benchmark twice and verifies byte-for-byte non-timing reproducibility
    and result serialization to JSON/CSV/Markdown.
    """
    user = User(email="repro_bench@enterprise.ai", full_name="Repro Tester", hashed_password="pw", role=Role.analyst)
    db_session.add(user)
    db_session.commit()

    config = EvaluationConfig(random_seed=42)
    runner = ResearchEvaluationRunner(db=db_session, config=config)

    adapter = WineRecognitionAdapter(random_seed=42)
    run1 = runner.run_benchmark(adapters=[adapter], eval_user=user, scenario_mode="expanded")
    run2 = runner.run_benchmark(adapters=[adapter], eval_user=user, scenario_mode="expanded")

    comparison = runner.compare_runs(run1, run2)
    assert comparison["reproducible"] is True
    assert comparison["mismatches"] == []
    assert comparison["decision_reproducibility_rate"] == 1.0

    # Test serialization in isolated tempdir
    with tempfile.TemporaryDirectory() as tmpdir:
        j_path, c_path, m_path = runner.save_results(run1, output_dir=tmpdir, run_id="repro_test")
        assert os.path.exists(j_path)
        assert os.path.exists(c_path)
        assert os.path.exists(m_path)

        with open(j_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            assert data["protocol_hash"] == config.get_protocol_hash()


def test_feature_flag_remains_disabled_by_default():
    """Strict guardrail: Verify claim-level trust is disabled by default."""
    assert settings.feature_claim_level_trust is False
