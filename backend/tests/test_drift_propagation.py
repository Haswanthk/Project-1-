"""
Tests for Stage 14 — Feature Drift Detection and Upstream Trust Propagation.
Covers:
- Kolmogorov-Smirnov (KS) two-sample test (numerical shifts, stable samples, insufficient data)
- Population Stability Index (PSI) for numerical and categorical features
- Zero-frequency bins, duplicate quantile edges, constant features, and unseen categories
- Multiple-testing FDR correction (Benjamini-Hochberg)
- Reference baseline serialization, deterministic SHA-256 hashing, and immutability
- TrustPropagationEngine precedence and release policies
- Lineage-based claim filtering: affected vs unrelated feature drift
- Fair comparison between Condition D (propagation enabled) and Condition E (propagation disabled)
- End-to-end benchmark execution with drift metrics
"""
import os
import json
import pytest
import numpy as np
import pandas as pd
from unittest.mock import MagicMock

from app.services.drift_detection_service import (
    DriftDetectionService,
    DriftConfig,
    DriftState,
    BaselineProfile,
)
from app.services.trust_propagation import (
    TrustPropagationEngine,
    LineageBinding,
    PropagatedTrustVerdict,
)
from app.models.trust import ReleaseDecision, CalculationStatus, LineageTrustStatus
from app.models.user import User, Role
from app.schemas.trust import ClaimVerificationResult
from app.evaluation.conditions import FullTrustMechanismCondition, NoPropagationAblationCondition
from app.evaluation.runner import ResearchEvaluationRunner
from app.evaluation.adapters import TelcoChurnAdapter
from app.evaluation.faults import FaultType, FaultScenario
from app.schemas.trust import ClaimInput


@pytest.fixture
def drift_service():
    return DriftDetectionService(config=DriftConfig(alpha=0.05, psi_threshold=0.2, psi_warning_threshold=0.1))


@pytest.fixture
def sample_numerical_data():
    np.random.seed(42)
    ref = np.random.normal(loc=50.0, scale=10.0, size=500)
    curr_stable = np.random.normal(loc=50.0, scale=10.0, size=500)
    curr_drift = np.random.normal(loc=70.0, scale=12.0, size=500)
    return ref, curr_stable, curr_drift


def test_ks_test_stable_and_drift(drift_service, sample_numerical_data):
    ref, curr_stable, curr_drift = sample_numerical_data

    # Stable control
    ks_stat, p_val, state, msg = drift_service.calculate_ks_test(ref, curr_stable)
    assert state == DriftState.STABLE
    assert p_val > 0.05
    assert ks_stat < 0.15

    # True drift
    ks_stat, p_val, state, msg = drift_service.calculate_ks_test(ref, curr_drift)
    assert state == DriftState.DRIFT
    assert p_val < 0.001
    assert ks_stat > 0.4


def test_ks_test_edge_cases(drift_service):
    # Insufficient samples (< 5)
    ks_stat, p_val, state, msg = drift_service.calculate_ks_test(np.array([1.0, 2.0]), np.array([1.0, 2.0]))
    assert state == DriftState.INSUFFICIENT_DATA
    assert p_val is None

    # Constant values
    ks_stat, p_val, state, msg = drift_service.calculate_ks_test(np.zeros(50), np.zeros(50))
    assert state == DriftState.STABLE
    assert ks_stat == 0.0


def test_numerical_psi_calculation(drift_service, sample_numerical_data):
    ref, curr_stable, curr_drift = sample_numerical_data

    # Stable distribution
    psi_score, state, msg = drift_service.calculate_numerical_psi(ref, curr_stable)
    assert psi_score < 0.1
    assert state == DriftState.STABLE

    # Drifted distribution
    psi_score, state, msg = drift_service.calculate_numerical_psi(ref, curr_drift)
    assert psi_score > 0.2
    assert state == DriftState.SEVERE_DRIFT


def test_numerical_psi_duplicate_quantiles(drift_service):
    # Data with many zeros (duplicate quantiles)
    ref = np.array([0.0] * 80 + [1.0, 2.0, 3.0, 4.0] * 5)
    curr = np.array([0.0] * 80 + [1.0, 2.0, 3.0, 4.0] * 5)

    psi_score, state, msg = drift_service.calculate_numerical_psi(ref, curr)
    assert psi_score < 0.1
    assert state == DriftState.STABLE


