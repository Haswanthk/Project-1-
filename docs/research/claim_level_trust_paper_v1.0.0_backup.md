# Claim-Level Trust Verification and Upstream Drift Propagation for Enterprise AI Analytics: Architecture, Controlled Evaluation, and Integrity Audit

**Draft Manuscript for Author Review and Experimental Documentation**  
*Document Revision*: `1.0.0-audited`  
*Target Working Branch*: `feature/claim-level-trust`  
*Protocol Hash*: `62b958cbf646d492396b328fabb0308586986a8b16e6733fb0dde94b57ba8455`

---

## Abstract

Enterprise applications increasingly rely on Large Language Model (LLM) analytical assistants to interpret business data, summarize key performance indicators (KPIs), and present quantitative conclusions. However, generative LLMs frequently hallucinate numerical claims, and standard Retrieval-Augmented Generation (RAG) fails to verify post-generation arithmetic or detect upstream data distribution shifts. In this paper, we propose and evaluate a provenance-aware **Claim-Level Trust Verification Framework** integrated with upstream feature-drift propagation. Our framework implements: (1) single-read, time-of-check/time-of-use (TOCTOU) safe dataset snapshot binding; (2) deterministic post-hoc scalar recalculation; (3) Kolmogorov–Smirnov (KS) and Population Stability Index (PSI) feature drift detection; (4) lineage-directed trust propagation; and (5) a tamper-evident, RFC 8785 canonical hash-linked audit ledger with out-of-band checkpoint anchoring. We evaluate the architecture using a frozen, multi-dataset benchmark spanning 3 tabular domains across 5 controlled experimental conditions: Plain LLM simulation, LLM + RAG, Numeric Verification, Full Claim-Level Trust (Condition D), and No-Propagation Ablation (Condition E). In a controlled ablation over 37 aligned claim instances, full claim-level trust achieves 94.12% reliability among released claims (95% CI: [0.73, 0.99]) with a 5.88% false verification rate, compared to 72.00% reliability (95% CI: [0.52, 0.86]) and a 28.00% false verification rate under the ablation condition. However, a paired exact McNemar test on decision correctness yields $p = 0.2891$ ($b = 6, c = 2$), demonstrating that while upstream drift propagation successfully suppresses severe distribution corruption, population-level statistical significance cannot be claimed due to dataset clustering ($N=3$). We document the security, cryptographic, and statistical boundaries of the system, presenting a defensible, reproducible foundation for enterprise verification systems.

**Keywords**: Claim Verification, Hallucination Suppression, Feature Drift, Upstream Propagation, Audit Ledger, TOCTOU Consistency, Statistical Validity.

---

## 1. Introduction

Generative artificial intelligence and natural language interfaces have transformed enterprise data exploration. Enterprise copilots synthesize tabular datasets, compute growth trajectories, and answer natural language inquiries. Despite their fluency, LLMs remain susceptible to hallucinations—generating plausible yet factually incorrect assertions (Ji et al., 2023). In financial, medical, and operational analytics, unverified claims introduce severe business and legal risks.

Prior defenses predominantly leverage Retrieval-Augmented Generation (RAG) (Lewis et al., 2020), which injects relevant schemas and context into prompts. While RAG grounds model vocabulary, it provides no mathematical guarantee that generated numerical scalars match underlying data. Post-hoc verification methods that recompute arithmetic calculations solve direct arithmetic hallucinations. However, they remain vulnerable to upstream silent data degradation: if the underlying data distribution has drifted or undergone unannounced schema corruption, an arithmetic recalculation may succeed on corrupt data, releasing a misleading claim as factually verified.

To resolve these challenges, we design and audit a comprehensive **Claim-Level Trust Framework** that pairs post-hoc scalar recomputation with statistical feature-drift detection (Kolmogorov, 1933; Smirnov, 1948) and lineage-aware upstream trust propagation. Furthermore, we audit the system's operational security, addressing time-of-check/time-of-use (TOCTOU) dataset races, role-based access control, and hash chain audit integrity.

---

## 2. Research Problem and Contributions

