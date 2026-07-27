import secrets
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_token, decode_token, get_password_hash, verify_password
from app.models.auth import RefreshSession, UserToken
from app.models.user import Role, User
from app.repositories.auth import AuthRepository
from app.repositories.user import UserRepository
from app.schemas.auth import RegisterRequest, TokenPair


class AuthService:
    def __init__(self, db: Session):
        self.db = db
        self.user_repo = UserRepository(db)
        self.auth_repo = AuthRepository(db)

    def register(self, payload: RegisterRequest) -> User:
        if self.user_repo.get_by_email(payload.email):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
        user = User(
            email=payload.email.lower().strip(),
            full_name=payload.full_name.strip(),
            hashed_password=get_password_hash(payload.password),
            role=Role.viewer,
        )
        user = self.user_repo.create(user)
        verification_token = self._issue_user_token(user.id, "email_verification", timedelta(hours=24))
        # In production, send this token using a real email provider.
        if settings.environment == "development":
            print(f"[DEV] Email verification token for {user.email}: {verification_token.token}")
        return user

    def login(self, email: str, password: str) -> TokenPair:
        user = self.user_repo.get_by_email(email)
        if not user or not verify_password(password, user.hashed_password):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
        if not user.is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive")
        return self._build_tokens(user.id)

    def refresh(self, refresh_token: str) -> TokenPair:
        payload = decode_token(refresh_token)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
        token_id = payload.get("jti")
        user_id = payload.get("sub")
        if not token_id or not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Malformed refresh token")
        session = self.auth_repo.get_refresh_session(token_id)
        if not session or session.revoked or session.expires_at <= datetime.now(UTC):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh session is invalid")
        self.auth_repo.revoke_session(session)
        return self._build_tokens(int(user_id))

    def forgot_password(self, email: str) -> None:
        user = self.user_repo.get_by_email(email)
        if not user:
            return
        token = self._issue_user_token(user.id, "password_reset", timedelta(minutes=30))
        if settings.environment == "development":
            print(f"[DEV] Password reset token for {user.email}: {token.token}")

    def reset_password(self, token: str, new_password: str) -> None:
        db_token = self.auth_repo.get_user_token(token, "password_reset")
        if not db_token or db_token.consumed or db_token.expires_at <= datetime.now(UTC):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token")
        user = self.user_repo.get_by_id(db_token.user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        user.hashed_password = get_password_hash(new_password)
        db_token.consumed = True
        self.db.add_all([user, db_token])
        self.db.commit()

    def verify_email(self, token: str) -> None:
        db_token = self.auth_repo.get_user_token(token, "email_verification")
        if not db_token or db_token.consumed or db_token.expires_at <= datetime.now(UTC):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired verification token")
        user = self.user_repo.get_by_id(db_token.user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        user.is_verified = True
        db_token.consumed = True
        self.db.add_all([user, db_token])
        self.db.commit()

    def list_sessions(self, user_id: int) -> list[RefreshSession]:
        return self.auth_repo.list_user_sessions(user_id)

    def revoke_session(self, user_id: int, session_id: int) -> None:
        session = self.db.get(RefreshSession, session_id)
        if not session or session.user_id != user_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
        self.auth_repo.revoke_session(session)

    def _build_tokens(self, user_id: int) -> TokenPair:
        access_token = create_token(
            subject=str(user_id),
            expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
            token_type="access",
        )
        token_id = secrets.token_hex(16)
        refresh_expires = datetime.now(UTC) + timedelta(days=settings.refresh_token_expire_days)
        refresh_token = create_token(
            subject=str(user_id),
            expires_delta=timedelta(days=settings.refresh_token_expire_days),
            token_type="refresh",
            extra={"jti": token_id},
        )
        self.auth_repo.create_refresh_session(
            RefreshSession(user_id=user_id, token_id=token_id, expires_at=refresh_expires, revoked=False)
        )
        return TokenPair(access_token=access_token, refresh_token=refresh_token)

    def _issue_user_token(self, user_id: int, token_type: str, ttl: timedelta) -> UserToken:
        token = secrets.token_urlsafe(32)
        return self.auth_repo.save_user_token(
            UserToken(user_id=user_id, token=token, token_type=token_type, expires_at=datetime.now(UTC) + ttl)
        )

