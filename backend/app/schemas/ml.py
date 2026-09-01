from typing import Any
from pydantic import BaseModel, Field

class TrainRequest(BaseModel):
    dataset_id: int = Field(alias="datasetId")
    target_column: str = Field(alias="targetColumn")
    feature_columns: list[str] = Field(alias="featureColumns")
    algorithm_id: str = Field(alias="algorithmId")
    problem_type: str = Field(alias="problemType")
    test_size: float = Field(default=0.2, alias="testSize")
    cross_validation: bool = Field(default=False, alias="crossValidation")
    hyperparameters: dict[str, Any] = Field(default_factory=dict)


class PredictionRequest(BaseModel):
    model_name: str
    features: dict[str, float]

