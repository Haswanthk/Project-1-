"""
Upstream Provenance and Trust Propagation Layer for Claim-Level Trust.
Propagates feature distribution stability and quality signals to analytical claims.
Dependency path: Dataset Snapshot -> Feature -> Model / Query -> Claim -> Release Decision.
"""
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Any, Set
from app.models.trust import ReleaseDecision, CalculationStatus, LineageTrustStatus
from app.schemas.trust import ClaimInput, ClaimVerificationResult
from app.services.drift_detection_service import FeatureDriftResult, DriftState


class LineageDependencyType(str, Enum):
    DIRECT_COLUMN_AGGREGATION = "DIRECT_COLUMN_AGGREGATION"
    MODEL_INPUT_FEATURE = "MODEL_INPUT_FEATURE"
    DERIVED_RATIO = "DERIVED_RATIO"
    UNKNOWN_LINEAGE = "UNKNOWN_LINEAGE"


@dataclass
class LineageBinding:
    claim_id: str = "c_default"
    target_column: Optional[str] = None
    upstream_features: List[str] = field(default_factory=list)
    dependency_type: LineageDependencyType = LineageDependencyType.DIRECT_COLUMN_AGGREGATION
    model_identifier: Optional[str] = None
    dataset_id: Optional[str] = None
    dataset_version: Optional[str] = None
    feature_names: Optional[List[str]] = None

    def __post_init__(self):
        if self.feature_names and not self.upstream_features:
            self.upstream_features = list(self.feature_names)
        if self.upstream_features and not self.feature_names:
            self.feature_names = list(self.upstream_features)


@dataclass
class PropagatedTrustVerdict:
    claim_id: str
    target_column: Optional[str]
    calculation_status: CalculationStatus
    original_lineage_status: LineageTrustStatus
    propagated_lineage_status: LineageTrustStatus
    release_decision: ReleaseDecision
    drift_status: str
    upstream_reasons: List[str]
    affected_by_drift: bool


