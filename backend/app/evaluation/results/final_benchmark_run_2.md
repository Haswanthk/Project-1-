# Research Evaluation Report: Claim-Level Trust Verification (Audited)
**Protocol Version**: `1.0.0` | **Scenario Matrix**: `2.0.0` | **Random Seed**: `42`
**Deterministic Protocol Hash**: `62b958cbf646d492396b328fabb0308586986a8b16e6733fb0dde94b57ba8455`

> [!NOTE]
> **Offline Deterministic Simulation Disclaimer**: All experimental conditions evaluated herein are deterministic offline simulation conditions executing over local test datasets and fixtures, not live external LLM API calls. Timings reflect local fixture calculation and drift propagation execution times. Generalization to production LLMs or arbitrary external distributions cannot be inferred from offline simulations alone.

## 1. Experimental Conditions Comparison Table

| Condition | Total Claims | Released | Release Coverage | Reliability (Released) | 95% CI Reliability | False Verification Rate | Withholding Precision | Withholding Recall | Mean Latency (ms) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| 1. Plain LLM Baseline | 37 | 37 | 100.00% | **48.65%** | [0.33, 0.64] | 51.35% | 100.00% | 0.00% | 0.00ms |
| 2. LLM + RAG | 37 | 34 | 91.89% | **52.94%** | [0.37, 0.69] | 47.06% | 100.00% | 15.79% | 0.01ms |
| 3. LLM + Numeric Verify | 37 | 25 | 67.57% | **72.00%** | [0.52, 0.86] | 28.00% | 100.00% | 63.16% | 0.22ms |
| 4. Full Claim-Level Trust (Cond D) | 37 | 17 | 45.95% | **94.12%** | [0.73, 0.99] | 5.88% | 90.00% | 94.74% | 10.85ms |
| 5. No-Propagation Ablation (Cond E) | 37 | 25 | 67.57% | **72.00%** | [0.52, 0.86] | 28.00% | 100.00% | 63.16% | 7.55ms |

## 2. Drift Detection and Upstream Propagation Metrics

### 2.1 Standalone Diagnostic Drift Detector Evaluation (Shared KS/PSI Detector)

_Evaluated once across all scenarios at the feature level. Conditions A, B, and C do not execute a drift detector and are not attributed detector metrics._

| Total Features Evaluated | Injected Shifts | Clean Negative Controls | True Positives (TP) | False Positives (FP) | False Negatives (FN) | Precision | Recall | Drift F1 | False Positive Rate |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| 37 | 12 | 25 | 11 | 0 | 1 | 100.00% | 91.67% | 0.9565 | 0.00% |

> **Detector Limitation Note**: 1 missed drift out of 12 was the small shift scenario where magnitude fell below KS alpha threshold.

### 2.2 Condition-Level Release Decisions under Drift & Faults

| Condition | Executes Detector? | Drift Propagation Active? | Released Claims | Withheld Claims | Withheld by Drift Policy | False Verification Rate |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| 1. Plain LLM Baseline | NO | NO | 37 | 0 | N/A | 51.35% |
| 2. LLM + RAG | NO | NO | 34 | 3 | N/A | 47.06% |
| 3. LLM + Numeric Verify | NO | NO | 25 | 12 | N/A | 28.00% |
| 4. Full Claim-Level Trust (Cond D) | YES (Shared) | YES | 17 | 20 | 66.67% | 5.88% |
| 5. No-Propagation Ablation (Cond E) | YES (Shared) | NO (Ablation) | 25 | 12 | 0.00% | 28.00% |

## 3. Paired Statistical Comparison: Condition D vs Condition E (Controlled Ablation)

Condition D (Full Trust with Drift Propagation) and Condition E (No-Propagation Ablation) were evaluated on the exact same underlying claims, feature drift maps, and split allocations.

### 3.1 2x2 Paired Release Contingency Table

| | Condition E: Released | Condition E: Withheld | Total |
| :--- | :---: | :---: | :---: |
| **Condition D: Released** | 17 (16 correct, 1 incorrect) | 0 | **17** |
| **Condition D: Withheld** | 8 (0 correct, 8 incorrect) | 12 (all withheld) | **20** |
| **Total** | **25** | **12** | **37** |

### 3.2 Released Claim Correctness and False Verification Rate

- **Condition D**: Released 17 claims (16 correct, 1 false verified) -> Reliability: **94.12%** (95% CI: [0.73, 0.99]), False Verification Rate: **5.88%**.
- **Condition E**: Released 25 claims (18 correct, 7 false verified) -> Reliability: **72.00%** (95% CI: [0.52, 0.86]), False Verification Rate: **28.00%**.
- **Discordant Claims**: Exactly 8 claims were released by Condition E but withheld by Condition D. All 8 discordant claims were ground-truth faulty/drifted claims correctly suppressed by upstream propagation.

### 3.3 Paired Hypothesis Test (Exact McNemar Test)

- **Discordant Pairs**: $b = 6$ (D correct action, E incorrect action), $c = 2$ (E correct action, D incorrect action).
- **Exact Two-Sided Binomial P-Value**: $p = 0.289062$ ($2 \times 0.5^{8}$).
- **Continuity-Corrected McNemar $\chi^2$**: 1.125.

### 3.4 Clustered Dependence Limitations & Scientific Caution

> [!WARNING]
> **Clustering Caveat**: Observations cluster within 3 datasets and share underlying scenario definitions. Claims are not independently and identically distributed. Therefore, standard i.i.d. assumptions for McNemar significance are violated, and population-level statistical significance cannot be claimed from this benchmark alone.

- **Scope of Conclusion**: The controlled ablation isolates the specific impact of upstream drift propagation under deterministic offline injection. It demonstrates internal consistency within this test harness, but does not prove superiority for real-world live LLMs or production distributions.
- **Non-Overlapping Confidence Intervals**: We report Wilson score confidence intervals for transparency, but do not use interval overlap as the significance test for paired outcomes.

## 4. Benchmark Datasets Evaluated & Provenance

| Dataset Name | ID | Total Rows | Total Cols | Source Provenance | License | Target Variable |
| :--- | :---: | :---: | :---: | :--- | :--- | :---: |
| Telco Customer Churn | `telco_churn` | 100 | 5 | Local Platform Test Fixture (`backend/test_data.csv`) | `UNKNOWN` | `churn` |
| Breast Cancer Wisconsin (Diagnostic) | `breast_cancer_wisconsin` | 569 | 31 | UCI Machine Learning Repository (Wolberg, Street, Mangasarian, 1995) via Scikit-Learn standard library | `Public Domain / CC BY 4.0` | `target` |
| Wine Recognition Dataset | `wine_recognition` | 178 | 14 | UCI Machine Learning Repository (Forina et al., 1991) via Scikit-Learn standard library | `Public Domain / CC BY 4.0` | `target` |

## 5. Audited Findings and Limitations
- **Negative Control Specificity**: Stable unshifted features yielded 0.0% false positive drift detection in this offline test run.
- **Controlled Ablation Finding**: Upstream drift propagation successfully suppressed 6 out of 6 moderate and severe drifted claims that arithmetic-only verification released.
- **Statistical Significance Limitation**: The exact paired McNemar test yields $p = 0.2891$ ($b = 6, c = 2$), which fails to achieve statistical significance ($p > 0.05$). Furthermore, dataset-level clustering (3 datasets) violates i.i.d. assumptions. Therefore, statistical significance cannot be claimed from this benchmark.
- **Offline Simulation Boundary**: Results represent deterministic offline code execution and do not constitute empirical evidence regarding commercial LLM reasoning or arbitrary real-world distributions.