### 2.1 Problem Formulation
Let $D$ denote an underlying enterprise dataset, $f$ a query or prompt, and $C = \{c_1, c_2, \dots, c_m\}$ a set of quantitative claims emitted by an AI system. Each claim $c_i$ specifies an asserted scalar value $v_{\text{claimed}}$, a target column $col$, an aggregation operation $op \in \{\text{SUM}, \text{MEAN}, \text{COUNT}, \text{MIN}, \text{MAX}\}$, and a natural language sentence. The objective is to construct a policy function $\pi(c_i, D) \to \{\text{VERIFIED}, \text{QUALIFIED}, \text{WITHHELD}\}$ such that:
1. False arithmetic claims are withheld ($\text{False Verification Rate} \to 0$).
2. Claims derived from distributionally drifted upstream features are flagged or suppressed.
3. Every verification decision is permanently bound to an immutable dataset snapshot and cryptographically audited.

### 2.2 Key Contributions
1. **Provenance-Aware Verification Pipeline**: An end-to-end service coupling deterministic scalar recalculation with data profiling and upstream lineage binding.
2. **Upstream Drift Propagation**: Integration of non-parametric Kolmogorov–Smirnov (KS) testing and Population Stability Index (PSI) drift detection with claim lineage, preventing verification of claims rooted in shifted data.
3. **Cryptographic Ledger & Out-of-Band Checkpoint**: An RFC 8785 canonical JSON hash-chained audit ledger with transaction-level write serialization and explicit tail-truncation detection via an independent checkpoint abstraction.
4. **Rigorous Offline Evaluation & Honest Statistical Audit**: Evaluation across 3 datasets and 5 experimental conditions, accompanied by an exact paired McNemar test, explicit dataset clustering caveats, and corrected metric attribution.

---

## 3. Related Work

- **Hallucination in LLMs**: Ji et al. (2023) categorize hallucinations into factual fabrication and reasoning inconsistencies. While prompt engineering and chain-of-thought reduce error frequency, deterministic mathematical operations remain outside probabilistic LLM guarantees.
- **Retrieval-Augmented Generation**: Lewis et al. (2020) demonstrated that conditioning generation on retrieved documents improves factual accuracy. However, RAG cannot guarantee numerical arithmetic fidelity over tabular columns.
- **Distribution Shift Detection**: Data drift detection monitors input features for temporal variation. Kolmogorov (1933) and Smirnov (1948) established the two-sample KS test for continuous distributions. Yurdakul (2018) formalized the Population Stability Index (PSI) for monitoring credit and operational score drift.
- **Cryptographic Audit Chains**: Haber & Stornetta (1991) introduced hash-linked sequences for digital timestamps. Rundgren et al. (2020) standardized deterministic serialization via RFC 8785 (JSON Canonicalization Scheme), enabling stable hash generation across heterogeneous environments.

---

## 4. System Architecture

The architecture consists of four tightly integrated subsystems:

```
[ Natural Language Query ]
            │
            ▼
[ Copilot / LLM Engine ] ──► Emits Claim: { target_dataset_id, column, op, claimed_val }
                                   │
                                   ▼
             ┌───────────────────────────────────────────┐
             │       Trust Verification Service          │
             ├───────────────────────────────────────────┤
             │ 1. Immutable Single-Read Snapshot (TOCTOU)│
             │ 2. Deterministic Arithmetic Recomputation │
             │ 3. Data Quality & Null-Rate Profiling     │
             │ 4. KS / PSI Feature Drift Detection       │
             │ 5. Lineage-Directed Trust Propagation     │
             └─────────────────────┬─────────────────────┘
                                   │
                     ┌─────────────┴─────────────┐
                     ▼                           ▼
          [ Release Decision ]         [ Tamper-Evident Ledger ]
          - VERIFIED                   - RFC 8785 Canonical Hash
          - QUALIFIED                  - SQLite Write Serialization
          - WITHHELD                   - Out-of-Band Checkpoint Anchor
```

