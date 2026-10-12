from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.trust import AuditVerifyResponse, EvidenceRecordResponse
from app.services.trust_service import TrustService

router = APIRouter(prefix="/trust", tags=["Trust & Provenance"])


@router.get("/evidence/{handle_id}", response_model=EvidenceRecordResponse)
def get_evidence_record(
    handle_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Resolves an evidence record, enforcing strict owner authorization.
    Returns 404 on unauthorized or non-existent handles (no resource enumeration).
    """
    service = TrustService(db)
    record = service.resolve_evidence(handle_id, current_user)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evidence handle cannot be resolved.",
        )

    import json
    try:
        params_dict = json.loads(record.params_json)
    except Exception:
        params_dict = {}

    return EvidenceRecordResponse(
        handle_id=record.handle_id,
        dataset_id=record.dataset_id,
        operation=record.operation,
        params=params_dict,
        computed_scalar=record.computed_scalar,
        unit=record.unit,
        is_synthetic=record.is_synthetic,
        created_at=record.created_at,
    )


@router.get("/audit/verify", response_model=AuditVerifyResponse)
def verify_audit_ledger(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Verifies the cryptographic RFC 8785 SHA-256 hash chain for the calling user.
    Strictly isolated to current user's ledger.
    """
    service = TrustService(db)
    is_valid, length, tampered_seq, msg, latest_hash = service.verify_audit_chain(current_user.id)
    return AuditVerifyResponse(
        user_id=current_user.id,
        chain_length=length,
        is_valid=is_valid,
        tampered_at_sequence=tampered_seq,
        message=msg,
        latest_record_hash=latest_hash,
    )