class TrustPropagationEngine:
    """
    Deterministic rules engine for upstream trust propagation.
    Ensures a downstream claim status cannot become more trusted than upstream evidence allows.
    """

    def __init__(self, drift_downgrade_policy: str = "STRICT"):
        """
        drift_downgrade_policy:
          - "STRICT": Severe drift -> WITHHELD; Moderate drift -> QUALIFIED (never VERIFIED).
          - "LENIENT": Severe drift -> QUALIFIED; Moderate drift -> QUALIFIED.
        """
        self.policy = drift_downgrade_policy

    def propagate_trust(
        self,
        base_result: ClaimVerificationResult,
        lineage: LineageBinding,
        feature_drift_map: Optional[Dict[str, FeatureDriftResult]] = None,
        enable_propagation: bool = True,
    ) -> PropagatedTrustVerdict:
        """
        Propagates upstream feature drift into the claim's release decision.
        If enable_propagation is False (Condition E Ablation), drift signals are computed and logged
        but do not alter the release decision.
        """
        reasons = list(base_result.reasons)
        calc_status = base_result.calculation_status
        lineage_status = base_result.lineage_trust_status
        current_decision = base_result.release_decision

        # Base invariant: Arithmetic mismatch or failure ALWAYS withholds regardless of drift
        if calc_status in [CalculationStatus.MISMATCH, CalculationStatus.UNAUTHORIZED, CalculationStatus.NOT_RECOMPUTABLE]:
            return PropagatedTrustVerdict(
                claim_id=base_result.claim_id,
                target_column=base_result.column_name,
                calculation_status=calc_status,
                original_lineage_status=lineage_status,
                propagated_lineage_status=lineage_status,
                release_decision=ReleaseDecision.WITHHELD,
                drift_status=base_result.drift_status,
                upstream_reasons=reasons,
                affected_by_drift=False,
            )

        # Invariant: Pre-existing lineage failure (e.g. 50% null rate) always withholds
        if lineage_status == LineageTrustStatus.FAIL:
            return PropagatedTrustVerdict(
                claim_id=base_result.claim_id,
                target_column=base_result.column_name,
                calculation_status=calc_status,
                original_lineage_status=lineage_status,
                propagated_lineage_status=lineage_status,
                release_decision=ReleaseDecision.WITHHELD,
                drift_status=base_result.drift_status,
                upstream_reasons=reasons,
                affected_by_drift=False,
            )

        # Invariant: Synthetic data is strictly QUALIFIED, never VERIFIED
        is_synthetic = (calc_status == CalculationStatus.SYNTHETIC)

        # If no drift results are supplied or lineage is unknown
        if not feature_drift_map or not lineage.upstream_features:
            drift_repr = "UNKNOWN"
            if not lineage.upstream_features:
                reasons.append("Upstream feature lineage is UNKNOWN; drift cannot be bound.")
            return PropagatedTrustVerdict(
                claim_id=base_result.claim_id,
                target_column=base_result.column_name,
                calculation_status=calc_status,
                original_lineage_status=lineage_status,
                propagated_lineage_status=lineage_status,
                release_decision=ReleaseDecision.QUALIFIED if is_synthetic else current_decision,
                drift_status=drift_repr,
                upstream_reasons=reasons,
                affected_by_drift=False,
            )

        # Inspect relevant upstream features only
        relevant_drift_states: List[DriftState] = []
        drift_explanations: List[str] = []

        for feat in lineage.upstream_features:
            if feat in feature_drift_map:
                res = feature_drift_map[feat]
                relevant_drift_states.append(res.drift_state)
                if res.drift_state != DriftState.STABLE:
                    drift_explanations.append(f"Upstream feature '{feat}' exhibits {res.drift_state.value}: {res.explanation}")
            else:
                relevant_drift_states.append(DriftState.UNKNOWN)
                drift_explanations.append(f"Upstream feature '{feat}' is missing from drift analysis.")

        # Aggregate upstream drift status
        has_severe = any(s == DriftState.SEVERE_DRIFT for s in relevant_drift_states)
        has_moderate = any(s in [DriftState.MODERATE_DRIFT, DriftState.DRIFT] for s in relevant_drift_states)
        has_unknown = any(s in [DriftState.UNKNOWN, DriftState.INSUFFICIENT_DATA] for s in relevant_drift_states)

        if has_severe:
            overall_drift = "SEVERE_DRIFT"
        elif has_moderate:
            overall_drift = "MODERATE_DRIFT"
        elif has_unknown:
            overall_drift = "UNKNOWN"
        else:
            overall_drift = "STABLE"

        affected_by_drift = False
        new_lineage_status = lineage_status
        new_decision = current_decision

        if enable_propagation:
            # Deterministic policy enforcement
            if has_severe:
                affected_by_drift = True
                new_lineage_status = LineageTrustStatus.FAIL
                new_decision = ReleaseDecision.WITHHELD
                reasons.extend(drift_explanations)
                reasons.append("Claim WITHHELD due to severe upstream feature distribution drift.")
            elif has_moderate:
                affected_by_drift = True
                if new_lineage_status != LineageTrustStatus.FAIL:
                    new_lineage_status = LineageTrustStatus.WARN
                new_decision = ReleaseDecision.QUALIFIED
                reasons.extend(drift_explanations)
                reasons.append("Claim downgraded to QUALIFIED due to moderate upstream feature distribution drift.")
            elif has_unknown:
                if current_decision == ReleaseDecision.VERIFIED:
                    new_decision = ReleaseDecision.QUALIFIED
                    reasons.append("Claim downgraded to QUALIFIED: upstream feature drift state is UNKNOWN.")
            else:
                # Upstream is STABLE
                reasons.append("Upstream feature distributions verified STABLE against reference baseline.")
        else:
            # Ablation condition: record drift diagnostics without propagating to decision
            reasons.append(f"[Ablation] Drift state {overall_drift} observed but propagation is disabled.")

        if is_synthetic and new_decision == ReleaseDecision.VERIFIED:
            new_decision = ReleaseDecision.QUALIFIED

        return PropagatedTrustVerdict(
            claim_id=base_result.claim_id,
            target_column=base_result.column_name,
            calculation_status=calc_status,
            original_lineage_status=lineage_status,
            propagated_lineage_status=new_lineage_status,
            release_decision=new_decision,
            drift_status=overall_drift,
            upstream_reasons=reasons,
            affected_by_drift=affected_by_drift,
        )
