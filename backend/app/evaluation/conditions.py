"""
Experimental Condition Interfaces for Claim-Level Trust Research Evaluation.
Implements the 5 conditions:
Condition A: Plain LLM
Condition B: LLM + RAG
Condition C: LLM + Numeric Verification
Condition D: Full Claim-Level Trust Mechanism
Condition E: No-Propagation Ablation
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Dict, Any, List, Optional
import time
import pandas as pd
from app.models.trust import ReleaseDecision, CalculationStatus, LineageTrustStatus
from app.schemas.trust import ClaimInput
from app.services.trust_service import TrustService
from app.models.user import User


@dataclass
class ConditionOutput:
    condition_id: str
    claim_id: str
    sentence: str
    claimed_value: Optional[float]
    released: bool
    release_decision: str  # "VERIFIED", "QUALIFIED", "WITHHELD"
    calculation_status: str
    latency_ms: float
    notes: str
    reason_codes: List[str] = field(default_factory=list)


class BaseEvaluationCondition(ABC):
    """Abstract condition runner interface."""

    def __init__(self, condition_id: str):
        self.condition_id = condition_id

    @abstractmethod
    def evaluate_claim(
        self,
        claim: ClaimInput,
        df: pd.DataFrame,
        dataset_id: int,
        user: User,
        trust_service: TrustService,
        feature_drift_map: Optional[Dict[str, Any]] = None,
        lineage_binding: Optional[Any] = None,
    ) -> ConditionOutput:
        pass


class PlainLLMCondition(BaseEvaluationCondition):
    """
    Condition A: Plain LLM.
    Generates an analytical claim without retrieval grounding or post-hoc verification.
    All claims are unverified and released blindly as fact (release = True).
    """

    def __init__(self):
        super().__init__("plain_llm")

    def evaluate_claim(
        self,
        claim: ClaimInput,
        df: pd.DataFrame,
        dataset_id: int,
        user: User,
        trust_service: TrustService,
        feature_drift_map: Optional[Dict[str, Any]] = None,
        lineage_binding: Optional[Any] = None,
    ) -> ConditionOutput:
        t0 = time.perf_counter()
        latency = (time.perf_counter() - t0) * 1000.0
        return ConditionOutput(
            condition_id=self.condition_id,
            claim_id=claim.claim_id,
            sentence=claim.sentence,
            claimed_value=claim.claimed_value,
            released=True,
            release_decision="UNVERIFIED_RELEASE",
            calculation_status="NOT_EVALUATED",
            latency_ms=latency,
            notes="Plain LLM baseline without retrieval or verification gates.",
        )


class LLMRAGCondition(BaseEvaluationCondition):
    """
    Condition B: LLM + RAG.
    Supplies schema, summary statistics, and column list in context,
    but lacks deterministic post-hoc calculation checking.
    """

    def __init__(self):
        super().__init__("llm_rag")

    def evaluate_claim(
        self,
        claim: ClaimInput,
        df: pd.DataFrame,
        dataset_id: int,
        user: User,
        trust_service: TrustService,
        feature_drift_map: Optional[Dict[str, Any]] = None,
        lineage_binding: Optional[Any] = None,
    ) -> ConditionOutput:
        t0 = time.perf_counter()
        col_exists = claim.column_name in df.columns if claim.column_name else False
        released = bool(col_exists)
        decision = "QUALIFIED" if released else "WITHHELD"
        calc_status = "SCHEMA_MATCH" if col_exists else "SCHEMA_MISSING"
        latency = (time.perf_counter() - t0) * 1000.0
        return ConditionOutput(
            condition_id=self.condition_id,
            claim_id=claim.claim_id,
            sentence=claim.sentence,
            claimed_value=claim.claimed_value,
            released=released,
            release_decision=decision,
            calculation_status=calc_status,
            latency_ms=latency,
            notes="LLM + RAG schema-grounded baseline without post-hoc numeric recomputation.",
        )


class LLMNumericVerifyCondition(BaseEvaluationCondition):
    """
    Condition C: LLM + Numeric Verification.
    Validates arithmetic calculation independently, but ignores lineage, null-rate, and drift.
    """

    def __init__(self):
        super().__init__("llm_numeric_verify")

    def evaluate_claim(
        self,
        claim: ClaimInput,
        df: pd.DataFrame,
        dataset_id: int,
        user: User,
        trust_service: TrustService,
        feature_drift_map: Optional[Dict[str, Any]] = None,
        lineage_binding: Optional[Any] = None,
    ) -> ConditionOutput:
        t0 = time.perf_counter()
        # Compute scalar from df directly
        recomputed_val = None
        calc_status = "NOT_RECOMPUTABLE"
        released = False

        if claim.column_name and claim.column_name in df.columns:
            series = pd.to_numeric(df[claim.column_name], errors="coerce").dropna()
            if not series.empty and claim.operation:
                op = claim.operation.upper()
                if op == "SUM":
                    recomputed_val = float(series.sum())
                elif op in ["MEAN", "AVG"]:
                    recomputed_val = float(series.mean())
                elif op == "MIN":
                    recomputed_val = float(series.min())
                elif op == "MAX":
                    recomputed_val = float(series.max())
                elif op == "COUNT":
                    recomputed_val = float(len(series))

                if recomputed_val is not None and claim.claimed_value is not None:
                    if abs(recomputed_val - claim.claimed_value) <= 1e-4:
                        calc_status = "MATCH"
                        released = True
                    else:
                        calc_status = "MISMATCH"
                        released = False

        decision = "VERIFIED" if released else "WITHHELD"
        latency = (time.perf_counter() - t0) * 1000.0
        return ConditionOutput(
            condition_id=self.condition_id,
            claim_id=claim.claim_id,
            sentence=claim.sentence,
            claimed_value=claim.claimed_value,
            released=released,
            release_decision=decision,
            calculation_status=calc_status,
            latency_ms=latency,
            notes="Post-hoc numeric verification only (no lineage, freshness, or quality checks).",
        )


class FullTrustMechanismCondition(BaseEvaluationCondition):
    """
    Condition D: Full Claim-Level Trust Mechanism.
    Integrates the existing TrustService pipeline + Upstream Drift Propagation.
    """

    def __init__(self):
        super().__init__("claim_level_trust")
        from app.services.trust_propagation import TrustPropagationEngine
        self.propagation_engine = TrustPropagationEngine()

    def evaluate_claim(
        self,
        claim: ClaimInput,
        df: pd.DataFrame,
        dataset_id: int,
        user: User,
        trust_service: TrustService,
        feature_drift_map: Optional[Dict[str, Any]] = None,
        lineage_binding: Optional[Any] = None,
    ) -> ConditionOutput:
        t0 = time.perf_counter()
        from app.services.trust_propagation import LineageBinding, LineageDependencyType

        # 1. Base trust pipeline verification (arithmetic recomputation + profiling + audit)
        base_res = trust_service.verify_and_release_claim(claim, user)

        # 2. Build or resolve upstream lineage binding
        if lineage_binding is None:
            col_list = [claim.column_name] if claim.column_name else []
            lineage_binding = LineageBinding(
                claim_id=claim.claim_id,
                target_column=claim.column_name,
                upstream_features=col_list,
                dependency_type=LineageDependencyType.DIRECT_COLUMN_AGGREGATION if col_list else LineageDependencyType.UNKNOWN_LINEAGE,
            )

        # 3. Propagate upstream drift into release decision
        verdict = self.propagation_engine.propagate_trust(
            base_result=base_res,
            lineage=lineage_binding,
            feature_drift_map=feature_drift_map,
            enable_propagation=True,
        )

        released = verdict.release_decision in (ReleaseDecision.VERIFIED, ReleaseDecision.QUALIFIED)
        latency = (time.perf_counter() - t0) * 1000.0

        return ConditionOutput(
            condition_id=self.condition_id,
            claim_id=claim.claim_id,
            sentence=claim.sentence,
            claimed_value=claim.claimed_value,
            released=released,
            release_decision=verdict.release_decision.value,
            calculation_status=verdict.calculation_status.value,
            latency_ms=latency,
            notes=f"Full claim-level trust with drift propagation ({verdict.drift_status}).",
            reason_codes=verdict.upstream_reasons,
        )


class NoPropagationAblationCondition(BaseEvaluationCondition):
    """
    Condition E: No-Propagation Ablation.
    Computes identical feature-level drift signals as Condition D, but explicitly disables
    propagation of those signals into the claim release decision.
    """

    def __init__(self):
        super().__init__("no_propagation_ablation")
        from app.services.trust_propagation import TrustPropagationEngine
        self.propagation_engine = TrustPropagationEngine()

    def evaluate_claim(
        self,
        claim: ClaimInput,
        df: pd.DataFrame,
        dataset_id: int,
        user: User,
        trust_service: TrustService,
        feature_drift_map: Optional[Dict[str, Any]] = None,
        lineage_binding: Optional[Any] = None,
    ) -> ConditionOutput:
        t0 = time.perf_counter()
        from app.services.trust_propagation import LineageBinding, LineageDependencyType

        # 1. Base trust pipeline verification (identical to Condition D)
        base_res = trust_service.verify_and_release_claim(claim, user)

        # 2. Build or resolve upstream lineage binding (identical to Condition D)
        if lineage_binding is None:
            col_list = [claim.column_name] if claim.column_name else []
            lineage_binding = LineageBinding(
                claim_id=claim.claim_id,
                target_column=claim.column_name,
                upstream_features=col_list,
                dependency_type=LineageDependencyType.DIRECT_COLUMN_AGGREGATION if col_list else LineageDependencyType.UNKNOWN_LINEAGE,
            )

        # 3. Process drift with propagation explicitly DISABLED (Ablation)
        verdict = self.propagation_engine.propagate_trust(
            base_result=base_res,
            lineage=lineage_binding,
            feature_drift_map=feature_drift_map,
            enable_propagation=False,  # <--- Strictly Disabled
        )

        released = verdict.release_decision in (ReleaseDecision.VERIFIED, ReleaseDecision.QUALIFIED)
        latency = (time.perf_counter() - t0) * 1000.0

        return ConditionOutput(
            condition_id=self.condition_id,
            claim_id=claim.claim_id,
            sentence=claim.sentence,
            claimed_value=claim.claimed_value,
            released=released,
            release_decision=verdict.release_decision.value,
            calculation_status=verdict.calculation_status.value,
            latency_ms=latency,
            notes=f"Ablation: Upstream drift computed ({verdict.drift_status}) but propagation disabled.",
            reason_codes=verdict.upstream_reasons,
        )
