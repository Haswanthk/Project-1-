"""
Stage 16 Tests — Statistical Validity, Benchmark Corrections, and Trust Integrity Audit.
Tests:
1. Metric attribution (Conditions A, B, C receive None for drift detector metrics).
2. Paired D-versus-E alignment, 2x2 contingency table, exact McNemar test, and cluster caveat.
3. Dataset snapshot consistency (single-read byte buffer eliminates TOCTOU races).
4. Audit ledger tail-truncation detection via AuditCheckpointStore vs interior tampering.
5. Registration privilege escalation prevention (cannot self-grant admin role).
6. Administrative endpoint role enforcement (unauthorized 403, authorized admin 200).
"""
import io
import os
import hashlib
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.models.user import Role, User
from app.models.trust import ClaimReleaseAudit
from app.schemas.auth import RegisterRequest
from app.services.auth_service import AuthService
from app.services.trust_service import TrustService, AuditCheckpointStore
from app.evaluation.metrics import MetricsCalculator


# ─────────────────────────────────────────────────────────────────────────────
# 1. Metric Attribution Tests
# ─────────────────────────────────────────────────────────────────────────────

def test_metric_attribution_conditions_a_b_c_have_no_detector():
    """
    Proves that conditions without a drift detector (Plain LLM, RAG, Numeric Verify)
    are NOT credited with drift detection capability or precision/recall.
    """
    calc = MetricsCalculator()
    mock_records = [
        {
            "claim_id": "c1",
            "ground_truth_correct": True,
            "is_unsupported": False,
            "released": True,
            "release_decision": "VERIFIED",
            "latency_ms": 1.0,
            "drift_injected": True,
            "drift_detected": True,
            "affected_by_drift": True,
            "withheld_by_drift": False,
            "success": True,
        },
        {
            "claim_id": "c2",
            "ground_truth_correct": False,
            "is_unsupported": False,
            "released": False,
            "release_decision": "WITHHELD",
            "latency_ms": 1.0,
            "drift_injected": False,
            "drift_detected": False,
            "affected_by_drift": False,
            "withheld_by_drift": False,
            "success": True,
        },
    ]

    for cond_id in ["plain_llm", "llm_rag", "llm_numeric_verify"]:
        summary = calc.calculate(mock_records, condition_id=cond_id)
        assert summary.drift_detection_precision is None
        assert summary.drift_detection_recall is None
        assert summary.drift_f1 is None
        assert summary.drift_false_positive_rate is None
        assert summary.drift_withheld_rate is None
        assert summary.correct_downgrade_rate is None
        assert summary.total_drift_injected == 0
        assert summary.total_drift_detected == 0

    # Condition E (ablation): propagation is disabled so drift_withheld_rate is 0.0
    summary_e = calc.calculate(mock_records, condition_id="no_propagation_ablation")
    assert summary_e.drift_withheld_rate == 0.0

    # Condition D (full trust): attributes drift detection and propagation
    summary_d = calc.calculate(mock_records, condition_id="claim_level_trust")
    assert summary_d.drift_detection_precision is not None
    assert summary_d.drift_detection_recall is not None
    assert summary_d.drift_f1 is not None


# ─────────────────────────────────────────────────────────────────────────────
# 2. Paired Statistical Comparison Tests
# ─────────────────────────────────────────────────────────────────────────────

def test_paired_d_vs_e_alignment_and_mcnemar():
    """
    Validates paired alignment between Condition D and Condition E across scenarios,
    2x2 contingency table generation, exact McNemar calculation, and cluster caveat.
    """
    records_d = [
        {"dataset_id": "ds1", "scenario_id": "s1", "claim_id": "c1", "released": True, "ground_truth_correct": True, "is_unsupported": False},
        {"dataset_id": "ds1", "scenario_id": "s2", "claim_id": "c2", "released": False, "ground_truth_correct": False, "is_unsupported": False},
        {"dataset_id": "ds1", "scenario_id": "s3", "claim_id": "c3", "released": False, "ground_truth_correct": False, "is_unsupported": False},
        {"dataset_id": "ds2", "scenario_id": "s1", "claim_id": "c4", "released": True, "ground_truth_correct": False, "is_unsupported": False},
    ]
    records_e = [
        {"dataset_id": "ds1", "scenario_id": "s1", "claim_id": "c1", "released": True, "ground_truth_correct": True, "is_unsupported": False},
        {"dataset_id": "ds1", "scenario_id": "s2", "claim_id": "c2", "released": True, "ground_truth_correct": False, "is_unsupported": False},
        {"dataset_id": "ds1", "scenario_id": "s3", "claim_id": "c3", "released": True, "ground_truth_correct": False, "is_unsupported": False},
        {"dataset_id": "ds2", "scenario_id": "s1", "claim_id": "c4", "released": True, "ground_truth_correct": False, "is_unsupported": False},
    ]

    paired = MetricsCalculator.calculate_paired_d_vs_e(records_d, records_e)
    assert paired["total_pairs_aligned"] == 4
    ct = paired["contingency_table"]
    assert ct["both_released"] == 2  # c1 and c4
    assert ct["only_d_released"] == 0
    assert ct["only_e_released"] == 2  # c2 and c3 (D withheld, E released)
    assert ct["neither_released"] == 0
    assert ct["both_released"] + ct["only_d_released"] + ct["only_e_released"] + ct["neither_released"] == 4

    # Discordant actions: c2 and c3: D took correct action (withheld false claim), E took incorrect action (released false claim)
    mcn = paired["mcnemar_exact"]
    assert mcn["b"] == 2  # D correct, E incorrect
    assert mcn["c"] == 0  # E correct, D incorrect
    # Exact binomial p-value: 2 * (0.5)^2 = 0.5
    assert mcn["p_value_exact"] == 0.5

    # Check that clustering caveat is explicitly documented
    assert paired["clustering_limitation"]["independent_units_sufficient"] is False
    assert "i.i.d." in paired["clustering_limitation"]["caveat"]


