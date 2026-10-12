from datetime import datetime
from typing import Any, List, Optional
from pydantic import BaseModel, Field

from app.models.trust import CalculationStatus, LineageTrustStatus, ReleaseDecision


class ClaimInput(BaseModel):
    """
    Atomic, structured factual assertion proposed by the Copilot workflow.
    """
    claim_id: str = Field(..., description="Unique claim identifier, e.g. c_01")
    sentence: str = Field(..., description="The factual sentence containing this claim")
    target_dataset_id: Optional[int] = Field(None, description="Referenced dataset ID if applicable")
    column_name: Optional[str] = Field(None, description="Target column evaluated")
    operation: str = Field("SUM", description="Aggregation operation: SUM, MEAN, COUNT, MIN, MAX")
    claimed_value: Optional[float] = Field(None, description="The specific numeric value asserted")
    unit: Optional[str] = Field(None, description="Measurement unit, e.g. USD, units, %")
    evidence_handle: Optional[str] = Field(None, description="Associated evidence handle if pre-computed")


class ClaimVerificationResult(BaseModel):
    """
    Full evaluation and release decision for an individual claim.
    Strictly separates calculation_status from lineage_trust_status.
    """
    claim_id: str
    sentence: str
    target_dataset_id: Optional[int] = None
    column_name: Optional[str] = None
    operation: str
    claimed_value: Optional[float] = None
    recomputed_value: Optional[float] = None
    calculation_status: CalculationStatus
    lineage_trust_status: LineageTrustStatus
    release_decision: ReleaseDecision
    evidence_handle: Optional[str] = None
    reasons: List[str] = Field(default_factory=list)
    dataset_name: Optional[str] = None
    dataset_age_days: Optional[int] = None
    null_percentage: Optional[float] = None
    drift_status: str = "UNKNOWN"
    calibration_status: str = "UNKNOWN"


class CopilotChatResponse(BaseModel):
    """
    Additive Copilot response payload.
    When feature flag is enabled, provides structured claims alongside the response text.
    """
    response: str
    commentary: Optional[str] = None
    claims: List[ClaimVerificationResult] = Field(default_factory=list)
    unverified_prose_warning: bool = False


class EvidenceRecordResponse(BaseModel):
    handle_id: str
    dataset_id: Optional[int] = None
    operation: str
    params: dict[str, Any]
    computed_scalar: Optional[float] = None
    unit: Optional[str] = None
    is_synthetic: bool
    created_at: datetime


class AuditVerifyResponse(BaseModel):
    user_id: int
    chain_length: int
    is_valid: bool
    tampered_at_sequence: Optional[int] = None
    message: str
    latest_record_hash: Optional[str] = None
