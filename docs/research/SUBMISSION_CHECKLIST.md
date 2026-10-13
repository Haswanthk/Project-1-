# Publication Readiness & Venue Submission Checklist

**Document**: `docs/research/SUBMISSION_CHECKLIST.md`  
**Manuscript**: `docs/research/claim_level_trust_paper.md` (`v2.0.0-venue-neutral`)  
**Audit Reference**: `docs/research/STAGE19_AUTHOR_REVIEW.md`  
**Protocol Hash**: `62b958cbf646d492396b328fabb0308586986a8b16e6733fb0dde94b57ba8455`

This checklist guides the research authors through the necessary editorial, ethical, procedural, and formatting steps required prior to submitting the manuscript to an academic conference or peer-reviewed journal.

---

## 1. Scope, Contribution & Positioning Fit

- [x] **Primary Research Problem**: Clearly defines the challenge of post-generation numerical hallucinations and silent upstream distribution drift in enterprise AI copilots.
- [x] **Research Questions**: Explicitly states RQ1 (Arithmetic Recomputation), RQ2 (Upstream Drift Propagation), and RQ3 (Cryptographic and Operational Integrity).
- [x] **Negative / Nuanced Results Integrity**: Honestly presents the exact McNemar test result ($p = 0.2891$) and documents dataset clustering limitations ($N=3$) without attempting to overclaim statistical superiority.
- [x] **Ablation Rigor**: Controlled Condition D vs Condition E comparison isolates the specific contribution of `enable_propagation` on byte-identical inputs.
- [x] **System Implementation Bound**: Explicitly distinguishes what is fully implemented and tested (single-read snapshot, KS/PSI detector, canonical hash chain, checkpoint store) from future directions (multi-hop SQL DAGs, hardware HSM anchoring).

---

## 2. Author Information & Affiliations (To Be Completed by Authors)

> [!IMPORTANT]
> The AI assistant has not populated author names, institutions, contact emails, or funding sources. The author team must complete this section according to venue guidelines.

- [ ] **Author Order & Roles**: Agree upon final author list and contribution order (e.g., CRediT taxonomy: Conceptualization, Methodology, Software, Validation, Writing).
- [ ] **Affiliation Metadata**: Provide institutional affiliations, departments, city, state, country, and postal codes for all authors.
- [ ] **Corresponding Author**: Designate the corresponding author and provide their active institutional email address.
- [ ] **ORCID Identifiers**: Supply 16-digit ORCID identifiers for all co-authors.

### Author Template
```markdown
Author 1: [Full Name], [ORCID: 0000-0000-0000-0000]
Affiliation: [Department, Institution, City, Country]
Email: [institutional.email@domain.edu]

Author 2: [Full Name], [ORCID: 0000-0000-0000-0000]
Affiliation: [Department, Institution, City, Country]
Email: [institutional.email@domain.edu]

Corresponding Author: [Designated Author Name] ([corresponding.email@domain.edu])
```

---

## 3. Abstract and Keywords

- [x] **Word Count & Structure**: Abstract is concise (~250 words), describing context, problem, methodology, key findings (94.12% vs 72.00% reliability), statistical qualifications ($p = 0.2891$), and contributions.
- [x] **Keywords**: 8 domain-specific keywords provided (`Claim Verification`, `Hallucination Suppression`, `Feature Drift`, `Upstream Lineage Propagation`, `Audit Ledger`, `TOCTOU Consistency`, `Statistical Validity`, `Trustworthy AI`).
- [ ] **Venue Keyword Alignment**: Verify whether target venue requires predefined ACM Computing Classification System (CCS) concepts or IEEE Taxonomy keywords.

---

## 4. Figures and Tables Quality

- [x] **Table Completeness**:
  - Table 1: Benchmark Dataset Characteristics and Provenance.
  - Table 2: Experimental Conditions Matrix.
  - Table 3: Fault Injection Scenarios and Expected Behaviors.
  - Table 4: Primary Benchmark Results across All 5 Conditions.
  - Table 5: Feature-Level Drift Detector Diagnostics.
  - Table 6: Per-Dataset Reliability and FVR Breakdown.
  - Table 7: 2x2 Paired Release Contingency Matrix.
  - Table 8: Detailed Investigation of the 8 Discordant Cases.
- [x] **Visual Figures**:
  - Figure 1: Claim-Level Trust Pipeline & Architecture Diagram.
  - Figure 2: Reliability vs False Verification Rate Comparison.
  - Figure 3: Execution Latency Overhead by Verification Tier.
