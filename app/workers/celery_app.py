"""
Celery application factory.

Uses Redis as both broker and result backend.
Beat schedule runs the behavioral pivot analysis every 24 hours.
"""

from celery import Celery
from celery.schedules import crontab

from app.core.config import settings

celery_app = Celery(
    "fitgenome",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

# ── Configuration ─────────────────────────────────────────

celery_app.conf.update(
    # Serialization
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],

    # Timezone
    timezone="UTC",
    enable_utc=True,

    # Task discovery
    task_routes={
        "app.workers.tasks.*": {"queue": "default"},
    },

    # Beat schedule — run analysis daily at 3:00 AM UTC
    beat_schedule={
        "behavioral-pivot-analysis": {
            "task": "app.workers.tasks.behavioral_pivot.analyze_all_users",
            "schedule": crontab(hour=3, minute=0),
        },
    },
)

# ── Auto-discover tasks ──────────────────────────────────
celery_app.autodiscover_tasks(["app.workers.tasks"])
