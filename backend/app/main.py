from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import Base, engine
from app.core.security_headers import SecurityHeadersMiddleware
from app.realtime.ws_manager import ws_manager
import app.models  # noqa: F401 – registers all ORM models with Base.metadata


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    if "sqlite" in settings.database_url:
        with engine.connect() as conn:
            try:
                from sqlalchemy import text
                cols = [r[1] for r in conn.execute(text("PRAGMA table_info(users)")).fetchall()]
                if "updated_at" not in cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN updated_at DATETIME"))
                    conn.commit()
            except Exception:
                pass
    yield
    await ws_manager.close_all()


app = FastAPI(title=settings.app_name, version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_frontend_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(SecurityHeadersMiddleware)

Instrumentator().instrument(app).expose(app, endpoint="/metrics")
app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.get("/")
def root() -> dict[str, str]:
    return {
        "name": settings.app_name,
        "status": "online",
        "docs": "/docs",
        "health": "/health",
        "api_v1": settings.api_v1_prefix,
    }


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
