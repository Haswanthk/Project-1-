from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, computed_field


class DatasetRead(BaseModel):
    id: int
    name: str
    source_type: str
    file_path: str
    schema_payload: str = Field(alias="schema_json")
    profiling_json: str
    row_count: int
    column_count: int
    file_size_bytes: int
    duplicate_rows: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    @computed_field
    def rows(self) -> int:
        return self.row_count

    @computed_field
    def columns(self) -> int:
        return self.column_count

    @computed_field
    def filename(self) -> str:
        return self.name

    @computed_field
    def file_size(self) -> int:
        return self.file_size_bytes


class ProfileResponse(BaseModel):
    detected_schema: dict[str, str] = Field(alias="schema")
    statistics: dict[str, Any]
    missing_values: dict[str, int]
    duplicates: int
    unique_values: dict[str, int]
    correlations: dict[str, dict[str, float]]
    outliers: dict[str, int]
    class_imbalance: dict[str, float]
    chart_payload: dict[str, Any]

    model_config = ConfigDict(populate_by_name=True)
