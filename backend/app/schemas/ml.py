from pydantic import BaseModel


class TrainRequest(BaseModel):
    dataset_id: int
    target_column: str
    problem_type: str
    model_type: str


class PredictionRequest(BaseModel):
    model_name: str
    features: dict[str, float]

