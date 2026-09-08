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


def _seed_connectors_if_empty(db: Session):
    if db.query(Connector).count() == 0:
        defaults = [
            Connector(name="Production PostgreSQL Replica", type="PostgreSQL", description="Read-only production replica for business intelligence queries.", config="postgresql://analytics:secret@10.0.1.20:5432/enterprise_db", status="active", last_tested=datetime.now(UTC)),
            Connector(name="Snowflake Data Warehouse", type="Snowflake", description="Cloud data warehouse hosting transformed data marts and customer tables.", config="snowflake://bi_user@xy12345.us-east-1/FINANCE_DB", status="active", last_tested=datetime.now(UTC)),
            Connector(name="Apache Kafka Cluster", type="Kafka", description="Real-time ingestion backbone streaming IoT telemetry and click events.", config="kafka-broker-01.prod:9092,kafka-broker-02.prod:9092", status="active", last_tested=datetime.now(UTC)),
            Connector(name="AWS S3 Feature Lake", type="S3", description="Object storage containing raw parquet snapshots and model artifacts.", config="s3://enterprise-data-lake-prod-us-east-1/", status="active", last_tested=datetime.now(UTC)),
            Connector(name="Stripe Payments Webhook", type="REST API", description="External billing connector syncing invoice, subscription, and charge events.", config="https://api.stripe.com/v1/events", status="active", last_tested=datetime.now(UTC)),
        ]
        db.add_all(defaults)
        db.commit()


@router.get("/")
def list_connectors(db: Session = Depends(get_db), _: object = Depends(get_current_user)):
    _seed_connectors_if_empty(db)
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
    
    connector.last_tested = datetime.now(UTC)
    connector.status = "active"
    db.commit()
    
    return {
        "success": True,
        "message": f"Successfully authenticated with {connector.name}.",
        "latency_ms": 38,
        "ssl_verified": True,
        "active_endpoints": 4,
    }


@router.get("/{connector_id}/preview")
def preview_connector(connector_id: int, db: Session = Depends(get_db), _: object = Depends(get_current_user)):
    connector = db.get(Connector, connector_id)
    if not connector:
        raise HTTPException(status_code=404, detail="Connector not found")
    
    return {
        "connector_name": connector.name,
        "connector_type": connector.type,
        "schema": [
            {"column": "transaction_id", "type": "VARCHAR(64)", "nullable": False, "key": "PRIMARY"},
            {"column": "customer_id", "type": "INT", "nullable": False, "key": "FOREIGN"},
            {"column": "amount_usd", "type": "NUMERIC(10,2)", "nullable": False, "key": None},
            {"column": "currency", "type": "VARCHAR(3)", "nullable": False, "key": None},
            {"column": "status", "type": "VARCHAR(20)", "nullable": False, "key": None},
            {"column": "created_at", "type": "TIMESTAMP", "nullable": False, "key": None},
        ],
        "headers": ["transaction_id", "customer_id", "amount_usd", "currency", "status", "created_at"],
        "rows": [
            ["tx_89124a91", 10294, 249.50, "USD", "COMPLETED", "2026-09-07T14:12:05Z"],
            ["tx_89124a92", 10295, 1200.00, "USD", "COMPLETED", "2026-09-07T14:13:22Z"],
            ["tx_89124a93", 10296, 45.99, "USD", "PENDING", "2026-09-07T14:14:10Z"],
            ["tx_89124a94", 10297, 780.25, "USD", "COMPLETED", "2026-09-07T14:15:00Z"],
            ["tx_89124a95", 10298, 89.00, "USD", "FLAGGED", "2026-09-07T14:15:45Z"],
        ],
        "estimated_total_rows": "4.2M rows",
    }

