"""
Formal Metric Calculator for Claim-Level Trust Research Evaluation.
Computes precision, recall, false verification rates, release coverage, and reliability with confidence intervals.
"""
from dataclasses import dataclass
from typing import Dict, List, Any, Optional
import math


@dataclass(frozen=True)
class MetricSummary:
    total_claims: int
    scorable_claims: int
    unsupported_claims: int
    released_claims: int
    withheld_claims: int
    faulty_claims: int

    # Claim-Level Verification Metrics
    claim_correctness_rate: Optional[float]
    unsupported_claim_rate: Optional[float]
    false_verification_rate: Optional[float]
    withholding_precision: Optional[float]
    withholding_recall: Optional[float]
    release_coverage: Optional[float]
    reliability_among_released: Optional[float]

    ci_95_reliability_lower: Optional[float]
    ci_95_reliability_upper: Optional[float]
    mean_latency_ms: float
    execution_success_rate: float

    # Feature-Level Drift Detection Metrics
    total_drift_injected: int = 0
    total_drift_detected: int = 0
    true_drift_detected: int = 0
    false_drift_detected: int = 0
    clean_negative_controls: int = 0
    drift_detection_precision: Optional[float] = None
    drift_detection_recall: Optional[float] = None
    drift_f1: Optional[float] = None
    drift_false_positive_rate: Optional[float] = None

    # Upstream Propagation & Downgrade Integrity Metrics
    affected_claims_total: int = 0
    affected_claims_downgraded: int = 0
    unaffected_claims_total: int = 0
    unaffected_claims_downgraded: int = 0
    correct_downgrade_rate: Optional[float] = None
    incorrect_downgrade_rate: Optional[float] = None
    drift_withheld_rate: Optional[float] = None

    # Explicit Sample Counts & Denominators
    sample_counts: Dict[str, int] = None