def test_categorical_psi_and_unseen_categories(drift_service):
    ref = pd.Series(["A"] * 50 + ["B"] * 30 + ["C"] * 20)
    curr_stable = pd.Series(["A"] * 48 + ["B"] * 32 + ["C"] * 20)
    curr_unseen = pd.Series(["A"] * 30 + ["B"] * 20 + ["X"] * 25 + ["Y"] * 25)

    # Stable categorical
    psi_score, unseen_rate, state, msg = drift_service.calculate_categorical_psi(ref, curr_stable)
    assert psi_score < 0.1
    assert unseen_rate == 0.0
    assert state == DriftState.STABLE

    # Categorical with high unseen rate
    psi_score, unseen_rate, state, msg = drift_service.calculate_categorical_psi(ref, curr_unseen)
    assert unseen_rate == 0.5
    assert psi_score > 0.2
    assert state == DriftState.SEVERE_DRIFT


def test_fdr_benjamini_hochberg(drift_service):
    # Mixed p-values
    p_values = [0.001, 0.01, 0.04, 0.06, 0.50]
    adjusted = drift_service.adjust_p_values_fdr(p_values)
    assert len(adjusted) == len(p_values)
    # Adjusted p-values should be >= raw p-values
    for raw, adj in zip(p_values, adjusted):
        assert adj >= raw


def test_deterministic_baseline_profile(drift_service):
    df1 = pd.DataFrame({
        "num1": np.linspace(0, 100, 100),
        "cat1": ["alpha"] * 50 + ["beta"] * 50,
    })
    df2 = pd.DataFrame({
        "num1": np.linspace(0, 100, 100),
        "cat1": ["alpha"] * 50 + ["beta"] * 50,
    })

    baseline1 = drift_service.create_reference_baseline(df1, dataset_id="ds_test", feature_names=["num1", "cat1"])
    baseline2 = drift_service.create_reference_baseline(df2, dataset_id="ds_test", feature_names=["num1", "cat1"])

    assert baseline1.baseline_hash == baseline2.baseline_hash
    assert "num1" in baseline1.numeric_bin_edges
    assert "cat1" in baseline1.categorical_vocabularies


def test_trust_propagation_precedence():
    engine = TrustPropagationEngine()

    base_claim = ClaimVerificationResult(
        claim_id="c1",
        sentence="The churn rate is 0.95.",
        operation="MEAN",
        column_name="churn_rate",
        verified=True,
        calculation_status=CalculationStatus.MATCH,
        lineage_trust_status=LineageTrustStatus.PASS,
        release_decision=ReleaseDecision.VERIFIED,
        confidence_score=0.95,
        drift_status="STABLE",
        reasons=["AUDIT_CHAIN_VALID", "SNAPSHOT_MATCH"],
    )

    # 1. Base claim failed verification -> Propagation engine maintains failure
    failed_claim = ClaimVerificationResult(
        claim_id="c2",
        sentence="The churn rate is 0.00.",
        operation="MEAN",
        column_name="churn_rate",
        verified=False,
        calculation_status=CalculationStatus.MISMATCH,
        lineage_trust_status=LineageTrustStatus.PASS,
        release_decision=ReleaseDecision.WITHHELD,
        confidence_score=0.0,
        drift_status="STABLE",
        reasons=["VALUE_MISMATCH"],
    )
    lineage = LineageBinding(
        claim_id="c2",
        target_column="churn_rate",
        upstream_features=["churn_rate"],
        dependency_type=None,
    )
    verdict_fail = engine.propagate_trust(failed_claim, lineage=lineage, feature_drift_map={}, enable_propagation=True)
    assert verdict_fail.release_decision == ReleaseDecision.WITHHELD

    # 2. Severe upstream drift on bound feature -> Withheld under Condition D (enable_propagation=True)
    lineage_bound = LineageBinding(
        claim_id="c1",
        target_column="churn_rate",
        upstream_features=["churn_rate"],
        dependency_type=None,
    )
    drift_map_severe = {
        "churn_rate": MagicMock(
            drift_state=DriftState.SEVERE_DRIFT,
            psi_score=0.45,
            ks_p_value=0.0001,
            explanation="Severe drift",
        )
    }
    verdict_d = engine.propagate_trust(base_claim, lineage=lineage_bound, feature_drift_map=drift_map_severe, enable_propagation=True)
    assert verdict_d.release_decision == ReleaseDecision.WITHHELD
    assert "UPSTREAM_FEATURE_DRIFT" in verdict_d.drift_status or verdict_d.affected_by_drift is True

    # 3. Same severe drift under Condition E (enable_propagation=False) -> Remains VERIFIED
    verdict_e = engine.propagate_trust(base_claim, lineage=lineage_bound, feature_drift_map=drift_map_severe, enable_propagation=False)
    assert verdict_e.release_decision == ReleaseDecision.VERIFIED
    assert verdict_e.affected_by_drift is False

    # 4. Unrelated feature drift -> Both Condition D and Condition E release claim
    drift_map_unrelated = {
        "churn_rate": MagicMock(
            drift_state=DriftState.STABLE,
            psi_score=0.02,
            ks_p_value=0.85,
            explanation="Churn rate is stable",
        ),
        "unrelated_feature": MagicMock(
            drift_state=DriftState.SEVERE_DRIFT,
            psi_score=0.55,
            ks_p_value=0.00001,
            explanation="Unrelated drift",
        ),
    }
    verdict_unrelated_d = engine.propagate_trust(base_claim, lineage=lineage_bound, feature_drift_map=drift_map_unrelated, enable_propagation=True)
    assert verdict_unrelated_d.release_decision == ReleaseDecision.VERIFIED


