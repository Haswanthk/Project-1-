import hashlib
import os
import tempfile
import pandas as pd
import pytest

from app.core.canonical_json import rfc8785_canonicalize
from app.models.dataset import Dataset
from app.models.trust import (
    CalculationStatus,
    LineageTrustStatus,
    ReleaseDecision,
)
from app.models.user import User, Role
from app.schemas.trust import ClaimInput
from app.services.trust_service import TrustService


def test_rfc8785_canonical_json_determinism():
    """Verify lexicographical key sorting, formatting, negative zero, and RFC 8785 determinism."""
    obj1 = {"z": 1, "a": 2, "m": {"b": True, "a": None, "val": 1500.0, "neg_zero": -0.0, "pos_zero": 0.0}}
    obj2 = {"a": 2, "m": {"val": 1500, "pos_zero": 0, "neg_zero": 0.0, "a": None, "b": True}, "z": 1}

    bytes1 = rfc8785_canonicalize(obj1)
    bytes2 = rfc8785_canonicalize(obj2)

    assert bytes1 == bytes2
    assert bytes1.decode("utf-8") == '{"a":2,"m":{"a":null,"b":true,"neg_zero":0,"pos_zero":0,"val":1500},"z":1}'

    # Verify NaN and Inf rejection
    import math
    with pytest.raises(ValueError, match="RFC 8785 forbids"):
        rfc8785_canonicalize({"bad": math.nan})

    with pytest.raises(ValueError, match="RFC 8785 forbids"):
        rfc8785_canonicalize({"bad": math.inf})


def test_claim_verification_pipeline_recomputation(db_session):
    """
    Tests independent recomputation against a local fixture CSV:
    1. Arithmetic match with clean data -> VERIFIED.
    2. Arithmetic mismatch -> WITHHELD.
    3. Missing column -> WITHHELD.
    """
    user = User(email="test_analyst@enterprise.ai", full_name="Test Analyst", hashed_password="pw", role=Role.analyst)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    # Create temporary fixture CSV
    with tempfile.NamedTemporaryFile(suffix=".csv", delete=False, mode="w") as f:
        f.write("revenue,transactions\n100.0,5\n200.0,10\n300.0,15\n")
        fixture_path = f.name

    try:
        import json
        ds = Dataset(
            name="Sales Fixture",
            source_type="file",
            file_path=fixture_path,
            uploaded_by=user.id,
            profiling_json=json.dumps({"missing_percentages": {"revenue": 0.0}}),
        )
        db_session.add(ds)
        db_session.commit()
        db_session.refresh(ds)

        service = TrustService(db_session)

        # Case 1: Exact match (sum = 600.0) -> VERIFIED
        claim_match = ClaimInput(
            claim_id="c_01",
            sentence="Total revenue is $600.",
            target_dataset_id=ds.id,
            column_name="revenue",
            operation="SUM",
            claimed_value=600.0,
        )
        res_match = service.verify_and_release_claim(claim_match, user)
        assert res_match.calculation_status == CalculationStatus.MATCH
        assert res_match.lineage_trust_status == LineageTrustStatus.PASS
        assert res_match.release_decision == ReleaseDecision.VERIFIED
        assert res_match.evidence_handle is not None

        # Case 2: Arithmetic Mismatch (claimed 999.0 vs recomputed 600.0) -> WITHHELD
        claim_mismatch = ClaimInput(
            claim_id="c_02",
            sentence="Total revenue is $999.",
            target_dataset_id=ds.id,
            column_name="revenue",
            operation="SUM",
            claimed_value=999.0,
        )
        res_mismatch = service.verify_and_release_claim(claim_mismatch, user)
        assert res_mismatch.calculation_status == CalculationStatus.MISMATCH
        assert res_mismatch.release_decision == ReleaseDecision.WITHHELD

        # Case 3: Missing Column -> WITHHELD
        claim_missing_col = ClaimInput(
            claim_id="c_03",
            sentence="Total profit is $500.",
            target_dataset_id=ds.id,
            column_name="nonexistent_profit",
            operation="SUM",
            claimed_value=500.0,
        )
        res_missing = service.verify_and_release_claim(claim_missing_col, user)
        assert res_missing.calculation_status == CalculationStatus.NOT_RECOMPUTABLE
        assert res_missing.release_decision == ReleaseDecision.WITHHELD
    finally:
        if os.path.exists(fixture_path):
            os.remove(fixture_path)