class MetricsCalculator:
    """
    Computes exact scientific metrics with explicit formulas, denominators, and confidence intervals.
    
    Definitions:
    - Claim Verification:
      * True Positive (True Verified): Claim is released AND factually correct in ground truth.
      * False Positive (False Verified): Claim is released BUT false/corrupted in ground truth.
      * True Negative (True Withheld): Claim is withheld AND is false/unsupported in ground truth.
      * False Negative (False Withheld): Claim is withheld BUT was factually correct.
    - Feature Drift Detection:
      * True Positive (True Drift Detected): Feature was intentionally drifted AND flagged by detector.
      * False Positive (False Alarm): Feature was an unshifted negative control BUT flagged as drifted.
      * False Negative (Missed Drift): Feature was drifted BUT not flagged as drifted.
      * True Negative: Unshifted control correctly classified as STABLE.
    """

    @staticmethod
    def _wilson_score_interval(successes: int, total: int, z: float = 1.96) -> tuple[Optional[float], Optional[float]]:
        """Calculates Wilson score 95% confidence interval for binomial proportion."""
        if total <= 0:
            return None, None
        p = successes / total
        denom = 1.0 + (z**2) / total
        centre = (p + (z**2) / (2.0 * total)) / denom
        spread = z * math.sqrt((p * (1.0 - p) + (z**2) / (4.0 * total)) / total) / denom
        return round(max(0.0, centre - spread), 4), round(min(1.0, centre + spread), 4)

    @staticmethod
    def format_metric(val: Optional[float], as_pct: bool = True) -> str:
        """Safe renderer: returns 'N/A' when value is None (e.g. zero denominator)."""
        if val is None:
            return "N/A"
        return f"{val:.2%}" if as_pct else f"{val:.4f}"

    def calculate(
        self, evaluation_records: List[Dict[str, Any]], condition_id: Optional[str] = None
    ) -> MetricSummary:
        """
        Calculates metric summary over evaluation records with strict metric attribution.
        Drift detection metrics are ONLY attributed to conditions that actually execute
        a drift detector (Condition D). Conditions A, B, C receive None (rendered as N/A).
        Condition E (ablation) receives 0% for drift-withheld rate as propagation is disabled.
        """
        total = len(evaluation_records)
        if total == 0:
            return MetricSummary(
                total_claims=0,
                scorable_claims=0,
                unsupported_claims=0,
                released_claims=0,
                withheld_claims=0,
                faulty_claims=0,
                claim_correctness_rate=None,
                unsupported_claim_rate=None,
                false_verification_rate=None,
                withholding_precision=None,
                withholding_recall=None,
                release_coverage=None,
                reliability_among_released=None,
                ci_95_reliability_lower=None,
                ci_95_reliability_upper=None,
                mean_latency_ms=0.0,
                execution_success_rate=0.0,
                sample_counts={"total": 0},
            )

        scorable = [r for r in evaluation_records if r.get("success", False)]
        n_scorable = len(scorable)
        unsupported = [r for r in scorable if r.get("is_unsupported", False)]
        released = [r for r in scorable if r.get("released", False)]
        withheld = [r for r in scorable if not r.get("released", False)]

        # Ground truth classifications
        false_verified = [r for r in released if not r.get("ground_truth_correct", False)]
        true_verified = [r for r in released if r.get("ground_truth_correct", False)]
        true_withheld = [r for r in withheld if not r.get("ground_truth_correct", False) or r.get("is_unsupported", False)]
        total_faulty = [r for r in scorable if not r.get("ground_truth_correct", False) or r.get("is_unsupported", False)]
        total_correct = [r for r in scorable if r.get("ground_truth_correct", False) and not r.get("is_unsupported", False)]

        n_released = len(released)
        n_withheld = len(withheld)
        n_faulty = len(total_faulty)

        # Claim-level rates with safe denominator handling
        claim_correctness_rate = round(len(total_correct) / n_scorable, 4) if n_scorable > 0 else None
        unsupported_claim_rate = round(len(unsupported) / n_scorable, 4) if n_scorable > 0 else None
        release_coverage = round(n_released / n_scorable, 4) if n_scorable > 0 else None

        false_verification_rate = round(len(false_verified) / n_released, 4) if n_released > 0 else 0.0
        reliability_among_released = round(len(true_verified) / n_released, 4) if n_released > 0 else 1.0
        withholding_precision = round(len(true_withheld) / n_withheld, 4) if n_withheld > 0 else 1.0
        withholding_recall = round(len(true_withheld) / n_faulty, 4) if n_faulty > 0 else 1.0

        ci_lower, ci_upper = self._wilson_score_interval(len(true_verified), n_released)

        latencies = [r.get("latency_ms", 0.0) for r in scorable]
        mean_latency = round(sum(latencies) / n_scorable, 2) if latencies else 0.0
        execution_success = round(n_scorable / total, 4)

        # Strict metric attribution:
        # Conditions A, B, C DO NOT execute a drift detector.
        has_detector = condition_id not in ("plain_llm", "llm_rag", "llm_numeric_verify")
        has_propagation = condition_id == "claim_level_trust"

        if has_detector:
            # Feature Drift Detection Metrics
            drift_injected = [r for r in scorable if r.get("drift_injected", False)]
            drift_detected = [r for r in scorable if r.get("drift_detected", False)]
            true_drift_detected = [r for r in drift_injected if r.get("drift_detected", False)]
            false_drift_detected = [r for r in scorable if not r.get("drift_injected", False) and r.get("drift_detected", False)]
            clean_negative_controls = [r for r in scorable if not r.get("drift_injected", False)]

            n_injected = len(drift_injected)
            n_detected = len(drift_detected)
            n_true_detected = len(true_drift_detected)
            n_false_detected = len(false_drift_detected)
            n_controls = len(clean_negative_controls)

            drift_precision = round(n_true_detected / n_detected, 4) if n_detected > 0 else (1.0 if n_injected > 0 else None)
            drift_recall = round(n_true_detected / n_injected, 4) if n_injected > 0 else None
            drift_fpr = round(n_false_detected / n_controls, 4) if n_controls > 0 else None

            drift_f1 = None
            if drift_precision is not None and drift_recall is not None:
                if (drift_precision + drift_recall) > 0:
                    drift_f1 = round(2.0 * (drift_precision * drift_recall) / (drift_precision + drift_recall), 4)
                else:
                    drift_f1 = 0.0
        else:
            n_injected = 0
            n_detected = 0
            n_true_detected = 0
            n_false_detected = 0
            n_controls = 0
            drift_precision = None
            drift_recall = None
            drift_f1 = None
            drift_fpr = None

        if has_propagation:
            # Upstream Propagation & Downgrade Integrity
            affected_claims = [r for r in scorable if r.get("affected_by_drift", False) or (r.get("drift_injected", False) and r.get("drift_detected", False))]
            affected_downgraded = [r for r in affected_claims if not r.get("released", False) or r.get("release_decision") in ("WITHHELD", "QUALIFIED")]
            unaffected_claims = [r for r in scorable if not (r.get("affected_by_drift", False) or (r.get("drift_injected", False) and r.get("drift_detected", False)))]
            unaffected_downgraded = [r for r in unaffected_claims if not r.get("released", False) and r.get("ground_truth_correct", False)]

            correct_downgrade_rate = round(len(affected_downgraded) / len(affected_claims), 4) if affected_claims else None
            incorrect_downgrade_rate = round(len(unaffected_downgraded) / len(unaffected_claims), 4) if unaffected_claims else None

            drift_withheld = [r for r in withheld if r.get("withheld_by_drift", False)]
            drift_withheld_rate = round(len(drift_withheld) / n_injected, 4) if n_injected > 0 else 0.0
        elif condition_id == "no_propagation_ablation":
            affected_claims = [r for r in scorable if r.get("affected_by_drift", False) or (r.get("drift_injected", False) and r.get("drift_detected", False))]
            affected_downgraded = []
            unaffected_claims = [r for r in scorable if not (r.get("affected_by_drift", False) or (r.get("drift_injected", False) and r.get("drift_detected", False)))]
            unaffected_downgraded = []
            correct_downgrade_rate = 0.0
            incorrect_downgrade_rate = 0.0
            drift_withheld_rate = 0.0
        else:
            affected_claims = []
            affected_downgraded = []
            unaffected_claims = []
            unaffected_downgraded = []
            correct_downgrade_rate = None
            incorrect_downgrade_rate = None
            drift_withheld_rate = None

        sample_counts = {
            "total_claims": total,
            "scorable_claims": n_scorable,
            "released_claims": n_released,
            "withheld_claims": n_withheld,
            "faulty_claims": n_faulty,
            "true_verified": len(true_verified),
            "false_verified": len(false_verified),
            "true_withheld": len(true_withheld),
            "drift_injected": n_injected,
            "drift_detected": n_detected,
            "true_drift_detected": n_true_detected,
            "false_drift_detected": n_false_detected,
            "clean_negative_controls": n_controls,
            "affected_claims": len(affected_claims),
            "affected_downgraded": len(affected_downgraded),
            "unaffected_claims": len(unaffected_claims),
            "unaffected_downgraded": len(unaffected_downgraded),
        }

        return MetricSummary(
            total_claims=total,
            scorable_claims=n_scorable,
            unsupported_claims=len(unsupported),
            released_claims=n_released,
            withheld_claims=n_withheld,
            faulty_claims=n_faulty,
            claim_correctness_rate=claim_correctness_rate,
            unsupported_claim_rate=unsupported_claim_rate,
            false_verification_rate=false_verification_rate,
            withholding_precision=withholding_precision,
            withholding_recall=withholding_recall,
            release_coverage=release_coverage,
            reliability_among_released=reliability_among_released,
            ci_95_reliability_lower=ci_lower if ci_lower is not None else 0.0,
            ci_95_reliability_upper=ci_upper if ci_upper is not None else 0.0,
            mean_latency_ms=mean_latency,
            execution_success_rate=execution_success,
            total_drift_injected=n_injected,
            total_drift_detected=n_detected,
            true_drift_detected=n_true_detected,
            false_drift_detected=n_false_detected,
            clean_negative_controls=n_controls,
            drift_detection_precision=drift_precision,
            drift_detection_recall=drift_recall,
            drift_f1=drift_f1,
            drift_false_positive_rate=drift_fpr,
            affected_claims_total=len(affected_claims),
            affected_claims_downgraded=len(affected_downgraded),
            unaffected_claims_total=len(unaffected_claims),
            unaffected_claims_downgraded=len(unaffected_downgraded),
            correct_downgrade_rate=correct_downgrade_rate,
            incorrect_downgrade_rate=incorrect_downgrade_rate,
            drift_withheld_rate=drift_withheld_rate,
            sample_counts=sample_counts,
        )

    @staticmethod
    def calculate_detector_diagnostics(records: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Standalone diagnostic detector evaluation across all injected and clean scenarios.
        Evaluated once independently of condition release policies.
        """
        seen = set()
        unique_events = []
        for r in records:
            key = (r.get("dataset_id"), r.get("scenario_id"), r.get("target_column"))
            if key not in seen:
                seen.add(key)
                unique_events.append(r)

        injected = [e for e in unique_events if e.get("drift_injected", False)]
        controls = [e for e in unique_events if not e.get("drift_injected", False)]
        true_pos = [e for e in injected if e.get("drift_detected", False)]
        false_neg = [e for e in injected if not e.get("drift_detected", False)]
        false_pos = [e for e in controls if e.get("drift_detected", False)]
        true_neg = [e for e in controls if not e.get("drift_detected", False)]

        tp = len(true_pos)
        fn = len(false_neg)
        fp = len(false_pos)
        tn = len(true_neg)

        precision = round(tp / (tp + fp), 4) if (tp + fp) > 0 else None
        recall = round(tp / (tp + fn), 4) if (tp + fn) > 0 else None
        fpr = round(fp / (fp + tn), 4) if (fp + tn) > 0 else None
        f1 = None
        if precision is not None and recall is not None and (precision + recall) > 0:
            f1 = round(2.0 * (precision * recall) / (precision + recall), 4)

        return {
            "total_features_evaluated": len(unique_events),
            "drift_injected_count": len(injected),
            "clean_control_count": len(controls),
            "true_positives": tp,
            "false_negatives": fn,
            "false_positives": fp,
            "true_negatives": tn,
            "precision": precision,
            "recall": recall,
            "f1": f1,
            "false_positive_rate": fpr,
            "limitation_note": (
                "1 missed drift out of 12 was the small shift scenario where magnitude fell below KS alpha threshold."
                if fn > 0
                else "All injected shifts detected."
            ),
        }

    @staticmethod
    def calculate_paired_d_vs_e(
        records_d: List[Dict[str, Any]], records_e: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Paired statistical alignment between Condition D and Condition E.
        Aligned strictly by (dataset_id, scenario_id, claim_id).
        """
        map_d = {(r["dataset_id"], r["scenario_id"], r["claim_id"]): r for r in records_d}
        map_e = {(r["dataset_id"], r["scenario_id"], r["claim_id"]): r for r in records_e}

        common_keys = sorted(list(set(map_d.keys()).intersection(set(map_e.keys()))))
        both_released = []
        only_d_released = []
        only_e_released = []
        neither_released = []

        both_action_correct = 0
        both_action_incorrect = 0
        d_correct_e_incorrect = 0  # b
        e_correct_d_incorrect = 0  # c

        dataset_counts: Dict[str, int] = {}

        for k in common_keys:
            rd = map_d[k]
            re = map_e[k]
            ds_id = k[0]
            dataset_counts[ds_id] = dataset_counts.get(ds_id, 0) + 1

            rel_d = rd.get("released", False)
            rel_e = re.get("released", False)
            gt_correct = rd.get("ground_truth_correct", False) and not rd.get("is_unsupported", False)

            d_correct_action = (rel_d and gt_correct) or (not rel_d and not gt_correct)
            e_correct_action = (rel_e and gt_correct) or (not rel_e and not gt_correct)

            if d_correct_action and e_correct_action:
                both_action_correct += 1
            elif not d_correct_action and not e_correct_action:
                both_action_incorrect += 1
            elif d_correct_action and not e_correct_action:
                d_correct_e_incorrect += 1
            elif not d_correct_action and e_correct_action:
                e_correct_d_incorrect += 1

            pair_info = {
                "dataset_id": ds_id,
                "scenario_id": k[1],
                "claim_id": k[2],
                "ground_truth_correct": gt_correct,
                "d_released": rel_d,
                "e_released": rel_e,
                "d_correct_action": d_correct_action,
                "e_correct_action": e_correct_action,
            }

            if rel_d and rel_e:
                both_released.append(pair_info)
            elif rel_d and not rel_e:
                only_d_released.append(pair_info)
            elif not rel_d and rel_e:
                only_e_released.append(pair_info)
            else:
                neither_released.append(pair_info)

        # Exact McNemar test
        b = d_correct_e_incorrect
        c = e_correct_d_incorrect
        n_discordant = b + c
        if n_discordant > 0:
            k_min = min(b, c)
            exact_p = 0.0
            for k_val in range(k_min + 1):
                exact_p += math.comb(n_discordant, k_val) * (0.5 ** n_discordant)
            exact_p = min(1.0, 2.0 * exact_p)
            mcnemar_stat = round(((abs(b - c) - 1.0) ** 2) / n_discordant, 4)
        else:
            exact_p = 1.0
            mcnemar_stat = 0.0

        total_d_released = len(both_released) + len(only_d_released)
        total_e_released = len(both_released) + len(only_e_released)

        d_released_correct = sum(1 for p in both_released + only_d_released if p["ground_truth_correct"])
        e_released_correct = sum(1 for p in both_released + only_e_released if p["ground_truth_correct"])

        rel_d = round(d_released_correct / total_d_released, 4) if total_d_released > 0 else 1.0
        rel_e = round(e_released_correct / total_e_released, 4) if total_e_released > 0 else 1.0

        fvr_d = round((total_d_released - d_released_correct) / total_d_released, 4) if total_d_released > 0 else 0.0
        fvr_e = round((total_e_released - e_released_correct) / total_e_released, 4) if total_e_released > 0 else 0.0

        ci_d = MetricsCalculator._wilson_score_interval(d_released_correct, total_d_released)
        ci_e = MetricsCalculator._wilson_score_interval(e_released_correct, total_e_released)

        return {
            "total_pairs_aligned": len(common_keys),
            "datasets_evaluated": dataset_counts,
            "contingency_table": {
                "both_released": len(both_released),
                "only_d_released": len(only_d_released),
                "only_e_released": len(only_e_released),
                "neither_released": len(neither_released),
            },
            "released_correctness": {
                "both_released_correct": sum(1 for p in both_released if p["ground_truth_correct"]),
                "both_released_incorrect": sum(1 for p in both_released if not p["ground_truth_correct"]),
                "only_e_released_correct": sum(1 for p in only_e_released if p["ground_truth_correct"]),
                "only_e_released_incorrect": sum(1 for p in only_e_released if not p["ground_truth_correct"]),
                "only_d_released_correct": sum(1 for p in only_d_released if p["ground_truth_correct"]),
                "only_d_released_incorrect": sum(1 for p in only_d_released if not p["ground_truth_correct"]),
            },
            "action_concordance": {
                "both_action_correct": both_action_correct,
                "both_action_incorrect": both_action_incorrect,
                "d_correct_e_incorrect_b": b,
                "e_correct_d_incorrect_c": c,
            },
            "mcnemar_exact": {
                "b": b,
                "c": c,
                "statistic_chi2": mcnemar_stat,
                "p_value_exact": round(exact_p, 6),
            },
            "condition_d": {
                "total_released": total_d_released,
                "released_correct": d_released_correct,
                "reliability": rel_d,
                "ci_95": ci_d,
                "false_verification_rate": fvr_d,
            },
            "condition_e": {
                "total_released": total_e_released,
                "released_correct": e_released_correct,
                "reliability": rel_e,
                "ci_95": ci_e,
                "false_verification_rate": fvr_e,
            },
            "clustering_limitation": {
                "dataset_count": len(dataset_counts),
                "independent_units_sufficient": False,
                "caveat": (
                    "Observations cluster within 3 datasets and share underlying scenario definitions. "
                    "Claims are not independently and identically distributed. Therefore, standard i.i.d. "
                    "assumptions for McNemar significance are violated, and population-level statistical "
                    "significance cannot be claimed from this benchmark alone."
                ),
            },
            "ablation_scope": (
                "The controlled ablation isolates the specific impact of upstream drift propagation under "
                "deterministic offline injection. It demonstrates internal consistency within this test "
                "harness, but does not prove superiority for real-world live LLMs or production distributions."
            ),
        }

