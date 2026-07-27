from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.deps import get_current_user, get_db, require_role
from app.models.user import Role, User
from app.repositories.user import UserRepository
from app.schemas.user import ProfileUpdate, UserRead

router = APIRouter()


@router.get("/me", response_model=UserRead)
def get_profile(current_user=Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserRead)
def update_profile(payload: ProfileUpdate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    user = UserRepository(db).get_by_id(current_user.id)
    user.full_name = payload.full_name
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/", response_model=list[UserRead], dependencies=[Depends(require_role(Role.admin))])
def list_users(db: Session = Depends(get_db)):
    return list(db.scalars(select(User)).all())
