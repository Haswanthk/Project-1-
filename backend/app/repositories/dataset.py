from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.dataset import Dataset


class DatasetRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, dataset: Dataset) -> Dataset:
        self.db.add(dataset)
        self.db.commit()
        self.db.refresh(dataset)
        return dataset

    def list_all(self) -> list[Dataset]:
        return list(self.db.scalars(select(Dataset).order_by(Dataset.created_at.desc())).all())

    def get_by_id(self, dataset_id: int) -> Dataset | None:
        return self.db.get(Dataset, dataset_id)

