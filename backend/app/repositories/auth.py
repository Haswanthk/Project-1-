from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.auth import RefreshSession, UserToken


class AuthRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_refresh_session(self, session: RefreshSession) -> RefreshSession:
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        return session

    def get_refresh_session(self, token_id: str) -> RefreshSession | None:
        return self.db.scalar(select(RefreshSession).where(RefreshSession.token_id == token_id))

    def list_user_sessions(self, user_id: int) -> list[RefreshSession]:
        return list(self.db.scalars(select(RefreshSession).where(RefreshSession.user_id == user_id)).all())

    def revoke_session(self, session: RefreshSession) -> RefreshSession:
        session.revoked = True
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        return session

    def save_user_token(self, token: UserToken) -> UserToken:
        self.db.add(token)
        self.db.commit()
        self.db.refresh(token)
        return token

    def get_user_token(self, token: str, token_type: str) -> UserToken | None:
        stmt = select(UserToken).where(UserToken.token == token, UserToken.token_type == token_type)
        return self.db.scalar(stmt)

