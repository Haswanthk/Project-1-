import os
import tempfile
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.core.deps import get_db
from app.main import app as fastapi_app
import app.models  # noqa: F401


@pytest.fixture(scope="session")
def isolated_test_db():
    """
    Creates an isolated temporary SQLite database file for testing.
    Verifies that it CANNOT read or write backend/app.db.
    """
    temp_dir = tempfile.mkdtemp(prefix="test_app_db_")
    db_path = os.path.join(temp_dir, "test_isolated.db")
    db_url = f"sqlite:///{db_path}"

    assert "backend/app.db" not in db_path.replace("\\", "/"), "FATAL: Test DB path conflicts with production DB!"

    test_engine = create_engine(db_url, connect_args={"check_same_thread": False, "timeout": 30.0})
    Base.metadata.create_all(bind=test_engine)

    TestingSessionLocal = sessionmaker(bind=test_engine, autoflush=False, autocommit=False)

    yield TestingSessionLocal, test_engine, db_path

    test_engine.dispose()
    try:
        if os.path.exists(db_path):
            os.remove(db_path)
        if os.path.exists(temp_dir):
            os.rmdir(temp_dir)
    except Exception:
        pass


@pytest.fixture
def db_session(isolated_test_db):
    TestingSessionLocal, _, _ = isolated_test_db
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture
def client(isolated_test_db):
    TestingSessionLocal, _, _ = isolated_test_db

    def override_get_db():
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()

    fastapi_app.dependency_overrides[get_db] = override_get_db
    with TestClient(fastapi_app) as test_client:
        yield test_client
    fastapi_app.dependency_overrides.clear()
