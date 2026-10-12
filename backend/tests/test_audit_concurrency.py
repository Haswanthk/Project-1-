import concurrent.futures
import pytest
from app.models.user import User, Role
from app.models.trust import ClaimReleaseAudit
from app.services.trust_service import TrustService


def test_audit_chain_sequential_and_tamper_evident(db_session):
    """
    Verifies that audit ledger maintains unbroken SHA-256 hash chaining,
    and verify_audit_chain detects intentional record payload modifications or sequence tampering.
    """
    user = User(email="audit_user@enterprise.ai", full_name="Audit User", hashed_password="pw", role=Role.analyst)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    service = TrustService(db_session)

    # Append 5 records sequentially
    for i in range(1, 6):
        service.append_audit_record_with_retry(
            user_id=user.id,
            claim_id=f"c_{i}",
            calculation_status="MATCH",
            lineage_trust_status="PASS",
            release_decision="VERIFIED",
            claimed_value=float(i * 100),
            recomputed_value=float(i * 100),
            evidence_handle=f"ev_{i}",
        )

    # 1. Verify chain is valid initially
    is_valid, length, tampered_seq, msg, latest_hash = service.verify_audit_chain(user.id)
    assert is_valid is True
    assert length == 5
    assert tampered_seq is None
    assert latest_hash is not None

    # 2. Tamper with record #3 (modify claimed_value)
    rec3 = db_session.query(ClaimReleaseAudit).filter_by(user_id=user.id, sequence_id=3).first()
    rec3.claimed_value = 999999.0
    db_session.commit()

    # 3. Chain verification must detect tampering at sequence #3
    is_valid_t, length_t, tampered_seq_t, msg_t, _ = service.verify_audit_chain(user.id)
    assert is_valid_t is False
    assert tampered_seq_t == 3
    assert "tampered" in msg_t.lower()

    # 4. Tail Truncation Test:
    # When an external checkpoint recorded latest_hash, deleting record #5 must be detected
    rec3.claimed_value = 300.0  # restore rec3
    db_session.commit()
    is_valid_restored, _, _, _, restored_head_hash = service.verify_audit_chain(user.id)
    assert is_valid_restored is True

    # Delete tail record #5
    rec5 = db_session.query(ClaimReleaseAudit).filter_by(user_id=user.id, sequence_id=5).first()
    db_session.delete(rec5)
    db_session.commit()

    # Without checkpoint: remaining 4 records look internally valid (chain length 4)
    is_valid_internal, length_internal, _, _, new_head = service.verify_audit_chain(user.id)
    assert is_valid_internal is True
    assert length_internal == 4

    # With checkpoint: tail truncation is immediately detected
    is_valid_trunc, _, _, trunc_msg, _ = service.verify_audit_chain(user.id, expected_head_hash=restored_head_hash)
    assert is_valid_trunc is False
    assert "tail truncation" in trunc_msg.lower()


def test_audit_concurrency_independent_sessions(isolated_test_db):
    """
    Spawns multiple worker threads writing to the audit log simultaneously
    using independent database sessions. Verifies:
    1. Zero duplicate (user_id, sequence_id) constraint violations.
    2. Monotonic, gapless sequence IDs (1..N).
    3. Perfect, unbroken hash continuity across all concurrent writes.
    """
    TestingSessionLocal, _, _ = isolated_test_db

    # Create user
    setup_session = TestingSessionLocal()
    user = User(email="concurrent_user@enterprise.ai", full_name="Concurrent User", hashed_password="pw", role=Role.analyst)
    setup_session.add(user)
    setup_session.commit()
    setup_session.refresh(user)
    user_id = user.id
    setup_session.close()

    total_writes = 10

    def write_worker(idx):
        session = TestingSessionLocal()
        try:
            svc = TrustService(session)
            svc.append_audit_record_with_retry(
                user_id=user_id,
                claim_id=f"concurrent_claim_{idx}",
                calculation_status="MATCH",
                lineage_trust_status="PASS",
                release_decision="VERIFIED",
                claimed_value=float(idx),
                recomputed_value=float(idx),
                evidence_handle=f"ev_conc_{idx}",
            )
        finally:
            session.close()

    # Execute concurrent writes across thread pool
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        futures = [executor.submit(write_worker, i) for i in range(1, total_writes + 1)]
        for f in concurrent.futures.as_completed(futures):
            f.result()

    # Validate final audit chain
    verify_session = TestingSessionLocal()
    svc = TrustService(verify_session)
    is_valid, length, tampered_seq, msg, latest_hash = svc.verify_audit_chain(user_id)
    verify_session.close()

    assert is_valid is True, f"Audit chain verification failed: {msg}"
    assert length == total_writes
    assert tampered_seq is None
