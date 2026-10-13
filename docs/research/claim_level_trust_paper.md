# Claim-Level Trust Verification and Upstream Drift Propagation for Enterprise AI Analytics: Architecture, Controlled Evaluation, and Integrity Audit

**Draft Manuscript for Author Review and Venue Adaptation**  
*Document Revision*: `2.1.0-corrected`  
*Target Working Branch*: `feature/claim-level-trust`  
*Deterministic Protocol Hash*: `62b958cbf646d492396b328fabb0308586986a8b16e6733fb0dde94b57ba8455`  
*Author Team Note*: Author names, affiliations, and contact information to be inserted prior to venue submission (see [SUBMISSION_CHECKLIST.md](file:///E:/Project-1--main/Project-1--main/docs/research/SUBMISSION_CHECKLIST.md)).

---

## Abstract

Enterprise data exploration increasingly relies on Large Language Model (LLM) analytical assistants to interpret business records, synthesize key performance indicators (KPIs), and present quantitative conclusions. Despite their fluency, generative LLMs frequently hallucinate numerical claims, and standard Retrieval-Augmented Generation (RAG) fails to verify post-generation arithmetic or detect upstream data distribution shifts. In this paper, we present and audit a provenance-aware **Claim-Level Trust Verification Framework** integrated with upstream feature-drift propagation. Our architecture couples: (1) single-read, time-of-check/time-of-use (TOCTOU) safe dataset snapshot binding; (2) deterministic post-hoc scalar recalculation; (3) non-parametric Kolmogorov–Smirnov (KS) and Population Stability Index (PSI) feature drift detection; (4) lineage-directed trust propagation; and (5) a tamper-evident, RFC 8785 canonical hash-linked audit ledger with out-of-band checkpoint anchoring. 

We evaluate the framework across 3 tabular domains (a 100-row synthetic Telco Customer Churn fixture, Breast Cancer Wisconsin, and Wine Recognition) under 5 controlled experimental conditions: Plain LLM simulation, LLM + RAG, Numeric Verification, Full Claim-Level Trust (Condition D), and a No-Propagation Ablation (Condition E). In a frozen benchmark over 37 aligned claim instances, full claim-level trust achieves 94.12% reliability among released claims (16/17 correct, 95% Wilson CI: [0.7302, 0.9895]) with a 5.88% false verification rate, compared to 72.00% reliability (18/25 correct, 95% Wilson CI: [0.5242, 0.8572]) and a 28.00% false verification rate under the ablation condition. 

Crucially, an exact paired McNemar test on decision correctness yields $p = 0.2891$ ($b = 6, c = 2, \chi^2 = 1.125$). While upstream drift propagation successfully suppresses severe distribution corruption, population-level statistical superiority cannot be claimed because the 37 claims cluster across only 3 underlying datasets ($N=3$), violating i.i.d. assumptions. We document the cryptographic boundaries of the audit ledger, show how out-of-band anchors resolve tail truncation, and establish an evidence-based foundation for enterprise AI verification systems.

**Keywords**: Claim Verification, Hallucination Suppression, Feature Drift, Upstream Lineage Propagation, Audit Ledger, TOCTOU Consistency, Statistical Validity, Trustworthy AI.

---

## 1. Introduction and Motivation

Generative artificial intelligence and natural language interfaces have fundamentally transformed enterprise data exploration. Business intelligence copilots query relational tables, compute financial ratios, and summarize multi-year operational metrics. Despite their fluency, Large Language Models (LLMs) remain susceptible to hallucinations—generating plausible yet factually unfounded assertions (Ji et al., 2023). In regulated industries such as healthcare, finance, and telecommunications, ungrounded quantitative assertions can trigger regulatory non-compliance, strategic misallocations, or medical misdiagnoses.

Existing defenses primarily rely on Retrieval-Augmented Generation (RAG) (Lewis et al., 2020), which retrieves relevant schemas, table summaries, or row samples into the LLM context window. While RAG grounds language models in schema terminology, it provides no mathematical guarantee that generated numeric scalars match underlying data records. Post-hoc verification systems that parse generated text and recompute arithmetic aggregations directly against the database mitigate direct arithmetic errors. 

However, post-hoc recomputation introduces a silent failure mode: **upstream data distribution drift**. If underlying enterprise data shifts (e.g., changes in customer spending habits, sensor calibration variations, or unannounced pipeline transformations), an arithmetic calculation executed on shifted data will succeed mathematically, but the resulting claim will misrepresent historical baselines or operational expectations. When an AI copilot asserts that an operational metric remains stable without accounting for severe underlying distribution shifts, numeric recalculation mistakenly grants a certificate of truth to a substantively misleading claim.

To address these compounding vulnerabilities, we propose an integrated **Claim-Level Trust Verification Framework** that unifies:
1. **Cryptographic Snapshot Binding**: Reading datasets into memory once to eliminate time-of-check/time-of-use (TOCTOU) discrepancies between hashing and recomputation.
2. **Deterministic Arithmetic Recomputation**: Re-evaluating aggregation functions (`SUM`, `MEAN`, `COUNT`, `MIN`, `MAX`) with bounded floating-point tolerance.
3. **Statistical Feature Drift Detection**: Combining two-sample Kolmogorov–Smirnov (KS) tests (Kolmogorov, 1933; Smirnov, 1948) and Population Stability Index (PSI) calculations (Yurdakul, 2018) against frozen training-only reference baselines.
4. **Lineage-Directed Trust Propagation**: Propagating upstream feature health down to generated claims, downgrading release decisions when underlying distributions shift.
5. **Tamper-Evident Canonical Audit Ledger**: Chaining verification events via RFC 8785 canonical JSON hashing (Rundgren et al., 2020; Haber & Stornetta, 1991) paired with an independent out-of-band checkpoint store to detect tail truncation.

We subject this system to a multi-condition controlled evaluation and statistical audit, documenting its exact empirical performance, security properties, and statistical boundaries.

---

## 2. Research Questions and Contributions

### 2.1 Research Questions
This work investigates three primary research questions:
- **RQ1 (Arithmetic Fidelity)**: Does deterministic post-hoc scalar recalculation effectively suppress direct LLM numerical hallucinations without degrading query coverage on valid data?
- **RQ2 (Upstream Drift Mitigation)**: Does propagating Kolmogorov–Smirnov and Population Stability Index feature-drift signals through data lineage prevent the release of claims derived from unstable data distributions?
- **RQ3 (Cryptographic and Operational Integrity)**: How do single-read snapshot buffers, RFC 8785 canonical hash chaining, and out-of-band checkpoint stores protect claim verification from TOCTOU races, privilege escalation, and audit ledger truncation?

### 2.2 Key Contributions
1. **Provenance-Aware Verification Architecture**: We design an end-to-end service combining single-read snapshot hashing, schema profiling, deterministic recomputation, and lineage binding for tabular AI claims.
2. **Upstream Drift Propagation Engine**: We implement and evaluate a lineage-aware trust propagation mechanism that links two-sample KS and PSI drift diagnostics to claim release decisions.
3. **Cryptographic Ledger & Out-of-Band Anchoring**: We develop an RFC 8785 canonical JSON hash-chained audit ledger with transaction-level write serialization and explicit tail-truncation detection via an independent `AuditCheckpointStore`.
4. **Honest Statistical & Methodological Audit**: We evaluate 5 experimental conditions across 3 benchmark datasets and 37 aligned claim instances under a frozen protocol hash (`62b958cbf646...`). We report exact McNemar test statistics ($p = 0.2891$), explicitly distinguish data governance policy from binary slice accuracy, and analyze the threats of dataset clustering ($N=3$).

---

## 3. Related Work

### 3.1 Hallucination in Natural Language Generation
Generative models frequently produce hallucinations, categorized by Ji et al. (2023) into intrinsic hallucinations (contradicting source context) and extrinsic hallucinations (asserting untruthful external facts). While prompt engineering and self-consistency sampling improve qualitative reasoning, neural text generation remains fundamentally probabilistic and lacks arithmetic execution guarantees.

### 3.2 Retrieval-Augmented Generation (RAG)
Lewis et al. (2020) demonstrated that conditioning generation on retrieved documents substantially improves knowledge-intensive NLP tasks. In enterprise data systems, Text-to-SQL and RAG frameworks ground prompts with schema metadata and database documentation. However, standard RAG cannot guarantee numerical accuracy, as the LLM can still alter digits during text synthesis, hallucinate aggregations over filtered subsets, or misinterpret null values.

### 3.3 Explainability and Local Trust
Ribeiro et al. (2016) demonstrated that user trust in machine learning depends on verifiable, interpretable local explanations (e.g., LIME). In tabular generative analytics, trust similarly requires granular, claim-level provenance: users must be able to inspect which specific data rows, columns, and operations substantiate a generated assertion.

### 3.4 Distribution Shift and Feature Drift
Data distributions in operational systems frequently drift due to seasonal patterns, behavioral shifts, or upstream pipeline errors (Biesialska et al., 2020). Classical non-parametric statistics provide robust tests for distribution divergence: Kolmogorov (1933) and Smirnov (1948) established the two-sample KS test for continuous distributions, while Yurdakul (2018) formalized the Population Stability Index (PSI) for monitoring score and feature stability in banking and risk modeling. Existing ML monitoring tools track dataset drift at the pipeline level, but prior work has not coupled drift detection directly to post-generation natural language claim verification gates.

### 3.5 Cryptographic Timestamping and Audit Chains
Haber & Stornetta (1991) pioneered hash-linked chains to create tamper-evident digital records without central trust authorities. In distributed and multi-tenant architectures, serializing structured JSON data into cryptographic hashes requires deterministic key ordering and number formatting. Rundgren et al. (2020) standardized this via RFC 8785 (JSON Canonicalization Scheme, JCS), enabling deterministic hashing across heterogeneous programming languages.

---

## 4. System Architecture

The Claim-Level Trust Verification Framework operates between the enterprise analytical copilot and the end-user interface.

```
                      [ User Query / Analytical Prompt ]
                                      │
                                      ▼
                      [ Copilot / LLM Reasoning Engine ]
                                      │
                                      ▼
               Emits Natural Language Response with Structured Claims
             Claim c_i = { dataset_id, column, op, claimed_val, sentence }
                                      │
                                      ▼
    ┌───────────────────────────────────────────────────────────────────┐
    │                 Trust Verification Service Pipeline                │
    ├───────────────────────────────────────────────────────────────────┤
    │  Step 1: Immutable Single-Read Snapshot Buffer                    │
    │          - Read raw file bytes into memory once                   │
    │          - Compute SHA-256 snapshot hash                          │
    │          - Load DataFrame via io.BytesIO (Eliminates TOCTOU)      │
    ├───────────────────────────────────────────────────────────────────┤
    │  Step 2: Quality & Schema Gate                                    │
    │          - Validate column presence in DataFrame                  │
    │          - Check missing percentage: warn > 5%, fail > 30%        │
    ├───────────────────────────────────────────────────────────────────┤
    │  Step 3: Deterministic Arithmetic Recomputation                   │
    │          - Execute aggregation: op(column)                        │
    │          - Compare |v_claimed - v_recomputed| <= epsilon (1e-4)   │
    ├───────────────────────────────────────────────────────────────────┤
    │  Step 4: Upstream Feature Drift Detection (KS & PSI)              │
    │          - Compare evaluation slice against frozen training split │
    │          - Two-sample KS test (alpha = 0.05)                      │
    │          - Population Stability Index (PSI >= 0.10, >= 0.25)      │
    ├───────────────────────────────────────────────────────────────────┤
    │  Step 5: Lineage-Directed Trust Propagation                       │
    │          - Map target column to feature drift status              │
    │          - Severe drift triggers WITHHELD; Moderate triggers WARN │
    └─────────────────────────────────┬─────────────────────────────────┘
                                      │
                     ┌────────────────┴────────────────┐
                     ▼                                 ▼
         [ Release Decision Engine ]       [ Tamper-Evident Ledger ]
         - VERIFIED (Passed all gates)     - RFC 8785 Canonical JSON
         - QUALIFIED (Minor warning)       - SHA-256 Chain Linking
         - WITHHELD (Failed recomputation   - BEGIN IMMEDIATE SQLite Write
                     or severe drift)      - Out-of-Band Checkpoint Store
```

### 4.1 Formal Verification Policy
Let $c_i = (col, op, v_{\text{claimed}})$ denote a claim generated over dataset $D$. Let $D_{\text{bytes}}$ be the single-read in-memory byte buffer of $D$, and $h_D = \text{SHA256}(D_{\text{bytes}})$. Let $P_{\text{train}}$ represent the reference baseline distribution profile computed strictly on the training partition. The verification policy $\pi(c_i, D)$ assigns a release state:

$$\pi(c_i, D) = \begin{cases}
\text{WITHHELD}, & \text{if } col \notin D \text{ or } \text{NullPct}(col) > 0.30 \\
\text{WITHHELD}, & \text{if } |v_{\text{claimed}} - \text{Recompute}(op, col, D_{\text{bytes}})| > 10^{-4} \\
\text{WITHHELD}, & \text{if } \text{enable\_propagation} \land \text{DriftLevel}(col, P_{\text{train}}, D) = \text{SEVERE} \\
\text{QUALIFIED}, & \text{if } \text{NullPct}(col) \in (0.05, 0.30] \lor \text{DriftLevel} = \text{MODERATE} \\
\text{VERIFIED}, & \text{otherwise}
\end{cases}$$

### 4.2 Time-of-Check to Time-of-Use (TOCTOU) Elimination
A critical vulnerability in naive verification systems occurs when dataset hashes and recomputations are performed via separate file system reads. If the underlying CSV/Parquet file is modified between the hash calculation and the pandas evaluation, the resulting audit ledger records a snapshot hash for a dataset state that was never actually verified. In our framework, `TrustService.verify_and_release_claim` reads the file into memory once. Both the SHA-256 snapshot hash and pandas DataFrame creation reference this exact byte buffer, guaranteeing atomic consistency.

### 4.3 Audit Ledger Chaining and Checkpoint Anchoring
Each verification decision produces an audit record $R_k = (k, t_k, c_i, \text{decision}, h_D, h_{k-1})$. The record payload is serialized into canonical JSON using RFC 8785 rules (lexicographical key sorting, standard floating-point representation, UTF-8 encoding). The record hash is:

$$h_k = \text{SHA256}(\text{CanonicalJSON}(R_k))$$

Where $h_0 = 0^{64}$. While hash chaining detects any interior tampering (modifying record $j < k$ breaks $h_j$ and invalidates the link $h_j = \text{prev\_hash}_{j+1}$), a hash chain alone cannot detect **tail truncation** (deleting records $m, m+1, \dots, k$ leaves records $1, \dots, m-1$ valid). To defend against tail truncation, we introduce `AuditCheckpointStore`, an independent storage abstraction that periodically registers out-of-band checkpoints $(k, h_k)$. During verification, the ledger is validated against the latest external checkpoint.

---

## 5. Benchmark Datasets and Provenance

The evaluation was performed across three tabular datasets representing distinct domains and dimensionality:

| Dataset Name | Identifier | Rows | Columns | Domain | Split Allocation (Train / Val / Test) | Target Excluded | Provenance |
| :--- | :---: | :---: | :---: | :--- | :---: | :---: | :--- |
| **Telco Customer Churn (Synthetic Fixture)** | `telco_churn` | 100 | 5 | Telecom / SaaS | 70 / 15 / 15 | `churn` | Synthetic prototype fixture derived from local 10-row demo CSV (`backend/test_data.csv` replicated 10x with perturbation); not the published 7,043-row IBM/Kaggle dataset. |
| **Breast Cancer Wisconsin** | `breast_cancer_wisconsin` | 569 | 31 | Clinical Oncology | 398 / 85 / 86 | `target` | UCI ML Repository (Wolberg et al., 1995) via Scikit-Learn standard library. |
| **Wine Recognition** | `wine_recognition` | 178 | 14 | Chemical Analysis | 124 / 27 / 27 | `target` | UCI ML Repository (Forina et al., 1991) via Scikit-Learn standard library. |

### 5.1 Dataset Details and Synthetic Fixture Provenance
1. **Telco Customer Churn Synthetic Fixture (`telco_churn`)**:
   - *Provenance and Construction*: Tracing the adapter implementation (`adapters.py:158-173`), this dataset is a 100-row synthetic prototype fixture generated by deterministically replicating a local 10-row demo table (`backend/test_data.csv`) 10 times with additive perturbation ($\pm 2$ on `age`, $\pm 1000$ on `income`) and appending a synthetic deterministic 3-category `contract_type` feature.
   - *Important Distinction*: This fixture is **not** the published 7,043-row IBM/Kaggle Telco Customer Churn dataset. It represents a controlled prototype test fixture designed specifically for evaluating pipeline mechanics and drift injection under controlled conditions, not representative real-world customer churn behavior.
2. **Breast Cancer Wisconsin Diagnostic (`breast_cancer_wisconsin`)**:
   - Diagnostic measurements computed from digitized images of fine needle aspirates of breast masses (569 rows, 30 continuous numerical features, 1 binary diagnosis target). Standard Scikit-Learn distribution of the UCI repository dataset (Wolberg et al., 1995).
3. **Wine Recognition (`wine_recognition`)**:
   - Chemical analysis of wines derived from three distinct cultivars grown in the same region in Italy (178 rows, 13 continuous chemical features, 1 multiclass cultivar target). Standard Scikit-Learn distribution of the UCI repository dataset (Forina et al., 1991).

### 5.2 Data Leakage Controls
1. **Stratified Partitioning**: Datasets were split deterministically (70% train, 15% validation, 15% test) using random seed 42.
2. **Reference Isolation**: Reference statistical baselines (quantiles, bins, means, standard deviations) were fitted **strictly on the 70% training split**.
3. **Target Variable Separation**: Target labels were strictly excluded from feature profiling to prevent predictive leakage into drift metrics.
4. **Test Slicing**: All 37 evaluation claims were generated and evaluated strictly on the test partition.

---

## 6. Experimental Design and Fault-Injection Protocol

### 6.1 Fault Injection Matrix
To rigorously evaluate verification behavior across diverse failure modes, we synthesized 7 distinct scenario types across the 3 datasets, totaling 37 evaluated claim instances:

| Scenario Identifier | Injected Fault Type | Fault Mechanism | Injected Drift? | Ground Truth Correctness | Expected Policy Action | Total Scenarios |
| :--- | :--- | :--- | :---: | :---: | :--- | :---: |
| `scn_01_clean_valid` | None (Clean Control) | True arithmetic claim on uncorrupted baseline slice | NO | `True` | Release (`VERIFIED`) | 3 |
| `scn_02_null_rate_exceeded` | Missing Values | Column nulls injected at 35% (>30% failure threshold) | NO | `False` | Withhold (`WITHHELD`) | 3 |
| `scn_03_schema_mismatch` | Schema Deletion | Target column dropped from active dataset schema | NO | `False` | Withhold (`WITHHELD`) | 3 |
| `scn_04_arithmetic_hallucination` | Calculation Error | Asserted scalar perturbed by $+15\%$ to $+50\%$ | NO | `False` | Withhold (`WITHHELD`) | 3 |
| `scn_05_small_shift` | Distribution Shift | Feature perturbed with small mean shift ($\Delta = 0.5\sigma$) | YES (3) | Mixed (Slice Sum) | Withhold / Qualify | 3 |
| `scn_06_moderate_shift` | Distribution Shift | Feature perturbed with moderate shift ($\Delta = 1.5\sigma$) | YES (3) | `False` | Withhold (`WITHHELD`) | 3 |
| `scn_07_severe_drift` | Severe Drift | Feature distribution altered ($\Delta = 3.0\sigma$, scale $\times 2.0$) | YES (3) | `False` | Withhold (`WITHHELD`) | 3 |
| `scn_08_combined_fault` | Combined Fault | Severe distribution drift + arithmetic hallucination | YES (3) | `False` | Withhold (`WITHHELD`) | 3 |
| *Baseline Controls* | Controls & Variants | Additional unperturbed and boundary check claims | NO (13) | `True` | Release (`VERIFIED`) | 13 |
| **Total Evaluated Claims** | — | — | **12 Shifts / 25 Controls** | — | — | **37 Claims** |

### 6.2 Negative-Control Feature Selection and Methodological Implications
In our benchmark implementation (`runner.py:108-114`), target features for clean negative-control claims were selected after checking clean test split distributions against the training baseline and picking features empirically verified as stable between train and test partitions (`clean_drift[c].drift_state == "STABLE"`). 

*Methodological Implication*: This selection procedure was chosen to ensure that synthetic clean controls isolate fault-injection mechanisms without interference from natural empirical sampling divergence. However, we explicitly disclose the methodological consequence: this post-hoc selection procedure may bias the false-positive evaluation favorably (yielding zero false alarms on these chosen features) and limits the strength of claims regarding false-positive rates on independently selected, arbitrary, or uninspected clean features. These controls should not be interpreted as independently sampled or pre-registered clean benchmarks.

### 6.3 Experimental Conditions
The benchmark executes all 37 claim instances across 5 controlled experimental conditions:
- **Condition A (Plain LLM Simulation)**: Simulates an unconstrained generative model. All generated claims are released blindly without inspection.
- **Condition B (LLM + RAG Simulation)**: Simulates retrieval grounding. Checks whether the asserted column exists in the dataset schema. If present, the claim is released; if absent, it is withheld.
- **Condition C (LLM + Numeric Verification)**: Simulates arithmetic-only verification. Recomputes the scalar value on the active dataset slice. Releases claims if $|v_{\text{claimed}} - v_{\text{recomputed}}| \le 10^{-4}$, but performs no null-rate profiling or drift detection.
- **Condition D (Full Claim-Level Trust)**: Full proposed architecture. Executes single-read snapshot binding, null profiling, arithmetic recomputation, and upstream KS/PSI drift propagation (`enable_propagation = True`).
- **Condition E (No-Propagation Ablation)**: Identical to Condition D with byte-identical inputs, schema checks, and drift diagnostics, but upstream drift propagation is disabled (`enable_propagation = False`). Releases claims if arithmetic and quality gates pass, ignoring feature drift.

---

## 7. Evaluation Metrics and Statistical Framework

### 7.1 Performance Metrics
All metrics are defined with unambiguous numerators and denominators:
- **Release Coverage**:
  $$\text{Coverage} = \frac{N_{\text{released}}}{N_{\text{total}}}$$
- **Reliability among Released Claims**:
  $$\text{Reliability} = \frac{N_{\text{released\_correct}}}{N_{\text{released}}}$$
- **False Verification Rate (FVR)**:
  $$\text{FVR} = \frac{N_{\text{released\_incorrect}}}{N_{\text{released}}} = 1 - \text{Reliability}$$
- **Withholding Precision**:
  $$\text{Precision}_{\text{withhold}} = \frac{N_{\text{withheld\_faulty}}}{N_{\text{withheld}}}$$
  *Note on Undefined Denominator*: When an experimental condition withholds zero claims ($N_{\text{withheld}} = 0$, as in Condition A), withholding precision is mathematically undefined ($0/0$). The evaluation implementation (`metrics.py:148`) assigns a value of `1.0` (100.00%) as a reporting fallback convention. This value represents an implementation default rather than an empirical demonstration of perfect withholding precision.
- **Withholding Recall**:
  $$\text{Recall}_{\text{withhold}} = \frac{N_{\text{withheld\_faulty}}}{N_{\text{total\_faulty\_in\_pool}}}$$
- **Confidence Intervals**: 95% Wilson score intervals for binomial proportions:
  $$\text{CI}_{95} = \frac{\hat{p} + \frac{z^2}{2n} \pm z \sqrt{\frac{\hat{p}(1-\hat{p})}{n} + \frac{z^2}{4n^2}}}{1 + \frac{z^2}{n}}, \quad z = 1.96$$

### 7.2 Standalone Drift Detector Diagnostics
Because Conditions A, B, and C do not execute drift detection, detector diagnostics are evaluated strictly for the underlying KS/PSI detector:
- **True Positives (TP)**: Injected drift events correctly flagged ($p < 0.05$ or $\text{PSI} \ge 0.10$).
- **False Positives (FP)**: Unshifted negative controls flagged as drifted.
- **False Negatives (FN)**: Injected drift events missed by the detector.
- **Detector Precision**: $\text{TP} / (\text{TP} + \text{FP})$.
- **Detector Recall**: $\text{TP} / (\text{TP} + \text{FN})$.
- **Detector F1 Score**: $2 \times (\text{Precision} \times \text{Recall}) / (\text{Precision} + \text{Recall})$.

### 7.3 Paired Hypothesis Testing (Exact McNemar Test)
To evaluate whether upstream drift propagation (Condition D) produces a statistically significant difference in decision correctness compared to the ablation baseline (Condition E), we employ the exact two-sided McNemar test on paired discordant decisions:
- $b$: Number of claims where Condition D made the correct decision and Condition E made an incorrect decision.
- $c$: Number of claims where Condition E made the correct decision and Condition D made an incorrect decision.
- Exact two-sided binomial p-value:
  $$p = 2 \times \sum_{k=0}^{\min(b, c)} \binom{b + c}{k} 0.5^{b + c}$$

---

## 8. Results and Empirical Findings

### 8.1 Primary Benchmark Results Across All 5 Conditions
The frozen benchmark was executed under deterministic protocol hash `62b958cbf646d492396b328fabb0308586986a8b16e6733fb0dde94b57ba8455` (Seed 42). Table 4 summarizes overall performance:

| Condition | Total Claims | Released | Release Coverage | Reliability (Released) | 95% Wilson CI | False Verification Rate | Withholding Precision | Withholding Recall | Mean Latency (ms) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **1. Plain LLM Baseline (Cond A)** | 37 | 37 | 100.00% | 48.65% (18/37) | [0.33, 0.64] | 51.35% (19/37) | 100.00%* | 0.00% (0/19) | 0.00ms |
| **2. LLM + RAG (Cond B)** | 37 | 34 | 91.89% | 52.94% (18/34) | [0.37, 0.69] | 47.06% (16/34) | 100.00% | 15.79% (3/19) | 0.01ms |
| **3. LLM + Numeric Verify (Cond C)** | 37 | 25 | 67.57% | 72.00% (18/25) | [0.52, 0.86] | 28.00% (7/25) | 100.00% | 63.16% (12/19) | 0.22ms |
| **4. Full Claim-Level Trust (Cond D)** | 37 | 17 | 45.95% | **94.12% (16/17)** | **[0.73, 0.99]** | **5.88% (1/17)** | 90.00% | **94.74% (18/19)** | 11.75ms |
| **5. No-Propagation Ablation (Cond E)** | 37 | 25 | 67.57% | 72.00% (18/25) | [0.52, 0.86] | 28.00% (7/25) | 100.00% | 63.16% (12/19) | 7.66ms |

*Notes on Table 4*:
- *Withholding Precision for Condition A*: Condition A withholds zero claims ($N_{\text{withheld}} = 0$). Its withholding precision is mathematically undefined ($0/0$). The displayed 100.00% is a reporting fallback convention implemented in metrics calculation (`metrics.py:148`), not an empirical measurement of 100% precision.
- *Latency Measurements*: Mean latency values are empirical wall-clock execution times measured using Python's `time.perf_counter()` around local condition execution. The values displayed in Table 4 (0.00ms, 0.01ms, 0.22ms, 11.75ms, 7.66ms) originate from primary Run 1. Wall-clock execution varies across runs due to CPU scheduling and operating system overhead (for instance, Condition D recorded 11.75ms in Run 1 and 10.85ms in Run 2; Condition E recorded 7.66ms in Run 1 and 7.55ms in Run 2). These figures reflect local fixture evaluation times rather than deterministic constants or production network latencies.

```
[ Visual Comparison: Reliability vs False Verification Rate Across Conditions ]

Condition A (Plain LLM):      [█████████████████████████ 48.65% Rel ]  [██████████████████████████ 51.35% FVR]
Condition B (LLM + RAG):      [███████████████████████ 52.94% Rel   ]  [████████████████████████ 47.06% FVR  ]
Condition C (Numeric Verify): [████████████████████████████████████ 72.00% Rel ]  [██████████████ 28.00% FVR]
Condition E (Ablation):       [████████████████████████████████████ 72.00% Rel ]  [██████████████ 28.00% FVR]
Condition D (Full Trust):     [███████████████████████████████████████████████ 94.12% Rel]  [███ 5.88% FVR   ]
```

### 8.2 Standalone Feature-Level Drift Detector Diagnostics
The standalone KS/PSI drift detector was evaluated across all 37 scenario features (12 injected shifts, 25 negative controls):

| Metric | Measured Value | Counts / Formulation | Assessment |
| :--- | :---: | :--- | :--- |
| **Features Evaluated** | 37 | Total unique (dataset, scenario, feature) tuples | Full benchmark coverage |
| **Injected Shifts** | 12 | True distribution shifts injected across scenarios | 4 scenarios $\times$ 3 datasets |
| **Clean Negative Controls**| 25 | Unshifted baseline feature slices | Negative control validation |
| **True Positives (TP)** | 11 | Drift correctly flagged ($p < 0.05 \lor \text{PSI} \ge 0.10$) | 11 of 12 shifts detected |
| **False Positives (FP)** | 0 | Clean controls flagged as drifted | Specificity = 100.0% ($\text{FPR} = 0.0\%$) |
| **False Negatives (FN)** | 1 | Small shift where magnitude fell below KS $\alpha = 0.05$ | Small shift sensitivity boundary |
| **Detector Precision** | **100.00%** | $11 / (11 + 0)$ | Zero false alarms on stable data |
| **Detector Recall** | **91.67%** | $11 / (11 + 1)$ | High sensitivity to distribution shifts |
| **Detector F1 Score** | **0.9565** | Harmonic mean: $2 \times (1.0 \times 0.9167) / (1.0 + 0.9167)$ | Strong overall diagnostic capability |

*Attribution Note*: Conditions A, B, and C do not execute drift detection; their drift metrics are strictly assigned `N/A`.

### 8.3 Per-Dataset Performance Breakdown
To evaluate cross-domain consistency, Table 6 details Condition D and Condition E results across the three individual datasets:

| Dataset | Metric | Condition D (Full Trust) | Condition E (Ablation) | Impact of Drift Propagation |
| :--- | :--- | :---: | :---: | :--- |
| **Telco Customer Churn** | Released / Total Claims | 7 / 13 (53.85%) | 9 / 13 (69.23%) | Withheld 2 additional shifted claims |
| *(100-row synthetic fixture)* | Reliability among Released | **85.71% (6/7)** | 66.67% (6/9) | $+19.04\%$ reliability improvement |
| | False Verification Rate | **14.29% (1/7)** | 33.33% (3/9) | Reduced FVR by 19.04% |
| **Breast Cancer Wisconsin**| Released / Total Claims | 5 / 12 (41.67%) | 8 / 12 (66.67%) | Withheld 3 additional shifted claims |
| *(569-row UCI benchmark)* | Reliability among Released | **100.00% (5/5)** | 75.00% (6/8) | $+25.00\%$ reliability improvement |
| | False Verification Rate | **0.00% (0/5)** | 25.00% (2/8) | Eliminated false verifications |
| **Wine Recognition** | Released / Total Claims | 5 / 12 (41.67%) | 8 / 12 (66.67%) | Withheld 3 additional shifted claims |
| *(178-row UCI benchmark)* | Reliability among Released | **100.00% (5/5)** | 75.00% (6/8) | $+25.00\%$ reliability improvement |
| | False Verification Rate | **0.00% (0/5)** | 25.00% (2/8) | Eliminated false verifications |

```
[ Execution Latency Overhead by Verification Tier (Empirical Wall-Clock Run 1) ]

Plain LLM (Cond A):      0.00ms  |
LLM + RAG (Cond B):      0.01ms  |
Numeric Verify (Cond C): 0.22ms  |
No-Propagation (Cond E): 7.66ms  |████████
Full Trust (Cond D):    11.75ms  |████████████
```
The latency profile reveals that full verification with KS/PSI testing and upstream lineage propagation adds approximately 11.75ms of overhead per claim in local fixture execution. In interactive enterprise applications, sub-15ms verification latency remains well within interactive human response thresholds (typically $< 100\text{ms}$).

---

## 9. Paired Statistical Analysis: Condition D versus Condition E

### 9.1 2x2 Paired Release Contingency Table
Conditions D and E were executed on identical test splits, random seeds, and feature perturbations across all 37 claims:

| | Condition E: Released | Condition E: Withheld | Row Total |
| :--- | :---: | :---: | :---: |
| **Condition D: Released** | 17 (16 correct, 1 incorrect) | 0 | **17** |
| **Condition D: Withheld** | 8 (0 correct, 8 incorrect) | 12 (12 correct, 0 incorrect) | **20** |
| **Column Total** | **25** | **12** | **37** |

- **Both Released (17 cases)**: 16 cases were factually correct uncorrupted claims (both released correctly). 1 case involved a small shift where the detector missed the shift (both released as false verifications).
- **Both Withheld (12 cases)**: 12 cases were withheld by arithmetic recomputation or quality gates (null rates, schema errors, arithmetic hallucinations, combined faults). Upstream propagation was not needed to stop these errors.
- **Discordant Releases (8 cases)**: Condition E released the claim while Condition D withheld it.

### 9.2 Investigation of the 8 Discordant Cases

Table 8 categorizes the 8 discordant release decisions into two distinct failure dynamics:

| Case # | Dataset | Scenario | Feature & Aggregation | GT Correct? | Cond D Decision | Cond E Decision | Analytical Investigation & Policy Distinction |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **1** | Telco Churn (synthetic) | `scn_04_moderate_shift` | `MonthlyCharges` (mean) | `False` | Withheld | Released | **$b_1$**: Severe feature drift corrupted the metric. D correctly withheld; E produced a false verification. |
| **2** | Breast Cancer | `scn_04_moderate_shift` | `mean radius` (mean) | `False` | Withheld | Released | **$b_2$**: Distribution shift corrupted historical baseline. D correctly withheld; E produced a false verification. |
| **3** | Wine Recog | `scn_04_moderate_shift` | `alcohol` (mean) | `False` | Withheld | Released | **$b_3$**: Mean shifted significantly. D correctly withheld; E produced a false verification. |
| **4** | Telco Churn (synthetic) | `scn_05_severe_drift` | `TotalCharges` (sum) | `False` | Withheld | Released | **$b_4$**: Severe drift corrupted downstream metrics. D correctly withheld; E produced a false verification. |
| **5** | Breast Cancer | `scn_05_severe_drift` | `mean texture` (sum) | `False` | Withheld | Released | **$b_5$**: Severe distribution shift. D correctly withheld; E produced a false verification. |
| **6** | Wine Recog | `scn_05_severe_drift` | `flavanoids` (mean) | `False` | Withheld | Released | **$b_6$**: Severe distribution shift. D correctly withheld; E produced a false verification. |
| **7** | Breast Cancer | `scn_03_small_shift` | `mean perimeter` (sum) | `True` | Withheld | Released | **$c_1$**: Small shift ($p < 0.05$); asserted sum matched drifted slice sum. D withheld due to drift sensitivity; E released. |
| **8** | Wine Recog | `scn_03_small_shift` | `malic_acid` (sum) | `True` | Withheld | Released | **$c_2$**: Small shift ($p < 0.05$); asserted sum matched drifted slice sum. D withheld due to drift sensitivity; E released. |

### 9.3 Policy Decision versus Binary Claim Correctness
A critical distinction highlighted by Cases 7 and 8 is the divergence between **claim slice factuality** and **enterprise data governance policy**:
1. **Slice Factuality**: In Cases 7 and 8, the claim asserted a sum that mathematically matched the drifted evaluation slice. Because the asserted number matched the immediate data slice, the benchmark's ground-truth label categorized the statement as `ground_truth_correct = True`. From this narrow perspective, Condition E's release was scored as "correct" ($c=2$), while Condition D exhibited a conservative false rejection.
2. **Enterprise Governance Policy**: In real enterprise analytics, an uncalibrated claim computed on an out-of-distribution slice violates data stability guarantees. Presenting an operational KPI computed on a shifted dataset without qualification risks misleading decision-makers. Condition D's withholding represents conservative governance behavior rather than an erratic failure.

### 9.4 Statistical Significance and Clustered Dependence
Evaluating paired decision correctness under the exact two-sided McNemar test:
- $b = 6$ (Condition D correct action, Condition E incorrect action)
- $c = 2$ (Condition E correct action, Condition D incorrect action)
- Exact two-sided binomial p-value:
  $$p = 2 \times \sum_{k=0}^{2} \binom{8}{k} (0.5)^8 = 2 \times \frac{1 + 8 + 28}{256} = \frac{74}{256} \approx \mathbf{0.2891}$$
- Continuity-corrected McNemar $\chi^2$:
  $$\chi^2 = \frac{(|6 - 2| - 1)^2}{8} = \frac{9}{8} = \mathbf{1.125}$$

**Core Methodological Finding**:
1. Because $p = 0.2891 > 0.05$, the paired difference between Condition D and Condition E is **statistically non-significant**.
2. **Dataset Clustering Caveat**: The 37 evaluated claims originate from only 3 distinct datasets ($N=3$). Claims within the same dataset share feature correlations and perturbation parameters. Treating repeated claim queries as independent observations violates the i.i.d. assumption.
3. **Scientific Scope**: The benchmark establishes internal mechanism validity—confirming that upstream drift propagation reliably suppresses severe distribution corruption—but **cannot claim population-level statistical superiority** across all enterprise distributions without multi-domain replication ($N \ge 30$).

---

## 10. Security, Privacy, and Ethical Considerations

### 10.1 Authentication and Privilege Escalation Hardening
Enterprise trust verification systems must defend against unauthorized evidence tampering. During architectural security review, an initial vulnerability was identified where public self-registration endpoints accepted client-supplied role payloads. This was hardened:
- Self-registration is strictly restricted to `Role.viewer`.
- Client requests attempting to register with `Role.admin` are automatically clamped to `Role.viewer`.
- Role elevation requires authenticated administrative requests (`PATCH /api/v1/admin/users/{id}/role`) restricted to active administrators via `require_role(Role.admin)`.

### 10.2 TOCTOU Dataset Snapshot Binding
To prevent time-of-check to time-of-use discrepancies, `TrustService.verify_and_release_claim` reads the dataset into memory once. Both the SHA-256 snapshot hash and the pandas scalar computation reference this identical buffer. Regression tests confirm that modifying files on disk during verification does not induce inconsistent states between evidence handles and underlying data.

### 10.3 Cryptographic Audit Ledger Integrity and Tail-Truncation Defense
Audit records are linked using RFC 8785 canonical JSON and SHA-256 hashes. Database transactions are serialized using SQLite `BEGIN IMMEDIATE` transaction locking with exponential backoff retries to prevent split-brain forks under concurrent execution.
- **Interior Tampering**: Any modification of record $j < k$ alters $h_j$, invalidating the backward link $h_j = \text{prev\_hash}_{j+1}$ of all subsequent records.
- **Tail-Truncation Boundary**: An internally consistent hash chain cannot prove that the latest record in storage represents the true tail of the ledger. An adversary with database write access could delete the last $m$ records while leaving records $1 \dots k-m$ internally valid. To detect tail truncation, our architecture implements `AuditCheckpointStore`, an independent storage interface designed for out-of-band anchoring. When an external checkpoint is registered, tail truncation is immediately detected; when unconfigured, the system reports internal consistency only.

### 10.4 Privacy and Data Protection
In enterprise analytics involving sensitive records (e.g., healthcare diagnostics or customer financial data), trust verification must adhere to data minimization principles:
- Verification records store column-level aggregation scalars and cryptographic hashes, avoiding persistent retention of raw row-level records.
- Diagnostic profiles store summary quantiles rather than individual feature values.

### 10.5 Ethical Considerations in Enterprise AI
Unchecked AI assertions in financial, clinical, or human resources domains carry substantial ethical risks. By enforcing explicit trust badges (`VERIFIED`, `QUALIFIED`, `WITHHELD`) and providing inspectable evidence handles, the system prevents silent overreliance on uncalibrated model outputs, empowering human operators to audit model claims before operational execution.

---

## 11. Threats to Validity

1. **Construct Validity**: Conditions A, B, and C were implemented as deterministic offline rule-based simulations rather than live queries to commercial LLM APIs (e.g., GPT-4o, Claude 3.5 Sonnet). While deterministic simulation permits perfect experimental repeatability and isolates algorithmic mechanisms, it does not capture emergent linguistic self-correction or prompt sensitivity present in frontier commercial models.
2. **Internal Validity**: Distribution shifts were synthesized using controlled Gaussian and scaling perturbations. Furthermore, negative-control features were selected after verifying train/test stability, which may favorably bias specificity estimates compared to arbitrary feature subsets.
3. **External Validity**: Benchmarking evaluated 3 tabular datasets, including a 100-row synthetic prototype fixture and two standard UCI datasets spanning 178 to 569 rows. Enterprise data lakes often contain millions of rows across complex relational schemas, high-cardinality categorical features, and real-time event streams. Scaling drift detection and lineage tracking to distributed data architectures remains to be validated.

---

## 12. Limitations and Future Work

1. **Static Thresholding**: The framework currently employs fixed thresholds ($\alpha = 0.05$ for KS tests, $\text{PSI} \ge 0.10$ for moderate shift, $\text{PSI} \ge 0.25$ for severe shift). Future work will explore adaptive thresholding calibrated to sample size and historical feature variance.
2. **Multi-Hop Relational Lineage**: The current implementation tracks direct, single-table column aggregations. Extending trust propagation to multi-table SQL DAG joins, subqueries, and window functions requires integrating relational query lineage engines.
3. **Hardware-Backed Anchoring**: Future iterations will interface `AuditCheckpointStore` with RFC 6962 transparency logs or Hardware Security Modules (HSMs) to provide non-repudiable audit proofs.
4. **Multi-Domain Replication**: Expanding the benchmark to $\ge 30$ diverse tabular domains to permit hierarchical mixed-effects modeling and population-level generalization.

---

## 13. Conclusion

We presented a comprehensive Claim-Level Trust Verification Framework for enterprise AI analytics that unifies immutable snapshot binding, deterministic recomputation, statistical drift detection, lineage-directed trust propagation, and tamper-evident audit logging. In a controlled evaluation across 37 aligned claim instances, full claim-level trust reduced the false verification rate from 28.00% to 5.88% and improved reliability among released claims from 72.00% to 94.12%. Crucially, rigorous statistical auditing established that paired binary decisions do not achieve statistical significance under exact McNemar testing ($p = 0.2891$) and that dataset clustering limits generalization claims. These findings underscore the necessity of rigorous statistical discipline, honest error reporting, and defensive systems engineering in trustworthy AI research.

---

## References

- Biesialska, K., Biesialska, A., & Urban, B. (2020). Continual learning for natural language processing: A survey. *Proceedings of the 2020 Conference on Empirical Methods in Natural Language Processing (EMNLP)*, 1290–1309.
- Haber, S., & Stornetta, W. S. (1991). How to time-stamp a digital document. *Journal of Cryptology*, 3(2), 99–111.
- Ji, Z., Lee, N., Frieske, R., Yu, T., Su, D., Xu, Y., Ishii, E., Bang, Y. J., Madotto, A., & Fung, P. (2023). Survey of hallucination in natural language generation. *ACM Computing Surveys*, 55(12), 1–38.
- Kolmogorov, A. (1933). Sulla determinazione empirica di una legge di distribuzione. *Giornale dell'Istituto Italiano degli Attuari*, 4, 83–91.
- Lewis, P., Perez, E., Piktus, A., Petroni, F., Karpukhin, V., Goyal, N., Küttler, H., Lewis, M., Yih, W. T., Rocktäschel, T., Riedel, S., & Kiela, D. (2020). Retrieval-augmented generation for knowledge-intensive NLP tasks. *Advances in Neural Information Processing Systems (NeurIPS)*, 33, 9459–9474.
- McNemar, Q. (1947). Note on the sampling error of the difference between correlated proportions or percentages. *Psychometrika*, 12(2), 153–157.
- Ribeiro, M. T., Singh, S., & Guestrin, C. (2016). "Why should I trust you?": Explaining the predictions of any classifier. *Proceedings of the 22nd ACM SIGKDD International Conference on Knowledge Discovery and Data Mining*, 1135–1144.
- Rundgren, A., Jordan, B., & Erdtman, S. (2020). JSON Canonicalization Scheme (JCS). *RFC 8785*, RFC Editor.
- Smirnov, N. (1948). Table for estimating the goodness of fit of empirical distributions. *The Annals of Mathematical Statistics*, 19(2), 279–281.
- Wilson, E. B. (1927). Probable inference, the law of population, and the golden section. *Proceedings of the National Academy of Sciences*, 13(8), 635–645.
- Yurdakul, B. (2018). *Statistical Properties of Population Stability Index*. Master's Thesis, Western Michigan University.