# ─────────────────────────────────────────────────────────────────────────────
# 3. Dataset Snapshot Consistency (TOCTOU Safety) Tests
# ─────────────────────────────────────────────────────────────────────────────

def test_dataset_snapshot_consistency_toctou_safe(tmp_path):
    """
    Verifies that hash computation and scalar recomputation read the same immutable
    in-memory byte buffer, eliminating TOCTOU races where file is modified between calls.
    """
    csv_file = tmp_path / "snapshot_test.csv"
    initial_df = pd.DataFrame({"revenue": [100.0, 200.0, 300.0]})
    initial_df.to_csv(csv_file, index=False)

    with open(csv_file, "rb") as f:
        file_bytes = f.read()

    expected_hash = hashlib.sha256(file_bytes).hexdigest()

    # External concurrent process mutates the file on disk AFTER bytes are read
    mutated_df = pd.DataFrame({"revenue": [999.0, 999.0, 999.0]})
    mutated_df.to_csv(csv_file, index=False)
    disk_hash = hashlib.sha256(open(csv_file, "rb").read()).hexdigest()
    assert disk_hash != expected_hash

    # Recomputation from snapshot bytes must reflect the snapshot, NOT the mutated disk file
    service = TrustService(db=None)  # db not needed for pure calculation
    scalar, err = service._recompute_scalar_from_bytes(file_bytes, ".csv", "revenue", "SUM")
    assert err is None
    assert scalar == 600.0  # 100 + 200 + 300, unaffected by disk mutation


# ─────────────────────────────────────────────────────────────────────────────
# 4. Audit Chain Tail Truncation and Integrity Tests
# ─────────────────────────────────────────────────────────────────────────────

def test_audit_chain_tail_truncation_detection(db_session, tmp_path):
    """
    Proves that a hash chain alone cannot detect tail truncation without an external anchor,
    and proves that AuditCheckpointStore successfully detects tail truncation.
    """
    checkpoint_store = AuditCheckpointStore(storage_dir=str(tmp_path))
    service = TrustService(db_session, checkpoint_store=checkpoint_store)

    user_id = 1001

    # Append 3 audit records
    rec1 = service.append_audit_record_with_retry(user_id, "cl_1", "MATCH", "PASS", "VERIFIED", 100.0, 100.0, "ev_1")
    rec2 = service.append_audit_record_with_retry(user_id, "cl_2", "MATCH", "PASS", "VERIFIED", 200.0, 200.0, "ev_2")
    rec3 = service.append_audit_record_with_retry(user_id, "cl_3", "MISMATCH", "FAIL", "WITHHELD", 300.0, 0.0, None)

    # Full chain verify: valid
    is_valid, length, tampered_seq, msg, latest_hash = service.verify_audit_chain(user_id)
    assert is_valid is True
    assert length == 3
    assert latest_hash == rec3.record_hash

    # Simulate attacker silently truncating the tail (deleting record 3 from database)
    db_session.delete(rec3)
    db_session.commit()

    # Verification WITHOUT checkpoint anchor:
    # A naive hash chain verification without anchor would see records 1 and 2 and claim "valid"!
    service_no_anchor = TrustService(db_session, checkpoint_store=None)
    naive_valid, naive_len, _, _, _ = service_no_anchor.verify_audit_chain(user_id, expected_head_hash=None)
    assert naive_valid is True
    assert naive_len == 2  # Naive chain cannot detect that record 3 was deleted!

    # Verification WITH AuditCheckpointStore (or passing expected_head_hash):
    # Detects tail truncation because checkpoint recorded rec3.record_hash!
    anchor_valid, anchor_len, _, anchor_msg, _ = service.verify_audit_chain(user_id)
    assert anchor_valid is False
    assert "Tail truncation detected" in anchor_msg


