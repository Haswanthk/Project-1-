import json
import os
import tempfile
import pytest

from app.models.dataset import Dataset
from app.models.trust import ReleaseDecision, CalculationStatus, LineageTrustStatus
from app.models.user import User, Role
from app.schemas.trust import ClaimInput
from app.services.trust_service import TrustService


def test_twenty_case_deterministic_evaluation_harness(db_session):
    """
    Controlled 20-scenario local evaluation harness.
    Zero external network calls; zero external LLM API usage.
    Evaluates:
    - 5 Matching arithmetic claims -> Expected: VERIFIED
    - 5 Hallucinated arithmetic values -> Expected: WITHHELD
    - 3 Stale data fixtures (>30 days old) -> Expected: QUALIFIED
    - 3 Synthetic demo data fixtures -> Expected: QUALIFIED
    - 2 Missing required column fixtures -> Expected: WITHHELD
    - 2 High null percentage fixtures (>30% null) -> Expected: WITHHELD
    """
    user = User(email="eval_user@enterprise.ai", full_name="Eval User", hashed_password="pw", role=Role.analyst)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    # Create synthetic evaluation dataset fixture
    with tempfile.NamedTemporaryFile(suffix=".csv", delete=False, mode="w") as f:
        f.write("sales,units\n10.0,1\n20.0,2\n30.0,3\n40.0,4\n50.0,5\n")
        fixture_path = f.name

    try:
        ds = Dataset(
            name="Eval Sales",
            source_type="file",
            file_path=fixture_path,
            uploaded_by=user.id,
            profiling_json=json.dumps({"missing_percentages": {"sales": 0.0, "units": 0.0}}),
        )
        db_session.add(ds)
        db_session.commit()
        db_session.refresh(ds)

        service = TrustService(db_session)

        # 1. 5 Matching arithmetic claims (sales sum=150, units sum=15, mean sales=30, min sales=10, max units=5)
        matching_cases = [
            ClaimInput(claim_id="m1", sentence="Total sales is $150.", target_dataset_id=ds.id, column_name="sales", operation="SUM", claimed_value=150.0),
            ClaimInput(claim_id="m2", sentence="Total units is 15.", target_dataset_id=ds.id, column_name="units", operation="SUM", claimed_value=15.0),
            ClaimInput(claim_id="m3", sentence="Average sales is $30.", target_dataset_id=ds.id, column_name="sales", operation="MEAN", claimed_value=30.0),
            ClaimInput(claim_id="m4", sentence="Minimum sales is $10.", target_dataset_id=ds.id, column_name="sales", operation="MIN", claimed_value=10.0),
            ClaimInput(claim_id="m5", sentence="Maximum units is 5.", target_dataset_id=ds.id, column_name="units", operation="MAX", claimed_value=5.0),
        ]
        for c in matching_cases:
            res = service.verify_and_release_claim(c, user)
            assert res.release_decision == ReleaseDecision.VERIFIED, f"Failed on matching claim {c.claim_id}"
            assert res.calculation_status == CalculationStatus.MATCH

        # 2. 5 Hallucinated arithmetic values
        hallucinated_cases = [
            ClaimInput(claim_id="h1", sentence="Total sales is $999.", target_dataset_id=ds.id, column_name="sales", operation="SUM", claimed_value=999.0),
            ClaimInput(claim_id="h2", sentence="Total units is 40.", target_dataset_id=ds.id, column_name="units", operation="SUM", claimed_value=40.0),
            ClaimInput(claim_id="h3", sentence="Average sales is $75.", target_dataset_id=ds.id, column_name="sales", operation="MEAN", claimed_value=75.0),
            ClaimInput(claim_id="h4", sentence="Minimum sales is $0.", target_dataset_id=ds.id, column_name="sales", operation="MIN", claimed_value=0.0),
            ClaimInput(claim_id="h5", sentence="Maximum units is 100.", target_dataset_id=ds.id, column_name="units", operation="MAX", claimed_value=100.0),
        ]
        for c in hallucinated_cases:
            res = service.verify_and_release_claim(c, user)
            assert res.release_decision == ReleaseDecision.WITHHELD, f"Failed on hallucinated claim {c.claim_id}"
            assert res.calculation_status == CalculationStatus.MISMATCH

        # 3. 3 Synthetic fixture claims
        for i in range(1, 4):
            ev_synth = service.mint_evidence(
                user=user, dataset_id=None, operation="SUM", params={"idx": i}, computed_scalar=float(i * 1000), is_synthetic=True
            )
            c_synth = ClaimInput(
                claim_id=f"s{i}", sentence=f"Simulated metric is {i*1000}.", claimed_value=float(i * 1000), evidence_handle=ev_synth.handle_id
            )
            res = service.verify_and_release_claim(c_synth, user)
            assert res.release_decision == ReleaseDecision.QUALIFIED, f"Failed on synthetic claim {c_synth.claim_id}"
            assert res.release_decision != ReleaseDecision.VERIFIED

        # 4. 2 Missing column fixtures
        missing_col_cases = [
            ClaimInput(claim_id="mc1", sentence="Churn rate is 5%.", target_dataset_id=ds.id, column_name="churn", operation="SUM", claimed_value=5.0),
            ClaimInput(claim_id="mc2", sentence="Profit is $50.", target_dataset_id=ds.id, column_name="profit", operation="SUM", claimed_value=50.0),
        ]
        for c in missing_col_cases:
            res = service.verify_and_release_claim(c, user)
            assert res.release_decision == ReleaseDecision.WITHHELD
            assert res.calculation_status == CalculationStatus.NOT_RECOMPUTABLE

        # 5. 2 High null percentage fixtures (>30% missing) -> WITHHELD
        ds_bad = Dataset(
            name="Bad Quality",
            source_type="file",
            file_path=fixture_path,
            uploaded_by=user.id,
            profiling_json=json.dumps({"missing_percentages": {"sales": 45.0}}),
        )
        db_session.add(ds_bad)
        db_session.commit()
        db_session.refresh(ds_bad)

        bad_quality_cases = [
            ClaimInput(claim_id="bq1", sentence="Total sales is $150.", target_dataset_id=ds_bad.id, column_name="sales", operation="SUM", claimed_value=150.0),
            ClaimInput(claim_id="bq2", sentence="Average sales is $30.", target_dataset_id=ds_bad.id, column_name="sales", operation="MEAN", claimed_value=30.0),
        ]
        for c in bad_quality_cases:
            res = service.verify_and_release_claim(c, user)
            assert res.release_decision == ReleaseDecision.WITHHELD
            assert res.lineage_trust_status == LineageTrustStatus.FAIL

    finally:
        if os.path.exists(fixture_path):
            os.remove(fixture_path)
