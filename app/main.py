"""
FitGenome AI — FastAPI application entrypoint.
"""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import auth, onboarding, ai, vision, gamification, progress, analytics, dashboard, chat, logs, admin
from app.core.config import settings
from app.db import base


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle hook."""
    # ── Startup ───────────────────────────────────────────
    await base.init_pool()

    # Run schema.sql to create tables if they don't exist
    schema_path = Path(__file__).resolve().parent.parent / "schema.sql"
    if schema_path.exists():
        schema_sql = schema_path.read_text()
        async with base.pool.acquire() as conn:
            await conn.execute(schema_sql)

    yield

    # ── Shutdown ──────────────────────────────────────────
    await base.close_pool()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version="0.2.0",
    description="Personalized fitness & nutrition platform powered by AI.",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────
app.include_router(auth.router, prefix=settings.API_V1_PREFIX)
app.include_router(onboarding.router, prefix=settings.API_V1_PREFIX)
app.include_router(ai.router, prefix=settings.API_V1_PREFIX)
app.include_router(vision.router, prefix=settings.API_V1_PREFIX)
app.include_router(gamification.router, prefix=settings.API_V1_PREFIX)
app.include_router(progress.router, prefix=settings.API_V1_PREFIX)
app.include_router(analytics.router, prefix=settings.API_V1_PREFIX)
app.include_router(dashboard.router, prefix=settings.API_V1_PREFIX)
app.include_router(chat.router, prefix=settings.API_V1_PREFIX)
app.include_router(logs.router, prefix=settings.API_V1_PREFIX)
app.include_router(admin.router, prefix=settings.API_V1_PREFIX)


# ── Health check ──────────────────────────────────────────
@app.get("/health", tags=["Infrastructure"])
async def health_check():
    return {"status": "healthy", "service": settings.PROJECT_NAME}