- [x] **Traceability**: All numerical table values trace 100% to machine-readable artifact `backend/app/evaluation/results/final_benchmark_run_1.json`.
- [ ] **Camera-Ready Graphics Conversion**: For PDF submission, convert ASCII / Markdown diagrams into high-resolution vector figures (PDF / EPS / SVG at 300+ DPI).

---

## 5. References and Citation Audit

- [x] **Authenticity**: All 11 references in Section 14 are authentic peer-reviewed publications or established standards. Zero fabricated citations.
- [x] **In-Text Citation Mapping**: Every reference in the bibliography is cited and discussed within the body text.
- [x] **Bibliographic Completeness**: All entries include authors, year, full title, publication venue, volume/issue, and page numbers.
- [ ] **Target Venue BibTeX Formatting**: Format citations using the target venue's `.bib` style file (e.g., `ACM-Reference-Format.bst` or `IEEEtran.bst`).

---

## 6. Research Ethics, Privacy & Data Provenance

- [x] **Human Subjects & Clinical Data**: The research does not involve human subjects, clinical interventions, or animal testing. Institutional Review Board (IRB) approval was not required.
- [x] **Dataset Provenance & Licenses**:
  - `telco_churn`: Local synthetic fixture derived from open customer retention structures.
  - `breast_cancer_wisconsin`: Public domain / CC BY 4.0 (UCI ML Repository, Wolberg et al., 1995).
  - `wine_recognition`: Public domain / CC BY 4.0 (UCI ML Repository, Forina et al., 1991).
- [x] **Data Minimization & PII Protection**: Audit records store column-level aggregation scalars and cryptographic hashes, preventing persistent exposure of raw individual records.
- [x] **Responsible AI Use**: Trust badges explicitly label confidence tiers, mitigating automation bias and unverified overreliance.

---

## 7. Conflict-of-Interest & Funding Declarations

> [!NOTE]
> Authors must declare any financial or personal relationships that could influence the work.

- [ ] **Funding Disclosure**: Declare all grants, institutional fellowships, or corporate sponsorships supporting the research:
  ```markdown
  Funding: This work was supported by [Grant Name / Number] from [Funding Body]. (or: "The authors declare that no external funding was received for this study.")
  ```
- [ ] **Competing Interests**: State whether any authors have financial interests, patent applications, or commercial ties related to claim verification:
  ```markdown
  Competing Interests: The authors declare that they have no competing financial or non-financial interests.
  ```

---

## 8. Reproducibility Materials & Artifact Packaging

- [x] **Reproducibility Instructions**: Comprehensive step-by-step reproduction instructions provided in `docs/research/REPRODUCIBILITY.md`.
- [x] **Frozen Protocol & Seed**: Protocol hash `62b958cbf646d492396b328fabb0308586986a8b16e6733fb0dde94b57ba8455` and random seed 42 ensure exact determinism.
- [x] **Open Artifact Access**: Benchmark runners, adapters, and results are versioned in `backend/app/evaluation/`.
- [x] **Two-Run Verification**: 100.00% decision concordance (185/185 decisions identical) verified between independent benchmark executions.
- [ ] **Artifact Repository Upload**: Prior to submission, upload code and test datasets to a permanent archive (e.g., Zenodo or Figshare) with a DOI for artifact evaluation badges.

---

## 9. Originality, Plagiarism & Pre-Print Policy

- [x] **Originality**: The text, methodology, and empirical evaluations are original work.
- [x] **No Text Duplication**: No copyrighted passages or external documentation were copied verbatim.
- [ ] **Plagiarism Screening**: Run manuscript through institutional originality checkers (e.g., Turnitin or iThenticate) prior to submission.
- [ ] **Preprint Archiving**: Decide whether to deposit the draft on arXiv / TechRxiv prior to or concurrently with peer review (verify target venue's preprint policy).

---

## 10. Venue Formatting & Submission Execution

- [ ] **Select Target Venue**: Consult `docs/research/VENUE_SELECTION_NOTES.md` to select the primary target venue.
- [ ] **Check Review Model**:
  - If **Double-Blind**: Anonymize manuscript (remove author names, institutional affiliations, repository links, self-citations).
  - If **Single-Blind**: Include full author metadata and acknowledgments.
- [ ] **Template Adaptation**: Port Markdown content to official venue template (LaTeX / Overleaf preferred):
  - ACM: `acmart.cls` (`sigconf` or `manuscript` format).
  - IEEE: `IEEEtran.cls` (two-column conference or journal format).
  - Springer: `svjour3` / `llncs` format.
- [ ] **Page & Word Limits**: Verify manuscript length against venue constraints (typically 8–10 pages for conferences, unlimited or 15–25 pages for journals).
- [ ] **Final Author Sign-Off**: All co-authors have reviewed and approved the final submission draft.
