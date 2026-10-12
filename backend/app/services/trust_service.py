import hashlib
import json
import os
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional, Tuple

import pandas as pd
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session

from app.core.canonical_json import rfc8785_canonicalize
from app.core.config import settings
from app.models.dataset import Dataset
from app.models.trust import (
    CalculationStatus,
    ClaimReleaseAudit,
    EvidenceRecord,
    LineageTrustStatus,
    ReleaseDecision,
)
from app.models.user import User, Role
from app.schemas.trust import ClaimInput, ClaimVerificationResult


class TrustService:
    def __init__(self, db: Session):
        self.db = db

    def mint_evidence(
        self,
        user: User,
        dataset_id: Optional[int],
        operation: str,
        params: dict[str, Any],
        computed_scalar: Optional[float],
        unit: Optional[str] = None,
        is_synthetic: bool = False,
        dataset_hash: Optional[str] = None,
    ) -> EvidenceRecord:
        """
        Mints an immutable EvidenceRecord anchored to the user and dataset.
        Zero raw rows or PII are stored.
        """
        handle_id = f"ev_{uuid.uuid4().hex}"
        if dataset_hash is None and dataset_id:
            ds = self.db.query(Dataset).filter(Dataset.id == dataset_id).first()
            if ds and ds.file_path and os.path.exists(ds.file_path):
                dataset_hash = self._compute_file_sha256(ds.file_path)

        params_canonical = rfc8785_canonicalize(params).decode("utf-8")

        record = EvidenceRecord(
            handle_id=handle_id,
            owner_id=user.id,
            dataset_id=dataset_id,
            dataset_hash=dataset_hash,
            operation=operation.upper(),
            params_json=params_canonical,
            computed_scalar=computed_scalar,
            unit=unit,
            is_synthetic=is_synthetic,
            created_at=datetime.now(timezone.utc),
        )
        self.db.add(record)
        self.db.commit()
        self.db.refresh(record)
        return record

    def resolve_evidence(self, handle_id: str, current_user: User) -> Optional[EvidenceRecord]:
        """
        Resolves an evidence record enforcing dataset ownership and authorization.
        Returns None on unauthorized or missing handles (prevents resource enumeration).
        """
        record = self.db.query(EvidenceRecord).filter(EvidenceRecord.handle_id == handle_id).first()
        if not record:
            return None

        # Check authorization: user must own the record or have explicit admin rights
        if record.owner_id != current_user.id and current_user.role != Role.admin:
            return None

        return record

    def verify_and_release_claim(self, claim: ClaimInput, user: User) -> ClaimVerificationResult:
        """
        Full provenance-aware claim release pipeline:
        1. Checks dataset authorization and resolves snapshot.
        2. Independently recomputes arithmetic value via safe Pandas function.
        3. Evaluates lineage signals (freshness, null rate, drift, uncertainty).
        4. Applies deterministic policy matrix for release decision.
        5. Persists tamper-evident audit record with bounded DB-level write retries.
        """
        reasons = []
        calc_status = CalculationStatus.NOT_RECOMPUTABLE
        lineage_status = LineageTrustStatus.PASS
        recomputed_val: Optional[float] = None
        dataset_name: Optional[str] = None
        dataset_age_days: Optional[int] = None
        null_pct: Optional[float] = None
        is_synthetic = False

        # 1. Authorization & Dataset Lookup
        if claim.target_dataset_id is not None:
            dataset = self.db.query(Dataset).filter(Dataset.id == claim.target_dataset_id).first()
            if not dataset:
                calc_status = CalculationStatus.UNAUTHORIZED
                lineage_status = LineageTrustStatus.FAIL
                reasons.append("Referenced dataset could not be resolved.")
            elif dataset.uploaded_by != user.id and user.role not in [Role.admin, Role.analyst]:
                calc_status = CalculationStatus.UNAUTHORIZED
                lineage_status = LineageTrustStatus.FAIL
                reasons.append("Unauthorized access to referenced dataset.")
            else:
                dataset_name = dataset.name
                # Evaluate Freshness Signal
                if dataset.created_at:
                    created_dt = dataset.created_at
                    if created_dt.tzinfo is None:
                        created_dt = created_dt.replace(tzinfo=timezone.utc)
                    age_delta = datetime.now(timezone.utc) - created_dt
                    dataset_age_days = age_delta.days
                    if dataset_age_days > settings.trust_stale_days_threshold:
                        lineage_status = LineageTrustStatus.WARN
                        reasons.append(f"Dataset is older than {settings.trust_stale_days_threshold} days ({dataset_age_days}d).")
                else:
                    lineage_status = LineageTrustStatus.UNKNOWN
                    reasons.append("Dataset creation timestamp is missing (freshness UNKNOWN).")

                # Evaluate Profiling Quality Signal
                prof_dict = {}
                if dataset.profiling_json:
                    try:
                        prof_dict = json.loads(dataset.profiling_json)
                    except Exception:
                        prof_dict = {}

                if prof_dict and isinstance(prof_dict, dict):
                    missing_dict = prof_dict.get("missing_percentages", {})
                    if claim.column_name and claim.column_name in missing_dict:
                        null_pct = float(missing_dict[claim.column_name])
                        if null_pct > settings.trust_missing_pct_fail * 100:
                            lineage_status = LineageTrustStatus.FAIL
                            reasons.append(f"Column '{claim.column_name}' missing rate ({null_pct:.1f}%) exceeds failure threshold.")
                        elif null_pct > settings.trust_missing_pct_warn * 100:
                            if lineage_status != LineageTrustStatus.FAIL:
                                lineage_status = LineageTrustStatus.WARN
                            reasons.append(f"Column '{claim.column_name}' missing rate ({null_pct:.1f}%) exceeds warning threshold.")

                # Recompute arithmetic calculation independently on immutable snapshot
                if dataset.file_path and os.path.exists(dataset.file_path):
                    snapshot_hash = self._compute_file_sha256(dataset.file_path)
                    recomputed_val, recompute_err = self._recompute_scalar(
                        dataset.file_path, claim.column_name, claim.operation
                    )
                    if recompute_err:
                        calc_status = CalculationStatus.NOT_RECOMPUTABLE
                        reasons.append(f"Recomputation failed: {recompute_err}")
                    elif recomputed_val is not None and claim.claimed_value is not None:
                        # Compare with floating tolerance 1e-4
                        if abs(recomputed_val - claim.claimed_value) <= 1e-4:
                            calc_status = CalculationStatus.MATCH
                            reasons.append(f"Recomputation matched claimed value ({recomputed_val:.4f}).")
                        else:
                            calc_status = CalculationStatus.MISMATCH
                            reasons.append(
                                f"Arithmetic mismatch: claimed {claim.claimed_value}, recomputed {recomputed_val:.4f}."
                            )
                    else:
                        calc_status = CalculationStatus.NOT_RECOMPUTABLE
                else:
                    snapshot_hash = None
                    calc_status = CalculationStatus.NOT_RECOMPUTABLE
                    lineage_status = LineageTrustStatus.FAIL
                    reasons.append("Underlying dataset file is missing from server storage.")
        else:
            # Check if this claim was minted from synthetic mock KPIs
            if claim.evidence_handle:
                ev = self.resolve_evidence(claim.evidence_handle, user)
                if ev and ev.is_synthetic:
                    is_synthetic = True
                    calc_status = CalculationStatus.SYNTHETIC
                    lineage_status = LineageTrustStatus.WARN
                    recomputed_val = ev.computed_scalar
                    reasons.append("Claim backed by synthetic platform demonstration data.")
            else:
                calc_status = CalculationStatus.NOT_RECOMPUTABLE
                lineage_status = LineageTrustStatus.UNKNOWN
                reasons.append("No dataset or evidence handle attached to claim.")

        # Repository Realities: Drift and Model Calibration are UNKNOWN in this repo
        reasons.append("Dataset distribution drift is UNKNOWN (not configured in repository).")
        reasons.append("Model prediction calibration is UNKNOWN (not configured in repository).")

        # 4. Deterministic Policy Gatekeeping
        decision = self._evaluate_release_decision(calc_status, lineage_status, is_synthetic)

        # 5. Mint evidence handle if matched and real
        evidence_handle = claim.evidence_handle
        if calc_status == CalculationStatus.MATCH and claim.target_dataset_id and not evidence_handle:
            ev = self.mint_evidence(
                user=user,
                dataset_id=claim.target_dataset_id,
                operation=claim.operation,
                params={"column": claim.column_name},
                computed_scalar=recomputed_val,
                unit=claim.unit,
                is_synthetic=False,
                dataset_hash=snapshot_hash,
            )
            evidence_handle = ev.handle_id

        # 6. Append to Tamper-Evident Audit Ledger (DB-Level Write Serialization)
        self.append_audit_record_with_retry(
            user_id=user.id,
            claim_id=claim.claim_id,
            calculation_status=calc_status.value,
            lineage_trust_status=lineage_status.value,
            release_decision=decision.value,
            claimed_value=claim.claimed_value,
            recomputed_value=recomputed_val,
            evidence_handle=evidence_handle,
        )

        return ClaimVerificationResult(
            claim_id=claim.claim_id,
            sentence=claim.sentence,
            target_dataset_id=claim.target_dataset_id,
            column_name=claim.column_name,
            operation=claim.operation,
            claimed_value=claim.claimed_value,
            recomputed_value=recomputed_val,
            calculation_status=calc_status,
            lineage_trust_status=lineage_status,
            release_decision=decision,
            evidence_handle=evidence_handle,
            reasons=reasons,
            dataset_name=dataset_name,
            dataset_age_days=dataset_age_days,
            null_percentage=null_pct,
            drift_status="UNKNOWN",
            calibration_status="UNKNOWN",
        )

    def _evaluate_release_decision(
        self,
        calc_status: CalculationStatus,
        lineage_status: LineageTrustStatus,
        is_synthetic: bool,
    ) -> ReleaseDecision:
        """
        Pure, transparent rule-based release state machine:
        - ANY mismatch, failure, or unauthorized status -> WITHHELD.
        - Synthetic claims -> Strictly QUALIFIED; NEVER VERIFIED.
        - Matching calc + warnings or unknown signals -> QUALIFIED.
        - Matching calc + ALL required signals PASS -> VERIFIED.
        """
        if calc_status in [CalculationStatus.MISMATCH, CalculationStatus.UNAUTHORIZED]:
            return ReleaseDecision.WITHHELD

        if lineage_status == LineageTrustStatus.FAIL:
            return ReleaseDecision.WITHHELD

        if is_synthetic or calc_status == CalculationStatus.SYNTHETIC:
            return ReleaseDecision.QUALIFIED

        if calc_status == CalculationStatus.MATCH:
            if lineage_status == LineageTrustStatus.PASS:
                return ReleaseDecision.VERIFIED
            else:
                return ReleaseDecision.QUALIFIED

        return ReleaseDecision.WITHHELD

    def _recompute_scalar(
        self, file_path: str, column_name: Optional[str], operation: str
    ) -> Tuple[Optional[float], Optional[str]]:
        try:
            ext = Path(file_path).suffix.lower()
            if ext == ".csv":
                df = pd.read_csv(file_path)
            elif ext in [".xlsx", ".xls"]:
                df = pd.read_excel(file_path)
            else:
                return None, f"Unsupported file type '{ext}'"

            if not column_name or column_name not in df.columns:
                return None, f"Column '{column_name}' not found in dataset"

            series = pd.to_numeric(df[column_name], errors="coerce").dropna()
            if series.empty:
                return None, f"Column '{column_name}' contains no numeric data"

            op = operation.upper()
            if op == "SUM":
                return float(series.sum()), None
            elif op in ["MEAN", "AVG"]:
                return float(series.mean()), None
            elif op == "COUNT":
                return float(len(series)), None
            elif op == "MIN":
                return float(series.min()), None
            elif op == "MAX":
                return float(series.max()), None
            else:
                return None, f"Unsupported aggregation operation '{operation}'"
        except Exception as e:
            return None, str(e)

    def append_audit_record_with_retry(
        self,
        user_id: int,
        claim_id: str,
        calculation_status: str,
        lineage_trust_status: str,
        release_decision: str,
        claimed_value: Optional[float],
        recomputed_value: Optional[float],
        evidence_handle: Optional[str],
        max_retries: int = 5,
    ) -> ClaimReleaseAudit:
        """
        Database-level write serialization on SQLite:
        Executes 'BEGIN IMMEDIATE' to acquire SQLite write lock at transaction start,
        preventing lock contention races and enforcing UNIQUE(user_id, sequence_id).
        Uses bounded retries with jittered exponential backoff.
        """
        for attempt in range(max_retries):
            try:
                # If using SQLite, begin immediate write transaction
                bind = self.db.get_bind()
                if bind.dialect.name == "sqlite":
                    self.db.execute(text("BEGIN IMMEDIATE"))

                last_entry = (
                    self.db.query(ClaimReleaseAudit)
                    .filter(ClaimReleaseAudit.user_id == user_id)
                    .order_by(ClaimReleaseAudit.sequence_id.desc())
                    .first()
                )
                prev_hash = last_entry.record_hash if last_entry else ("0" * 64)
                next_seq = (last_entry.sequence_id + 1) if last_entry else 1
                now_utc = datetime.now(timezone.utc).isoformat()

                payload = {
                    "claim_id": claim_id,
                    "user_id": user_id,
                    "sequence_id": next_seq,
                    "timestamp_utc": now_utc,
                    "calculation_status": calculation_status,
                    "lineage_trust_status": lineage_trust_status,
                    "release_decision": release_decision,
                    "claimed_value": claimed_value,
                    "recomputed_value": recomputed_value,
                    "evidence_handle": evidence_handle,
                    "prev_record_hash": prev_hash,
                }
                canonical_bytes = rfc8785_canonicalize(payload)
                record_hash = hashlib.sha256(canonical_bytes).hexdigest()

                audit_entry = ClaimReleaseAudit(
                    user_id=user_id,
                    sequence_id=next_seq,
                    claim_id=claim_id,
                    timestamp_utc=now_utc,
                    calculation_status=calculation_status,
                    lineage_trust_status=lineage_trust_status,
                    release_decision=release_decision,
                    claimed_value=claimed_value,
                    recomputed_value=recomputed_value,
                    evidence_handle=evidence_handle,
                    prev_record_hash=prev_hash,
                    record_hash=record_hash,
                )
                self.db.add(audit_entry)
                self.db.commit()
                self.db.refresh(audit_entry)
                return audit_entry
            except (IntegrityError, OperationalError) as e:
                self.db.rollback()
                if attempt == max_retries - 1:
                    raise RuntimeError(f"Failed to append audit record after {max_retries} attempts: {e}") from e
                time.sleep(0.05 * (2**attempt))
            except Exception:
                self.db.rollback()
                raise

        raise RuntimeError("Audit record append exceeded retry limit.")

    def verify_audit_chain(
        self, user_id: int, expected_head_hash: Optional[str] = None
    ) -> Tuple[bool, int, Optional[int], str, Optional[str]]:
        """
        Walks the user's audit chain validating RFC 8785 hash continuity.
        Detects payload tampering, intermediate deletion, and reordering.
        When expected_head_hash is supplied (from an independently anchored checkpoint),
        it also detects tail truncation (silent deletion of final records).
        Returns: (is_valid, chain_length, tampered_sequence_id, message, latest_hash)
        """
        records = (
            self.db.query(ClaimReleaseAudit)
            .filter(ClaimReleaseAudit.user_id == user_id)
            .order_by(ClaimReleaseAudit.sequence_id.asc())
            .all()
        )
        if not records:
            if expected_head_hash:
                return False, 0, 0, "Tail truncation detected: audit chain is empty but expected checkpoint exists.", None
            return True, 0, None, "Audit chain is empty and valid.", None

        expected_prev_hash = "0" * 64
        for idx, r in enumerate(records, start=1):
            if r.sequence_id != idx:
                return False, len(records), r.sequence_id, f"Sequence gap at record {r.id}: expected {idx}, got {r.sequence_id}.", r.record_hash

            if r.prev_record_hash != expected_prev_hash:
                return False, len(records), r.sequence_id, f"Hash linkage broken at sequence {r.sequence_id}: prev_hash does not match predecessor.", r.record_hash

            payload = {
                "claim_id": r.claim_id,
                "user_id": r.user_id,
                "sequence_id": r.sequence_id,
                "timestamp_utc": r.timestamp_utc,
                "calculation_status": r.calculation_status,
                "lineage_trust_status": r.lineage_trust_status,
                "release_decision": r.release_decision,
                "claimed_value": r.claimed_value,
                "recomputed_value": r.recomputed_value,
                "evidence_handle": r.evidence_handle,
                "prev_record_hash": r.prev_record_hash,
            }
            canonical_bytes = rfc8785_canonicalize(payload)
            expected_hash = hashlib.sha256(canonical_bytes).hexdigest()

            if r.record_hash != expected_hash:
                return False, len(records), r.sequence_id, f"Record payload tampered at sequence {r.sequence_id}: hash mismatch.", r.record_hash

            expected_prev_hash = r.record_hash

        latest_hash = records[-1].record_hash
        if expected_head_hash and latest_hash != expected_head_hash:
            return (
                False,
                len(records),
                records[-1].sequence_id,
                f"Tail truncation detected: latest hash {latest_hash} does not match expected checkpoint head {expected_head_hash}.",
                latest_hash,
            )

        return True, len(records), None, "Audit chain verified intact.", latest_hash

    @staticmethod
    def _compute_file_sha256(file_path: str) -> str:
        sha256 = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                sha256.update(chunk)
        return sha256.hexdigest()
