from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.deps import get_db, require_role
from app.models.dataset import Dataset
from app.models.report import Report
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


@router.post("/users/{user_id}/toggle-active")
def toggle_user_active(
    user_id: int, db: Session = Depends(get_db), current_user=Depends(require_role(Role.admin))
):
    """Activate or deactivate a user account."""
    user = UserRepository(db).get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own account")

    user.is_active = not user.is_active
    db.add(user)
    db.commit()
    db.refresh(user)

    action = "ACTIVATED" if user.is_active else "DEACTIVATED"
    _AUDIT_LOGS.append({
        "id": len(_AUDIT_LOGS) + 1,
        "action": f"USER_{action}",
        "actor": current_user.email,
        "target": user.email,
        "details": f"User account {'activated' if user.is_active else 'deactivated'}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    return {"status": "updated", "user_id": user.id, "is_active": user.is_active}


@router.get("/audit-logs")
def get_audit_logs(current_user=Depends(require_role(Role.admin))):
    _ = current_user
    return _AUDIT_LOGS


@router.get("/system-stats")
def get_system_stats(db: Session = Depends(get_db), current_user=Depends(require_role(Role.admin))):
    """Return real system statistics from the database."""
    _ = current_user

    # Real counts from the database
    total_users = db.scalar(func.count(User.id)) or 0
    active_users = db.scalar(
        func.count(User.id).filter(User.is_active == True)  # noqa: E712
    ) or 0
    total_datasets = db.scalar(func.count(Dataset.id)) or 0
    total_reports = db.scalar(func.count(Report.id)) or 0

    # Count trained models from disk
    model_dir = Path("models")
    models_trained = len(list(model_dir.glob("*.pkl"))) if model_dir.exists() else 0

    # Report directory size
    reports_dir = Path("reports")
    report_files_size = sum(f.stat().st_size for f in reports_dir.glob("*") if f.is_file()) if reports_dir.exists() else 0

    # Dataset storage size
    dataset_total_bytes = 0
    datasets = db.query(Dataset).all()
    for ds in datasets:
        try:
            p = Path(ds.file_path)
            if p.exists():
                dataset_total_bytes += p.stat().st_size
        except Exception:
            pass

    def _human_bytes(b: int) -> str:
        for unit in ("B", "KB", "MB", "GB"):
            if b < 1024:
                return f"{b:.1f} {unit}"
            b /= 1024
        return f"{b:.1f} TB"

    return {
        "total_users": total_users,
        "active_users": active_users,
        "total_datasets": total_datasets,
        "total_reports": total_reports,
        "models_trained": models_trained,
        "dataset_storage": _human_bytes(dataset_total_bytes),
        "report_storage": _human_bytes(report_files_size),
        "audit_log_entries": len(_AUDIT_LOGS),
    }
