"""
Evaluation Configuration and Protocol Settings for Claim-Level Trust Research Harness.
RFC / Reproducibility Protocol: Stage 13 Research Framework.
"""
from dataclasses import dataclass, field
from typing import Dict, List, Any


@dataclass(frozen=True)
class EvaluationConfig:
    protocol_version: str = "1.0.0"
    random_seed: int = 42
    train_ratio: float = 0.70
    val_ratio: float = 0.15
    test_ratio: float = 0.15
    tolerance: float = 1e-4
    confidence_level: float = 0.95
    alpha: float = 0.05
    psi_warn_threshold: float = 0.10
    psi_fail_threshold: float = 0.25
    trust_missing_pct_warn: float = 0.10
    trust_missing_pct_fail: float = 0.20
    stale_days_warn: int = 30
    stale_days_fail: int = 90
    stratified_split: bool = True
    scenario_matrix_version: str = "2.0.0"
    scenario_matrix: str = "standard"
    conditions: List[str] = field(default_factory=lambda: [
        "plain_llm",
        "llm_rag",
        "llm_numeric_verify",
        "claim_level_trust",
        "no_propagation_ablation"
    ])
    supported_metrics: List[str] = field(default_factory=lambda: [
        "claim_correctness_rate",
        "unsupported_claim_rate",
        "false_verification_rate",
        "withholding_precision",
        "withholding_recall",
        "release_coverage",
        "reliability_among_released",
        "drift_precision",
        "drift_recall",
        "drift_f1",
        "drift_false_positive_rate",
        "latency_ms",
        "execution_success_rate"
    ])

    def get_protocol_hash(self) -> str:
        """Returns deterministic SHA-256 fingerprint of the evaluation protocol configuration."""
        import hashlib
        import json
        config_dict = {
            "protocol_version": self.protocol_version,
            "scenario_matrix_version": self.scenario_matrix_version,
            "scenario_matrix": self.scenario_matrix,
            "random_seed": self.random_seed,
            "train_ratio": self.train_ratio,
            "val_ratio": self.val_ratio,
            "test_ratio": self.test_ratio,
            "stratified_split": self.stratified_split,
            "tolerance": self.tolerance,
            "confidence_level": self.confidence_level,
            "alpha": self.alpha,
            "psi_warn_threshold": self.psi_warn_threshold,
            "psi_fail_threshold": self.psi_fail_threshold,
            "trust_missing_pct_warn": self.trust_missing_pct_warn,
            "trust_missing_pct_fail": self.trust_missing_pct_fail,
            "stale_days_warn": self.stale_days_warn,
            "stale_days_fail": self.stale_days_fail,
            "conditions": sorted(self.conditions),
            "supported_metrics": sorted(self.supported_metrics),
        }
        canonical_json = json.dumps(config_dict, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()