def test_audit_chain_interior_tampering_detection(db_session):
    """
    Verifies that modifying an interior record's payload breaks RFC 8785 canonical hash.
    """
    service = TrustService(db_session)
    user_id = 1002

    rec1 = service.append_audit_record_with_retry(user_id, "c1", "MATCH", "PASS", "VERIFIED", 10.0, 10.0, "ev_1")
    rec2 = service.append_audit_record_with_retry(user_id, "c2", "MATCH", "PASS", "VERIFIED", 20.0, 20.0, "ev_2")

    # Tamper with record 1's claimed value directly in the DB
    rec1.claimed_value = 99999.0
    db_session.add(rec1)
    db_session.commit()

    is_valid, length, tampered_seq, msg, _ = service.verify_audit_chain(user_id)
    assert is_valid is False
    assert tampered_seq == 1
    assert "tampered" in msg.lower()


# ─────────────────────────────────────────────────────────────────────────────
# 5. Authentication & Authorization Review Tests
# ─────────────────────────────────────────────────────────────────────────────

def test_auth_registration_cannot_self_assign_admin(client):
    """
    Proves that ordinary users cannot grant themselves an elevated Role.admin
    during self-registration.
    """
    email = "attacker_attempt@enterprise.ai"
    reg_res = client.post("/api/v1/auth/register", json={
        "email": email,
        "password": "AttackerPassword123!",
        "full_name": "Privilege Escalator",
        "role": "admin",  # Attacker attempts to self-assign admin
    })
    assert reg_res.status_code == 201
    user_data = reg_res.json()
    # Must NOT have been granted admin
    assert user_data["role"] != "admin"
    assert user_data["role"] == "viewer"

    # Login as this user
    token = client.post("/api/v1/auth/login", json={
        "email": email,
        "password": "AttackerPassword123!",
    }).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Attempt to invoke protected administrative endpoint
    admin_res = client.get("/api/v1/admin/users", headers=headers)
    assert admin_res.status_code == 403
    assert "Insufficient permissions" in admin_res.json()["detail"]


def test_admin_endpoint_authorization_enforced(client, db_session):
    """
    Proves that unauthorized users receive 403 on protected admin operations,
    while legitimate administrators retain full access.
    """
    # 1. Create ordinary viewer user
    viewer = User(
        email="ordinary_viewer@enterprise.ai",
        full_name="Ordinary Viewer",
        hashed_password="hash",
        role=Role.viewer,
    )
    # 2. Create legitimate admin user
    legit_admin = User(
        email="real_admin@enterprise.ai",
        full_name="Real Admin",
        hashed_password="hash",
        role=Role.admin,
    )
    db_session.add_all([viewer, legit_admin])
    db_session.commit()

    from datetime import timedelta
    from app.core.security import create_token
    viewer_token = create_token(str(viewer.id), timedelta(minutes=60), "access")
    admin_token = create_token(str(legit_admin.id), timedelta(minutes=60), "access")

    # Viewer denied on admin endpoints
    viewer_res = client.get("/api/v1/admin/users", headers={"Authorization": f"Bearer {viewer_token}"})
    assert viewer_res.status_code == 403

    # Admin granted access on admin endpoints
    admin_res = client.get("/api/v1/admin/users", headers={"Authorization": f"Bearer {admin_token}"})
    assert admin_res.status_code == 200
    assert isinstance(admin_res.json(), list)


def test_existing_auth_behavior_remains_compatible(client):
    """
    Verifies backward compatibility:
    - Omitted role defaults to viewer.
    - Role 'analyst' is respected if requested.
    - Login and token handling operate without regressions.
    """
    email_default = "compat_default@enterprise.ai"
    res1 = client.post("/api/v1/auth/register", json={
        "email": email_default,
        "password": "Password123!",
        "full_name": "Compat Default",
    })
    assert res1.status_code == 201
    assert res1.json()["role"] == "viewer"

    email_analyst = "compat_analyst@enterprise.ai"
    res2 = client.post("/api/v1/auth/register", json={
        "email": email_analyst,
        "password": "Password123!",
        "full_name": "Compat Analyst",
        "role": "analyst",
    })
    assert res2.status_code == 201
    assert res2.json()["role"] == "analyst"