1. **Snapshot Single-Read (TOCTOU Safe)**: To eliminate time-of-check/time-of-use races, `TrustService` reads dataset bytes into an immutable in-memory buffer once. The SHA-256 hash is computed from this buffer, and pandas parses the identical buffer via `io.BytesIO`.
2. **Deterministic Recomputation**: Aggregation operations (`SUM`, `MEAN`, `COUNT`, `MIN`, `MAX`) are executed strictly on coerced numeric series. Discrepancies exceeding absolute tolerance $\epsilon = 10^{-4}$ yield an arithmetic mismatch.
3. **Drift Detection & Upstream Propagation**: Evaluates current evaluation slices against a training-only reference baseline. Detected severe drift ($p < 0.05, \text{PSI} \ge 0.25$) on bound lineage features propagates to downgrade release decisions.
4. **Audit Ledger & Checkpoint Anchoring**: Every verification decision is hashed using RFC 8785 canonical serialization and appended using `BEGIN IMMEDIATE` transaction locking. An independent `AuditCheckpointStore` maintains out-of-band sequence anchors to detect tail truncation.

---

## 5. Methodology and Experimental Setup

### 5.1 Dataset Provenance and Leakage Controls
Three distinct benchmark datasets were evaluated:
1. `telco_churn`: 100 rows, 5 columns. Customer demographic and retention platform test fixture. Target: `churn`.
2. `breast_cancer_wisconsin`: 569 rows, 31 columns. Diagnostic measurements from UCI ML repository. Target: `target`.
3. `wine_recognition`: 178 rows, 14 columns. Cultivar chemical analysis from UCI ML repository. Target: `target`.

**Leakage Controls**:
- Train/Validation/Test split: 70% / 15% / 15% with deterministic stratification.
- Reference baselines are fitted **exclusively on the 70% training split**.
- Target variables are strictly excluded from numerical feature profiling.
- Test evaluation data is strictly isolated from reference baseline calculation.

### 5.2 Experimental Conditions
- **Condition A (Plain LLM Simulation)**: Baseline model emitting ungrounded claims released blindly without verification gates.
- **Condition B (LLM + RAG Simulation)**: Schema-aware baseline checking column presence; releases claims if columns exist in schema without post-hoc numeric calculation.
- **Condition C (LLM + Numeric Verification)**: Independently recomputes arithmetic; suppresses calculation errors but ignores lineage, null rates, and distribution drift.
- **Condition D (Full Claim-Level Trust)**: Full pipeline integrating arithmetic recomputation, quality gates, and upstream drift propagation (`enable_propagation = True`).
- **Condition E (No-Propagation Ablation)**: Identical to Condition D with byte-identical inputs and drift maps, but upstream drift propagation is disabled (`enable_propagation = False`).

---

## 6. Evaluation Metrics

Metrics are defined with explicit numerators and denominators:
- **Release Coverage**: Released Claims / Scorable Claims ($N_{\text{released}} / N_{\text{scorable}}$).
- **Reliability among Released**: Correct Released Claims / Total Released Claims ($N_{\text{true\_verified}} / N_{\text{released}}$).
- **False Verification Rate (FVR)**: False Claims Released / Total Released Claims ($N_{\text{false\_verified}} / N_{\text{released}}$).
- **Withholding Precision**: Truly Faulty Claims Withheld / Total Withheld Claims.
- **Withholding Recall**: Truly Faulty Claims Withheld / Total Faulty Claims in Test Pool.
- **Confidence Intervals**: 95% Wilson score intervals for binomial proportions.
- **Detector Metrics**: Precision, Recall, F1, and False Positive Rate evaluated on feature-level drift events (reported separately from condition release policies).

---

## 7. Results and Empirical Findings

### 7.1 Cross-Condition Comparison

The deterministic benchmark was executed across 37 claim scenarios under frozen protocol `62b958cbf646d492396b328fabb0308586986a8b16e6733fb0dde94b57ba8455`:

