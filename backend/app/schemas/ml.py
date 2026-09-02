from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class TrainRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    dataset_id: int = Field(alias="datasetId")
    target_column: str = Field(alias="targetColumn")
    feature_columns: list[str] = Field(default_factory=list, alias="featureColumns")
    features: list[str] | None = None
    algorithm_id: str | None = Field(default=None, alias="algorithmId")
    algorithm: str | None = None
    model_name: str | None = Field(default=None, alias="modelName")
    problem_type: str | None = Field(default=None, alias="problemType")
    test_size: float = Field(default=0.2, alias="testSize")
    cross_validation: bool = Field(default=False, alias="crossValidation")
    hyperparameters: dict[str, Any] = Field(default_factory=dict)


class PredictionRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    model_name: str = Field(alias="modelName")
    features: dict[str, Any] = Field(default_factory=dict)
    input_data: dict[str, Any] | None = None

    def get_features(self) -> dict[str, Any]:
        return self.input_data if self.input_data is not None else self.features


class BatchPredictionRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    model_name: str = Field(alias="modelName")
    rows: list[dict[str, Any]] = Field(default_factory=list)
    input_data: list[dict[str, Any]] | None = None

    def get_rows(self) -> list[dict[str, Any]]:
        return self.input_data if self.input_data is not None else self.rows


class ModelCompareRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    dataset_id: int = Field(alias="datasetId")
    target_column: str = Field(alias="targetColumn")
    feature_columns: list[str] | None = Field(default=None, alias="featureColumns")
    problem_type: str = Field(alias="problemType")
    test_size: float = Field(default=0.2, alias="testSize")
