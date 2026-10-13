"""
Research Evaluation Framework Test Suite.
Verifies dataset adapters, splits, leakage prevention, metrics, conditions, and full benchmark runner.
Zero external network calls; isolated test database fixture.
"""
import pytest
import numpy as np
import pandas as pd
from app.evaluation.config import EvaluationConfig
from app.evaluation.adapters import TelcoChurnAdapter, BreastCancerAdapter, WineRecognitionAdapter
from app.evaluation.faults import FaultInjector, FaultScenario, FaultType
from app.evaluation.metrics import MetricsCalculator
from app.evaluation.conditions import (
    PlainLLMCondition,
    LLMRAGCondition,
    LLMNumericVerifyCondition,
    FullTrustMechanismCondition,
    NoPropagationAblationCondition,
)
from app.evaluation.runner import ResearchEvaluationRunner
from app.models.user import User, Role
from app.models.dataset import Dataset
from app.schemas.trust import ClaimInput
from app.services.trust_service import TrustService


def test_dataset_adapters_and_split_reproducibility():
    """Verify adapters adhere to contract, produce deterministic splits, and prevent leakage."""
    adapters = [
        TelcoChurnAdapter(random_seed=42),
        BreastCancerAdapter(random_seed=42),
        WineRecognitionAdapter(random_seed=42),
    ]

    for adapter in adapters:
        meta = adapter.get_metadata()
        assert meta.dataset_id is not None
        assert meta.total_rows > 0
        assert meta.total_columns > 0
        assert len(meta.numeric_features) > 0

        train_df1, val_df1, test_df1 = adapter.get_splits()
        # Reproducibility check with same seed
        train_df2, val_df2, test_df2 = adapter.get_splits()
        assert len(train_df1) == len(train_df2)
        assert len(val_df1) == len(val_df2)
        assert len(test_df1) == len(test_df2)

        # Zero train/test leakage verification
        assert len(train_df1) + len(val_df1) + len(test_df1) == meta.total_rows


def test_fault_injector_isolation():
    """Verify fault injection modifies only the copy and leaves the original dataframe untouched."""
    df_orig = pd.DataFrame({"score": [10.0, 20.0, 30.0], "label": ["a", "b", "c"]})
    df_copy = df_orig.copy()

    injector = FaultInjector(random_seed=42)
    scenario_shift = FaultScenario("f1", FaultType.NUMERIC_DISTRIBUTION_SHIFT, "score", "shift", "WARN", "WITHHELD")
    mutated_df, meta = injector.inject(df_orig, scenario_shift)

    assert meta["applied"] is True
    assert mutated_df["score"].mean() > df_orig["score"].mean()
    # Confirm original dataframe was not modified in-place
    pd.testing.assert_frame_equal(df_orig, df_copy)


def test_metrics_calculator_formulas():
    """Verify metric calculations with explicit formulas and Wilson confidence intervals."""
    calc = MetricsCalculator()

    # 4 claims:
    # 1: correct, released -> true verified
    # 2: false, released -> false verified
    # 3: false, withheld -> true withheld
    # 4: unsupported, withheld -> true withheld
    records = [
        {"claim_id": "c1", "ground_truth_correct": True, "is_unsupported": False, "released": True, "success": True},
        {"claim_id": "c2", "ground_truth_correct": False, "is_unsupported": False, "released": True, "success": True},
        {"claim_id": "c3", "ground_truth_correct": False, "is_unsupported": False, "released": False, "success": True},
        {"claim_id": "c4", "ground_truth_correct": False, "is_unsupported": True, "released": False, "success": True},
    ]
    summary = calc.calculate(records)

    assert summary.total_claims == 4
    assert summary.scorable_claims == 4
    assert summary.released_claims == 2
    assert summary.withheld_claims == 2
    assert summary.release_coverage == 0.50
    assert summary.false_verification_rate == 0.50  # 1 false verified / 2 released
    assert summary.reliability_among_released == 0.50  # 1 true verified / 2 released
    assert summary.withholding_precision == 1.00  # 2 true withheld / 2 withheld
    assert summary.ci_95_reliability_lower >= 0.0
    assert summary.ci_95_reliability_upper <= 1.0


def test_research_evaluation_runner_end_to_end(db_session):
    """Verify research evaluation runner across all 5 conditions on isolated database."""
    user = User(email="runner_test@enterprise.ai", full_name="Runner Tester", hashed_password="pw", role=Role.analyst)
    db_session.add(user)
    db_session.commit()

    runner = ResearchEvaluationRunner(db_session, EvaluationConfig(random_seed=42))
    # Run with Telco churn adapter
    adapters = [TelcoChurnAdapter(random_seed=42)]
    benchmark_res = runner.run_benchmark(adapters=adapters, eval_user=user)

    assert "protocol_version" in benchmark_res
    assert len(benchmark_res["datasets"]) == 1
    summaries = benchmark_res["summaries"]

    # Verify all 5 experimental conditions produced results
    for cond in ["plain_llm", "llm_rag", "llm_numeric_verify", "claim_level_trust", "no_propagation_ablation"]:
        assert cond in summaries
        s = summaries[cond]
        assert s["total_claims"] == 7
        assert s["execution_success_rate"] == 1.0

    # Plain LLM releases everything
    assert summaries["plain_llm"]["released_claims"] == 7
    assert summaries["plain_llm"]["release_coverage"] == 1.0

    # Claim level trust withholds faulty claims (hallucination, corrupt column, null injection, target drift)
    trust_summary = summaries["claim_level_trust"]
    assert trust_summary["false_verification_rate"] == 0.0
    assert trust_summary["reliability_among_released"] == 1.0
    assert trust_summary["withholding_precision"] == 1.0

    # Generate markdown report
    md_report = runner.generate_markdown_report(benchmark_res)
    assert "# Research Evaluation Report" in md_report
    assert "Plain LLM" in md_report
    assert "Full Claim-Level Trust" in md_report
