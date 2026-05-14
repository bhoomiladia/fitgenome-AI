"""
Behavioral Pivot Engine — 7-day user analysis task.

Runs via Celery Beat every 24 hours. For each user whose
last_pivot_at is null or > 7 days ago:

1. Calculate adherence_rate  (logs / planned)
2. Calculate weight_delta    (current - 7 days ago)
3. Apply pivot logic:
   - Low adherence → Deload Week (reduce volume)
   - Stagnant weight + high adherence → Reduce calories 10%
   - On track → No changes
"""

import logging
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────

ADHERENCE_THRESHOLD = 0.70      # 70% — below this triggers deload
WEIGHT_STAGNANT_KG = 0.3        # ±0.3 kg considered stagnant
DELOAD_VOLUME_MODIFIER = 0.6    # 60% of normal volume
DELOAD_DURATION_DAYS = 7
CALORIE_REDUCTION_FACTOR = 0.90 # 10% reduction
EXPECTED_DAILY_MEALS = 3        # breakfast + lunch + dinner


def _get_sync_session() -> Session:
    """
    Create a synchronous SQLAlchemy session for Celery tasks.

    Celery tasks run outside the async FastAPI context, so we use
    a synchronous engine/session here.
    """
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from app.core.config import settings

    # Convert async URL to sync
    sync_url = settings.DATABASE_URL.replace(
        "postgresql+asyncpg", "postgresql+psycopg2"
    )

    engine = create_engine(sync_url, pool_pre_ping=True)
    SessionLocal = sessionmaker(bind=engine)
    return SessionLocal()


@celery_app.task(name="app.workers.tasks.behavioral_pivot.analyze_all_users")
def analyze_all_users():
    """
    Entry point: find all users due for pivot analysis and process them.

    Triggered daily at 3 AM UTC by Celery Beat.
    """
    from app.models.user import User
    from app.models.user_persona import UserPersona

    session = _get_sync_session()

    try:
        cutoff = datetime.now(timezone.utc) - timedelta(days=7)

        # Find users who need analysis:
        # - No persona yet (never analyzed)
        # - Or last_pivot_at > 7 days ago
        users = session.execute(
            select(User).where(User.is_onboarded == True)  # noqa: E712
        ).scalars().all()

        analyzed = 0
        for user in users:
            persona = session.execute(
                select(UserPersona).where(UserPersona.user_id == user.id)
            ).scalar_one_or_none()

            # Skip if analyzed within last 7 days
            if persona and persona.last_pivot_at and persona.last_pivot_at > cutoff:
                continue

            _analyze_single_user(session, user, persona)
            analyzed += 1

        session.commit()
        logger.info(f"Behavioral Pivot Engine: analyzed {analyzed} users")

        return {"analyzed": analyzed}

    except Exception as e:
        session.rollback()
        logger.error(f"Behavioral Pivot Engine failed: {e}", exc_info=True)
        raise

    finally:
        session.close()


def _analyze_single_user(session: Session, user, persona) -> None:
    """
    Analyze a single user's 7-day data and apply pivot logic.
    """
    from app.models.nutrition_log import NutritionLog
    from app.models.daily_metric import DailyMetric
    from app.models.user_persona import UserPersona

    now = datetime.now(timezone.utc)
    seven_days_ago = now - timedelta(days=7)
    today = date.today()

    # ── 1. Calculate adherence_rate ────────────────────────
    # Count nutrition logs in the last 7 days
    log_count = session.execute(
        select(func.count(NutritionLog.id)).where(
            NutritionLog.user_id == user.id,
            NutritionLog.logged_at >= seven_days_ago,
        )
    ).scalar_one()

    expected_logs = EXPECTED_DAILY_MEALS * 7  # 21 expected
    adherence_rate = min(log_count / expected_logs, 1.0) if expected_logs > 0 else 0.0

    # ── 2. Calculate weight_delta ──────────────────────────
    # Current weight from user profile
    current_weight = user.weight_kg or 0.0

    # Try to find weight from 7 days ago via daily metrics
    old_metric = session.execute(
        select(DailyMetric).where(
            DailyMetric.user_id == user.id,
            DailyMetric.date <= (today - timedelta(days=7)),
        ).order_by(DailyMetric.date.desc()).limit(1)
    ).scalar_one_or_none()

    # If no old metric, use current weight (delta = 0)
    old_weight = current_weight
    if old_metric and hasattr(old_metric, "weight_kg") and old_metric.weight_kg:
        old_weight = old_metric.weight_kg

    weight_delta = current_weight - old_weight

    # ── 3. Apply pivot logic ──────────────────────────────

    # Create persona if it doesn't exist
    if not persona:
        persona = UserPersona(
            user_id=user.id,
            workout_volume_modifier=1.0,
            target_calories=user.tdee,
        )
        session.add(persona)

    pivot_action = "none"
    pivot_notes = ""

    if adherence_rate < ADHERENCE_THRESHOLD:
        # Low adherence → Deload Week
        persona.workout_volume_modifier = DELOAD_VOLUME_MODIFIER
        persona.deload_until = today + timedelta(days=DELOAD_DURATION_DAYS)
        pivot_action = "deload"
        pivot_notes = (
            f"Deload Week triggered. Adherence: {adherence_rate:.0%} "
            f"(below {ADHERENCE_THRESHOLD:.0%} threshold). "
            f"Volume reduced to {DELOAD_VOLUME_MODIFIER:.0%} until "
            f"{persona.deload_until}."
        )

    elif abs(weight_delta) < WEIGHT_STAGNANT_KG and adherence_rate >= ADHERENCE_THRESHOLD:
        # High adherence but stagnant weight → Reduce calories
        current_target = persona.target_calories or user.tdee or 2000
        new_target = round(current_target * CALORIE_REDUCTION_FACTOR)
        persona.target_calories = new_target
        pivot_action = "calorie_reduction"
        pivot_notes = (
            f"Metabolism optimization. Adherence: {adherence_rate:.0%}, "
            f"weight delta: {weight_delta:+.1f}kg (stagnant). "
            f"Calories reduced from {current_target:.0f} to {new_target} kcal "
            f"({(1 - CALORIE_REDUCTION_FACTOR):.0%} reduction)."
        )

    else:
        # On track
        # Clear deload if it's expired
        if persona.deload_until and persona.deload_until <= today:
            persona.workout_volume_modifier = 1.0
            persona.deload_until = None
        pivot_action = "on_track"
        pivot_notes = (
            f"On track. Adherence: {adherence_rate:.0%}, "
            f"weight delta: {weight_delta:+.1f}kg."
        )

    # Update tracking fields
    persona.last_pivot_at = now
    persona.pivot_notes = pivot_notes

    # ── 4. Notification logging ───────────────────────────
    # (Push notification integration is a future TODO)
    notification_messages = {
        "deload": (
            "🔄 AI Coach has activated a Deload Week. "
            "Your workout volume has been reduced for recovery."
        ),
        "calorie_reduction": (
            "⚡ AI Coach has optimized your metabolism settings. "
            "Your daily calorie target has been adjusted."
        ),
        "on_track": None,  # No notification needed
    }

    message = notification_messages.get(pivot_action)
    if message:
        logger.info(
            f"[PUSH NOTIFICATION] User {user.id}: {message}"
        )
        # Future: send via Firebase/APNs

    logger.info(
        f"User {user.id}: action={pivot_action}, "
        f"adherence={adherence_rate:.0%}, "
        f"weight_delta={weight_delta:+.1f}kg — {pivot_notes}"
    )
