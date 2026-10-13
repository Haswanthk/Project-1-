"""
Evaluation Package Initialization for Claim-Level Trust.
"""
from app.evaluation.config import EvaluationConfig
from app.evaluation.adapters import DatasetAdapter, TelcoChurnAdapter, BreastCancerAdapter, WineRecognitionAdapter
from app.evaluation.faults import FaultInjector, FaultScenario, FaultType
from app.evaluation.metrics import MetricsCalculator, MetricSummary
from app.evaluation.conditions import (
    BaseEvaluationCondition,
    PlainLLMCondition,
    LLMRAGCondition,
    LLMNumericVerifyCondition,
    FullTrustMechanismCondition,
    NoPropagationAblationCondition,
)
from app.evaluation.runner import ResearchEvaluationRunner

__all__ = [
    "EvaluationConfig",
    "DatasetAdapter",
    "TelcoChurnAdapter",
    "BreastCancerAdapter",
    "WineRecognitionAdapter",
    "FaultInjector",
    "FaultScenario",
    "FaultType",
    "MetricsCalculator",
    "MetricSummary",
    "BaseEvaluationCondition",
    "PlainLLMCondition",
    "LLMRAGCondition",
    "LLMNumericVerifyCondition",
    "FullTrustMechanismCondition",
    "NoPropagationAblationCondition",
    "ResearchEvaluationRunner",
]