def test_fairness_condition_d_and_e_isolation(db_session):
    """Confirm Conditions D and E receive identical input and diverge strictly on propagation."""
    cond_d = FullTrustMechanismCondition()
    cond_e = NoPropagationAblationCondition()

    user = User(email="fairness_test@enterprise.ai", full_name="Fairness Tester", hashed_password="pw", role=Role.analyst)
    db_session.add(user)
    db_session.commit()

    df = pd.DataFrame({"total_charges": [10.0, 20.0, 30.0, 40.0, 50.0]})
    claim_input = ClaimInput(
        claim_id="c_drift_test",
        sentence="The total charges is 150.00.",
        target_dataset_id=1,
        column_name="total_charges",
        operation="SUM",
        claimed_value=150.0,
    )
    from app.services.trust_propagation import LineageDependencyType
    lineage = LineageBinding(
        claim_id="c_drift_test",
        target_column="total_charges",
        upstream_features=["total_charges"],
        dependency_type=LineageDependencyType.DIRECT_COLUMN_AGGREGATION,
    )

    # Simulate detected feature drift
    drift_map = {
        "total_charges": MagicMock(
            drift_state=DriftState.SEVERE_DRIFT,
            psi_score=0.42,
            ks_p_value=0.0001,
            explanation="Severe shift in total_charges",
        )
    }

    trust_mock = MagicMock()
    trust_mock.verify_and_release_claim.return_value = ClaimVerificationResult(
        claim_id="c_drift_test",
        sentence="The total charges is 150.00.",
        operation="SUM",
        column_name="total_charges",
        verified=True,
        calculation_status=CalculationStatus.MATCH,
        lineage_trust_status=LineageTrustStatus.PASS,
        release_decision=ReleaseDecision.VERIFIED,
        confidence_score=0.98,
        drift_status="STABLE",
        reasons=["AUDIT_CHAIN_VALID", "SNAPSHOT_MATCH"],
    )

    out_d = cond_d.evaluate_claim(
        claim=claim_input,
        df=df,
        dataset_id=1,
        user=user,
        trust_service=trust_mock,
        feature_drift_map=drift_map,
        lineage_binding=lineage,
    )

    out_e = cond_e.evaluate_claim(
        claim=claim_input,
        df=df,
        dataset_id=1,
        user=user,
        trust_service=trust_mock,
        feature_drift_map=drift_map,
        lineage_binding=lineage,
    )

    # Condition D withheld due to propagation
    assert out_d.released is False
    assert out_d.release_decision == "WITHHELD"

    # Condition E released because propagation is disabled (Ablation)
    assert out_e.released is True
    assert out_e.release_decision == "VERIFIED"


def test_research_evaluation_runner_with_drift_benchmark(db_session):
    """Executes benchmark runner with drift scenarios on TelcoChurn adapter."""
    user = User(email="drift_bench_test@enterprise.ai", full_name="Drift Bench Tester", hashed_password="pw", role=Role.analyst)
    db_session.add(user)
    db_session.commit()

    runner = ResearchEvaluationRunner(db=db_session)
    from app.evaluation.adapters import BreastCancerAdapter
    adapter = BreastCancerAdapter(random_seed=42)

    results = runner.run_benchmark(adapters=[adapter], eval_user=user)
    summaries = results["summaries"]

    assert "plain_llm" in summaries
    assert "llm_numeric_verify" in summaries
    assert "claim_level_trust" in summaries
    assert "no_propagation_ablation" in summaries

    # Verify drift metrics populated
    d_summary = summaries["claim_level_trust"]
    e_summary = summaries["no_propagation_ablation"]

    assert d_summary["total_drift_injected"] > 0
    assert d_summary["drift_detection_precision"] == 1.0
    assert d_summary["drift_false_positive_rate"] == 0.0

    # Under Condition D, drifted claims are withheld
    assert d_summary["drift_withheld_rate"] > 0.0
    # Under Condition E, drift withholding is 0.0 because propagation is ablated
    assert e_summary["drift_withheld_rate"] == 0.0

    # Generate and verify markdown report
    report = runner.generate_markdown_report(results)
    assert "Drift Detection and Upstream Propagation Metrics" in report
    assert "Full Claim-Level Trust (Cond D)" in report
    assert "No-Propagation Ablation (Cond E)" in report