def test_synthetic_data_isolation(db_session):
    """Verifies that synthetic data can NEVER achieve VERIFIED; strictly QUALIFIED."""
    user = User(email="synth_user@enterprise.ai", full_name="Synth User", hashed_password="pw", role=Role.analyst)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    service = TrustService(db_session)
    ev_synth = service.mint_evidence(
        user=user,
        dataset_id=None,
        operation="SUM",
        params={"metric": "mock_kpi"},
        computed_scalar=1250000.0,
        is_synthetic=True,
    )

    claim_synth = ClaimInput(
        claim_id="c_synth",
        sentence="Simulated ARR is $1.25M.",
        claimed_value=1250000.0,
        evidence_handle=ev_synth.handle_id,
    )
    res_synth = service.verify_and_release_claim(claim_synth, user)
    assert res_synth.calculation_status == CalculationStatus.SYNTHETIC
    assert res_synth.release_decision == ReleaseDecision.QUALIFIED
    assert res_synth.release_decision != ReleaseDecision.VERIFIED


def test_authorization_and_non_enumeration(db_session):
    """
    User A cannot access User B's dataset or evidence handle.
    System returns generic UNAUTHORIZED / 404 without revealing existence.
    """
    user_a = User(email="user_a@enterprise.ai", full_name="User A", hashed_password="pw", role=Role.analyst)
    user_b = User(email="user_b@enterprise.ai", full_name="User B", hashed_password="pw", role=Role.analyst)
    db_session.add_all([user_a, user_b])
    db_session.commit()

    service = TrustService(db_session)
    ev_b = service.mint_evidence(
        user=user_b,
        dataset_id=None,
        operation="SUM",
        params={"col": "secret_data"},
        computed_scalar=42.0,
        is_synthetic=False,
    )

    # User A tries to resolve User B's handle -> returns None
    assert service.resolve_evidence(ev_b.handle_id, user_a) is None

    # User B can resolve their own handle
    assert service.resolve_evidence(ev_b.handle_id, user_b) is not None


def test_null_rate_evaluation_with_counts_and_malformed_profiling(db_session, tmp_path):
    """Regression test: verify missing_percentages, missing_values, and malformed profiling data are handled safely."""
    import json
    from app.models.dataset import Dataset
    from app.models.trust import LineageTrustStatus

    user = User(email="prof_test@enterprise.ai", full_name="Prof Tester", hashed_password="pw", role=Role.analyst)
    db_session.add(user)
    db_session.commit()

    # Create dummy csv file
    test_file = tmp_path / "test_data.csv"
    test_file.write_text("revenue,region\n100,US\n200,EU\n300,AP\n", encoding="utf-8")

    # Case A: Profiling with missing_values counts instead of missing_percentages
    # 1 null out of 3 rows = 33.3% > 20% fail threshold
    prof_counts = {"missing_values": {"revenue": 1}, "row_count": 3}
    ds_counts = Dataset(
        name="counts.csv",
        source_type="csv",
        file_path=str(test_file),
        uploaded_by=user.id,
        row_count=3,
        profiling_json=json.dumps(prof_counts),
    )
    db_session.add(ds_counts)
    db_session.commit()

    service = TrustService(db_session)
    c1 = ClaimInput(claim_id="c_cnt", sentence="Sum is 600", target_dataset_id=ds_counts.id, column_name="revenue", operation="SUM", claimed_value=600.0)
    res1 = service.verify_and_release_claim(c1, user)
    assert res1.null_percentage is not None
    assert abs(res1.null_percentage - 33.3333) < 0.1
    assert res1.lineage_trust_status == LineageTrustStatus.FAIL
    assert res1.release_decision == ReleaseDecision.WITHHELD

    # Case B: Profiling with malformed non-JSON string
    ds_malformed = Dataset(
        name="malformed.csv",
        source_type="csv",
        file_path=str(test_file),
        uploaded_by=user.id,
        row_count=3,
        profiling_json="{NOT_VALID_JSON",
    )
    db_session.add(ds_malformed)
    db_session.commit()

    c2 = ClaimInput(claim_id="c_mal", sentence="Sum is 600", target_dataset_id=ds_malformed.id, column_name="revenue", operation="SUM", claimed_value=600.0)
    res2 = service.verify_and_release_claim(c2, user)
    # Should not crash, null_percentage defaults to None, calculation proceeds
    assert res2.calculation_status == CalculationStatus.MATCH
    assert res2.null_percentage is None

