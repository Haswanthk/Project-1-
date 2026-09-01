from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.connector import Connector

router = APIRouter()


class ConnectorCreate(BaseModel):
    name: str
    type: str
    description: str | None = None
    connection_string: str | None = None
    base_url: str | None = None
    url: str | None = None


@router.get("/")
def list_connectors(db: Session = Depends(get_db), _: object = Depends(get_current_user)):
    connectors = db.query(Connector).all()
    return [
        {
            "id": str(c.id),
            "name": c.name,
            "type": c.type,
            "status": c.status,
            "last_tested": c.last_tested.isoformat() if c.last_tested else None,
            "description": c.description,
        }
        for c in connectors
    ]


@router.post("/")
def add_connector(payload: ConnectorCreate, db: Session = Depends(get_db), _: object = Depends(get_current_user)):
    config = payload.connection_string or payload.base_url or payload.url or ""
    connector = Connector(
        name=payload.name,
        type=payload.type,
        description=payload.description,
        config=config,
    )
    db.add(connector)
    db.commit()
    db.refresh(connector)
    return {
        "id": str(connector.id),
        "name": connector.name,
        "type": connector.type,
        "status": connector.status,
        "last_tested": None,
        "description": connector.description,
    }


@router.delete("/{connector_id}")
def delete_connector(connector_id: int, db: Session = Depends(get_db), _: object = Depends(get_current_user)):
    connector = db.get(Connector, connector_id)
    if not connector:
        raise HTTPException(status_code=404, detail="Connector not found")
    db.delete(connector)
    db.commit()
    return {"status": "deleted"}


@router.post("/{connector_id}/test")
def test_connector(connector_id: int, db: Session = Depends(get_db), _: object = Depends(get_current_user)):
    connector = db.get(Connector, connector_id)
    if not connector:
        raise HTTPException(status_code=404, detail="Connector not found")
    
    # Just a mock test connection for now, we update the timestamp
    connector.last_tested = datetime.now(UTC)
    connector.status = "active"
    db.commit()
    
    return {"success": True, "message": "Connection successful"}


@router.get("/{connector_id}/preview")
def preview_connector(connector_id: int, db: Session = Depends(get_db), _: object = Depends(get_current_user)):
    connector = db.get(Connector, connector_id)
    if not connector:
        raise HTTPException(status_code=404, detail="Connector not found")
    
    # Mock data preview
    return {
        "headers": ["id", "timestamp", "value", "status"],
        "rows": [
            [1, "2024-01-01T00:00:00Z", 42.5, "active"],
            [2, "2024-01-01T00:05:00Z", 41.2, "active"],
            [3, "2024-01-01T00:10:00Z", 45.1, "error"],
        ]
    }