| Experimental Condition | Total Claims | Released | Release Coverage | Reliability (Released) | 95% Wilson CI | False Verification Rate | Withholding Recall | Mean Latency |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **1. Plain LLM Baseline (Cond A)** | 37 | 37 | 100.00% | 48.65% | [0.33, 0.64] | 51.35% | 0.00% | 0.00ms |
| **2. LLM + RAG (Cond B)** | 37 | 34 | 91.89% | 52.94% | [0.37, 0.69] | 47.06% | 15.79% | 0.01ms |
| **3. LLM + Numeric Verify (Cond C)** | 37 | 25 | 67.57% | 72.00% | [0.52, 0.86] | 28.00% | 63.16% | 0.22ms |
| **4. Full Claim-Level Trust (Cond D)** | 37 | 17 | 45.95% | **94.12%** | **[0.73, 0.99]** | **5.88%** | **94.74%** | 11.09ms |
| **5. No-Propagation Ablation (Cond E)** | 37 | 25 | 67.57% | 72.00% | [0.52, 0.86] | 28.00% | 63.16% | 8.37ms |

### 7.2 Standalone Feature-Level Drift Detector Diagnostics

Drift detection capability belongs strictly to the underlying feature drift detector, evaluated once across all 37 scenario features:

| Metric | Measured Value | Definition / Count |
| :--- | :---: | :--- |
| **Features Evaluated** | 37 | Total unique (dataset, scenario, feature) tuples |
| **Injected Shifts** | 12 | True distribution shifts injected |
| **Clean Controls** | 25 | Unshifted stable negative controls |
| **True Positives (TP)** | 11 | Shift injected and correctly flagged ($p < 0.05$ or $\text{PSI} \ge 0.10$) |
| **False Positives (FP)** | 0 | Unshifted negative control flagged as drifted (FPR = 0.0%) |
| **False Negatives (FN)** | 1 | Small shift scenario where magnitude fell below KS $\alpha = 0.05$ |
| **Detector Precision** | **100.00%** | $11 / (11 + 0)$ |
| **Detector Recall** | **91.67%** | $11 / (11 + 1)$ |
| **Detector F1 Score** | **0.9565** | Harmonic mean of precision and recall |

*Attribution Note*: Plain LLM (A), RAG (B), and Numeric Verification (C) do not execute drift detection; their drift metrics are reported as `N/A`.

---

## 8. Paired Statistical Analysis: Condition D vs Condition E

### 8.1 2x2 Paired Release Contingency Table

Conditions D and E were aligned scenario-by-scenario across all 37 claims:

| | Condition E: Released | Condition E: Withheld | Row Total |
| :--- | :---: | :---: | :---: |
| **Condition D: Released** | 17 (16 correct, 1 incorrect) | 0 | **17** |
| **Condition D: Withheld** | 8 (0 correct, 8 incorrect) | 12 (all withheld) | **20** |
| **Column Total** | **25** | **12** | **37** |

### 8.2 Analysis of Discordant Pairs
Exactly 8 claims produced discordant release decisions between Condition D and Condition E. In all 8 cases, Condition E released the claim while Condition D withheld it:
- 6 claims involved moderate or severe distribution drift (`FaultType.NUMERIC_SHIFT_MODERATE` and `FaultType.NUMERIC_SHIFT_SEVERE`). Condition D successfully withheld all 6 corrupt claims, whereas Condition E released them because drift propagation was disabled.
- 2 claims involved small distribution shift (`FaultType.NUMERIC_SHIFT_SMALL`). Because the evaluation sum was factually consistent with the drifted sample, ground-truth correctness was marked `True`. Condition D withheld them due to drift sensitivity, whereas Condition E released them.

### 8.3 Exact McNemar Hypothesis Testing
Evaluating paired binary decision correctness (where a correct action is defined as releasing a valid claim or withholding an invalid claim):
- Discordant $b$ (D correct action, E incorrect action): $6$
- Discordant $c$ (E correct action, D incorrect action): $2$
- Total discordant pairs: $n = b + c = 8$
- Exact two-sided binomial p-value:
  $$p = 2 \times \sum_{k=0}^{\min(6, 2)} \binom{8}{k} (0.5)^8 = 2 \times \frac{1 + 8 + 28}{256} = 2 \times \frac{37}{256} \approx 0.2891$$
- Continuity-corrected McNemar $\chi^2$:
  $$\chi^2 = \frac{(|b - c| - 1)^2}{b + c} = \frac{(|6 - 2| - 1)^2}{8} = \frac{9}{8} = 1.125$$

