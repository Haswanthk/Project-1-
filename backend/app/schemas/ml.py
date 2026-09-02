from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class TrainRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    dataset_id: int = Field(alias="datasetId")
    target_column: str = Field(alias="targetColumn")
    feature_columns: list[str] = Field(default_factory=list, alias="featureColumns")
    algorithm_id: str = Field(alias="algorithmId")
    problem_type: str = Field(alias="problemType")
    test_size: float = Field(default=0.2, alias="testSize")
    cross_validation: bool = Field(default=False, alias="crossValidation")
    hyperparameters: dict[str, Any] = Field(default_factory=dict)


class PredictionRequest(BaseModel):
    model_name: str
    features: dict[str, float]


class BatchPredictionRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    model_name: str = Field(alias="modelName")
    rows: list[dict[str, float]]


class ModelCompareRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    dataset_id: int = Field(alias="datasetId")
    target_column: str = Field(alias="targetColumn")
    feature_columns: list[str] | None = Field(default=None, alias="featureColumns")
    problem_type: str = Field(alias="problemType")
    test_size: float = Field(default=0.2, alias="testSize")
