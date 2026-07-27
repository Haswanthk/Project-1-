from datetime import datetime, timezone
from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.deps import get_db, require_role
from app.models.user import Role, User
from app.repositories.user import UserRepository

router = APIRouter()


class RoleUpdateRequest(BaseModel):
    role: Role


_AUDIT_LOGS: list[dict[str, Any]] = [
    {
        "id": 1,
        "action": "USER_ROLE_PROMOTED",
        "actor": "admin@enterprise.ai",
        "target": "analyst_1",
        "details": "Changed role from Viewer to Analyst",
        "timestamp": "2026-07-26T15:00:00Z",
    },
    {
        "id": 2,
        "action": "DATASET_UPLOADED",
        "actor": "analyst_1",
        "target": "sales_q2_2026.csv",
        "details": "Uploaded dataset (size: 4.2MB)",
        "timestamp": "2026-07-26T17:20:00Z",
    },
]


@router.get("/users")
def get_admin_users(db: Session = Depends(get_db), current_user=Depends(require_role(Role.admin))):
    _ = current_user
    users = UserRepository(db).list_all()
    return [
        {
            "id": u.id,
            "email": u.email,
            "full_name": u.full_name,
            "role": u.role.value if hasattr(u.role, "value") else str(u.role),
            "is_active": u.is_active,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        }
        for u in users
    ]


@router.patch("/users/{user_id}/role")
def update_user_role(
    user_id: int, payload: RoleUpdateRequest, db: Session = Depends(get_db), current_user=Depends(require_role(Role.admin))
):
    user = UserRepository(db).get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.role = payload.role
    db.add(user)
    db.commit()
    db.refresh(user)

    _AUDIT_LOGS.append({
        "id": len(_AUDIT_LOGS) + 1,
        "action": "USER_ROLE_UPDATED",
        "actor": current_user.email,
        "target": user.email,
        "details": f"Updated role to {payload.role.value}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    return {"status": "updated", "user_id": user.id, "new_role": payload.role.value}


@router.get("/audit-logs")
def get_audit_logs(current_user=Depends(require_role(Role.admin))):
    _ = current_user
    return _AUDIT_LOGS


@router.get("/system-stats")
def get_system_stats(current_user=Depends(require_role(Role.admin))):
    _ = current_user
    return {
        "active_users": 18,
        "total_datasets": 42,
        "models_trained": 128,
        "system_cpu_usage": "14.2%",
        "system_memory_usage": "3.8 GB / 16 GB",
        "disk_storage": "124 GB / 500 GB",
        "uptime": "14 days, 6 hours",
    }