**Scientific Conclusion**: Because $p = 0.2891 > 0.05$, the paired difference in binary correctness between Condition D and Condition E **does not achieve statistical significance** under the exact McNemar test.

### 8.4 Clustered Dependence Limitations
The 37 evaluated claims are derived from only 3 distinct underlying datasets ($N=3$). Because claims within the same dataset share distributional properties and fault parameters, observations are not independently and identically distributed (non-i.i.d.). Treating repeated claims as independent sample points would constitute pseudo-replication. Therefore, while Condition D empirically demonstrates superior reliability in this controlled benchmark (94.12% vs 72.00%), **population-level statistical significance cannot be claimed** without extensive multi-domain replication.

---

## 9. Security, Cryptographic, and Integrity Audit

### 9.1 Authentication & Privilege Escalation Hardening
Audit of `AuthService.register` identified an initial vulnerability where public registration assigned `Role.admin` by default. This was hardened:
- Self-registration assigns `Role.viewer` by default.
- Client requests for `Role.admin` are strictly demoted to `Role.viewer`.
- Elevated roles (`Role.admin`) can only be assigned through authenticated administrative endpoints (`PATCH /api/v1/admin/users/{id}/role`) by existing administrators.

### 9.2 Dataset Snapshot Consistency (TOCTOU Defense)
To prevent race conditions where a dataset is modified on disk between SHA-256 calculation and pandas parsing, `TrustService.verify_and_release_claim` loads the entire file into an in-memory byte buffer once. Both the cryptographic snapshot hash and the pandas scalar computation reference this identical buffer. Regression tests confirm that external disk mutations during execution do not corrupt verification integrity.

### 9.3 Audit Ledger Integrity and Tail-Truncation Anchoring
The audit ledger links successive verification events using SHA-256 over RFC 8785 canonical JSON. 
- **Interior Tampering Detection**: Modifying an interior record breaks both the canonical payload hash and the predecessor hash of subsequent records.
- **Tail-Truncation Boundary**: A valid hash chain alone cannot detect the silent deletion of trailing records. We implemented `AuditCheckpointStore`, an independent anchor abstraction. When configured, out-of-band checkpoint validation flags tail truncation immediately. When unconfigured, the system transparently reports internal consistency only.

---

## 10. Threats to Validity

1. **Construct Validity**: Offline rule-based simulations were used for Conditions A, B, and C. While this isolates arithmetic and retrieval behavior deterministically, it does not capture emergent linguistic self-correction present in human prompting.
2. **Internal Validity**: Fault injection scenarios were synthesized deterministically. Unseen operational failure modes (e.g. database connection drops during streaming) were evaluated via unit mocks rather than physical network partitions.
3. **External Validity**: Benchmarking was limited to 3 tabular datasets. Performance on high-dimensional unstructured text, multi-table relational joins, or real-time streaming data remains to be validated.

---

## 11. Limitations and Future Work

1. **Threshold Tuning**: KS $\alpha = 0.05$ and PSI $\ge 0.25$ thresholds were fixed *a priori*. Adaptive thresholding based on sample size and domain volatility warrants future investigation.
2. **Multi-Hop Lineage**: Current implementation supports single-step direct aggregation lineage. Complex multi-table DAG lineage requires graph-based propagation engines.
3. **Hardware Anchoring**: Future iterations should anchor the `AuditCheckpointStore` to hardware security modules (HSM) or public transparency ledgers (e.g., RFC 6962 Certificate Transparency style logs).

---

## 12. Conclusion

We presented a claim-level trust verification architecture for enterprise AI analytics. By uniting immutable snapshot binding, arithmetic recomputation, KS/PSI drift detection, and tamper-evident audit logging, the system reduces the false verification rate from 28.00% to 5.88% in controlled testing. Crucially, rigorous statistical auditing reveals that paired binary correctness differences do not achieve statistical significance ($p = 0.2891$) and that dataset clustering limits generalization claims. These findings emphasize the necessity of rigorous statistical discipline and honest error reporting in AI safety research.

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
