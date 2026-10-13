# Research Benchmark Reproducibility Guide

## 1. Overview and Environment Requirements

This document provides complete instructions for deterministically reproducing the evaluation benchmark, statistical analyses, and verification checks for the **Claim-Level Trust Verification Framework**.

### System Requirements
- **Python**: 3.12 or 3.13
- **OS**: Windows / Linux / macOS (all path operations are cross-platform compatible)
- **Virtual Environment**: Standard Python virtual environment with dependencies installed:
  ```bash
  pip install -r backend/requirements.txt
  ```
- **Dependencies**: `fastapi`, `pydantic`, `sqlalchemy`, `pandas`, `scipy`, `scikit-learn`, `pytest`, `httpx`

---

## 2. Frozen Evaluation Protocol

The evaluation protocol is deterministically frozen and identified by its cryptographic SHA-256 protocol hash:

- **Protocol Version**: `1.0.0`
- **Scenario Matrix Version**: `2.0.0` (Expanded 12-scenario matrix)
- **Random Seed**: `42`
- **Train / Validation / Test Split Ratio**: `0.70 / 0.15 / 0.15`
- **Deterministic Protocol Hash**: `62b958cbf646d492396b328fabb0308586986a8b16e6733fb0dde94b57ba8455`

### Evaluated Benchmark Datasets
1. **Telco Customer Churn (`telco_churn`)**: 100 rows, 5 columns. Local platform retention test fixture (`backend/test_data.csv`). Target variable: `churn`.
2. **Breast Cancer Wisconsin (`breast_cancer_wisconsin`)**: 569 rows, 31 columns. UCI ML Repository via Scikit-Learn standard library. Target variable: `target`.
3. **Wine Recognition (`wine_recognition`)**: 178 rows, 14 columns. UCI ML Repository via Scikit-Learn standard library. Target variable: `target`.

---

## 3. Step-by-Step Reproduction Instructions

### Step 1: Run the Full Test Suite
To verify the complete unit, integration, and security regression test suite (45 automated tests):
```bash
# From workspace root
pytest backend/tests
```
Expected output:
```text
======================== 45 passed, 1 warning in ~5.5s ========================
```

### Step 2: Execute the Deterministic Benchmark
To run both validation runs and generate all versioned machine-readable artifacts:
```bash
# Set PYTHONPATH to backend directory
python backend/app/evaluation/execute_runs.py
```
This command runs:
1. `execute_two_runs()`: Generates `benchmark_run_1.{json,csv,md}`, `benchmark_run_2.{json,csv,md}`, and `reproducibility_comparison.json`.
2. `execute_final_benchmark()`: Generates `final_benchmark_run_1.{json,csv}`, `final_benchmark_run_2.{json,csv}`, `final_benchmark_summary.md`, and `final_reproducibility_comparison.json`.

Expected reproducibility output:
```text
[VALIDATION] Comparison summary:
  Reproducible:                  True
  Mismatches count:              0
  Decisions compared:            185
  Decisions matching:            185
  Decision reproducibility rate: 100.00%
```

---

## 4. Mapping of Research Claims to Code and Tests

| Research Component | Implementation Source | Verification Test File |
| :--- | :--- | :--- |
| **Claim Arithmetic Verification** | `backend/app/services/trust_service.py` | `backend/tests/test_trust_engine.py` |
| **Snapshot Single-Read (TOCTOU Safe)** | `TrustService._recompute_scalar_from_bytes` | `backend/tests/test_trust_integrity_and_auth.py` |
| **Tamper-Evident Audit Chain** | `TrustService.append_audit_record_with_retry` | `backend/tests/test_audit_concurrency.py` |
| **Tail Truncation Detection** | `AuditCheckpointStore` in `trust_service.py` | `backend/tests/test_trust_integrity_and_auth.py` |
| **Registration Privilege Safety** | `AuthService.register` in `auth_service.py` | `backend/tests/test_trust_integrity_and_auth.py` |
| **KS/PSI Drift Detection** | `backend/app/services/drift_detection_service.py` | `backend/tests/test_drift_propagation.py` |
| **Upstream Lineage Propagation** | `backend/app/services/trust_propagation.py` | `backend/tests/test_drift_propagation.py` |
| **Multi-Dataset Adapters & Splits** | `backend/app/evaluation/adapters.py` | `backend/tests/test_benchmark_hardening.py` |
| **Strict Metric Attribution** | `MetricsCalculator.calculate` in `metrics.py` | `backend/tests/test_trust_integrity_and_auth.py` |
| **Paired Contingency & McNemar** | `MetricsCalculator.calculate_paired_d_vs_e` | `backend/tests/test_trust_integrity_and_auth.py` |
| **Feature Flag Guard (`OFF` by default)** | `backend/app/core/config.py` | `backend/tests/test_feature_flag.py` |

---

## 5. Statistical Caveats and Evaluation Boundaries

1. **Deterministic Offline Simulation**: Experimental conditions A, B, and C simulate plain LLMs, RAG, and arithmetic verification using deterministic local rule-based pipelines and fixtures. They do not invoke commercial black-box LLM APIs (e.g. GPT-4, Gemini Pro).
2. **Cluster Dependence**: All 37 claims are clustered within 3 underlying datasets. Because claims within the same dataset share feature distributions and fault injection scenarios, observations are not independent and identically distributed (non-i.i.d.).
3. **Statistical Significance**: The exact paired McNemar test on claim correctness actions yields $p = 0.2891$ ($b = 6, c = 2$), failing to reach the conventional $\alpha = 0.05$ threshold. Consequently, population-level statistical significance cannot be claimed.
4. **Controlled Ablation Scope**: The ablation isolates the specific contribution of upstream drift propagation under controlled perturbation. It establishes internal mechanism validity, not external generalization across arbitrary real-world distributions.
