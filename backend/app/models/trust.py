import enum
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Boolean,
    DateTime,
    Text,
    ForeignKey,
    UniqueConstraint,
    Index,
)
from sqlalchemy.orm import relationship

from app.core.database import Base


class CalculationStatus(str, enum.Enum):
    MATCH = "MATCH"
    MISMATCH = "MISMATCH"
    NOT_RECOMPUTABLE = "NOT_RECOMPUTABLE"
    UNAUTHORIZED = "UNAUTHORIZED"
    SYNTHETIC = "SYNTHETIC"


class LineageTrustStatus(str, enum.Enum):
    PASS = "PASS"
    WARN = "WARN"
    FAIL = "FAIL"
    UNKNOWN = "UNKNOWN"


class ReleaseDecision(str, enum.Enum):
    VERIFIED = "VERIFIED"
    QUALIFIED = "QUALIFIED"
    WITHHELD = "WITHHELD"


class EvidenceRecord(Base):
    """
    Immutable, typed platform calculation artifact.
    Stores the specific parameterized computation and scalar result,
    anchored to the dataset ID and cryptographic dataset file digest.
    Contains zero raw rows or PII.
    """
    __tablename__ = "evidence_records"

    id = Column(Integer, primary_key=True, index=True)
    handle_id = Column(String(64), unique=True, index=True, nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id"), nullable=True, index=True)
    dataset_hash = Column(String(64), nullable=True)  # SHA256 of file snapshot
    operation = Column(String(32), nullable=False)    # e.g., SUM, MEAN, COUNT
    params_json = Column(Text, nullable=False)        # RFC 8785 serialized parameter dict
    computed_scalar = Column(Float, nullable=True)
    unit = Column(String(32), nullable=True)
    is_synthetic = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    owner = relationship("User")
    dataset = relationship("Dataset")


class ClaimReleaseAudit(Base):
    """
    Append-only, tamper-evident audit ledger for release decisions.
    Enforces a strict unique constraint on (user_id, sequence_id) at the database level.
    Each record links monotonically to prev_record_hash using SHA-256 over RFC 8785 canonical JSON.
    """
    __tablename__ = "claim_release_audits"

    __table_args__ = (
        UniqueConstraint("user_id", "sequence_id", name="uq_audit_user_sequence"),
        Index("ix_audit_user_sequence", "user_id", "sequence_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    sequence_id = Column(Integer, nullable=False)
    claim_id = Column(String(64), nullable=False, index=True)
    timestamp_utc = Column(String(64), nullable=False)
    calculation_status = Column(String(32), nullable=False)
    lineage_trust_status = Column(String(32), nullable=False)
    release_decision = Column(String(32), nullable=False)
    claimed_value = Column(Float, nullable=True)
    recomputed_value = Column(Float, nullable=True)
    evidence_handle = Column(String(64), nullable=True)
    prev_record_hash = Column(String(64), nullable=False)
    record_hash = Column(String(64), nullable=False, unique=True, index=True)

    user = relationship("User")
