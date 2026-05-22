"""
Admin routes — behavioral pivot analysis and system management.
"""

import logging
from datetime import date, datetime, timedelta, timezone

import asyncpg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.deps import get_current_user
from app.db.base import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["Admin"])

# ── Constants ─────────────────────────────────────────────

ADHERENCE_THRESHOLD = 0.70
WEIGHT_STAGNANT_KG = 0.3
DELOAD_VOLUME_MODIFIER = 0.6
DELOAD_DURATION_DAYS = 7
CALORIE_REDUCTION_FACTOR = 0.90
EXPECTED_DAILY_MEALS = 3


class PivotAnalysisResponse(BaseModel):
    analyzed: int
    results: list[dict] = []


@router.post(
    "/run-pivot-analysis",
    response_model=PivotAnalysisResponse,
    summary="Run behavioral pivot analysis for all eligible users",
    description=(
        "Analyzes 7-day adherence and weight trends for onboarded users. "
        "Applies deload or calorie reduction pivots as needed. "
        "Call this via a cron job or manually."
    ),
)
async def run_pivot_analysis(
    current_user: asyncpg.Record = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db),
):
    """
    Entry point: find all users due for pivot analysis and process them.
    Replaces the former Celery Beat task.
    """
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=7)
    today = date.today()
    seven_days_ago = now - timedelta(days=7)

    # Find onboarded users
    users = await conn.fetch(
        "SELECT * FROM users WHERE is_onboarded = TRUE"
    )

    analyzed = 0
    results = []

    for user in users:
        user_id = user["id"]

        # Check persona
        persona = await conn.fetchrow(
            "SELECT * FROM user_personas WHERE user_id = $1",
            user_id,
        )

        # Skip if analyzed within last 7 days
        if persona and persona["last_pivot_at"] and persona["last_pivot_at"] > cutoff:
            continue

        # ── 1. Calculate adherence_rate ────────────────────
        log_count = await conn.fetchval(
            """
            SELECT COUNT(id) FROM nutrition_logs
            WHERE user_id = $1 AND logged_at >= $2
            """,
            user_id,
            seven_days_ago,
        )

        expected_logs = EXPECTED_DAILY_MEALS * 7  # 21 expected
        adherence_rate = min(log_count / expected_logs, 1.0) if expected_logs > 0 else 0.0

        # ── 2. Calculate weight_delta ──────────────────────
        current_weight = user["weight_kg"] or 0.0

        old_metric = await conn.fetchrow(
            """
            SELECT weight_kg FROM daily_metrics
            WHERE user_id = $1 AND date <= $2
            ORDER BY date DESC LIMIT 1
            """,
            user_id,
            today - timedelta(days=7),
        )

        old_weight = current_weight
        if old_metric and old_metric["weight_kg"]:
            old_weight = old_metric["weight_kg"]

        weight_delta = current_weight - old_weight

        # ── 3. Apply pivot logic ──────────────────────────
        pivot_action = "none"
        pivot_notes = ""

        if not persona:
            await conn.execute(
                """
                INSERT INTO user_personas (user_id, workout_volume_modifier, target_calories)
                VALUES ($1, 1.0, $2)
                """,
                user_id,
                user["tdee"],
            )
            persona = await conn.fetchrow(
                "SELECT * FROM user_personas WHERE user_id = $1",
                user_id,
            )

        if adherence_rate < ADHERENCE_THRESHOLD:
            # Low adherence → Deload Week
            deload_until = today + timedelta(days=DELOAD_DURATION_DAYS)
            await conn.execute(
                """
                UPDATE user_personas
                SET workout_volume_modifier = $1, deload_until = $2,
                    last_pivot_at = $3, pivot_notes = $4, updated_at = NOW()
                WHERE user_id = $5
                """,
                DELOAD_VOLUME_MODIFIER,
                deload_until,
                now,
                f"Deload Week triggered. Adherence: {adherence_rate:.0%} "
                f"(below {ADHERENCE_THRESHOLD:.0%} threshold). "
                f"Volume reduced to {DELOAD_VOLUME_MODIFIER:.0%} until {deload_until}.",
                user_id,
            )
            pivot_action = "deload"
            pivot_notes = f"Adherence {adherence_rate:.0%}, deload until {deload_until}"

        elif abs(weight_delta) < WEIGHT_STAGNANT_KG and adherence_rate >= ADHERENCE_THRESHOLD:
            # High adherence but stagnant weight → Reduce calories
            current_target = persona["target_calories"] or user["tdee"] or 2000
            new_target = round(current_target * CALORIE_REDUCTION_FACTOR)
            await conn.execute(
                """
                UPDATE user_personas
                SET target_calories = $1, last_pivot_at = $2,
                    pivot_notes = $3, updated_at = NOW()
                WHERE user_id = $4
                """,
                new_target,
                now,
                f"Calories reduced from {current_target:.0f} to {new_target} kcal. "
                f"Adherence: {adherence_rate:.0%}, weight delta: {weight_delta:+.1f}kg (stagnant).",
                user_id,
            )
            pivot_action = "calorie_reduction"
            pivot_notes = f"Calories {current_target:.0f} → {new_target}"

        else:
            # On track — clear deload if expired
            if persona["deload_until"] and persona["deload_until"] <= today:
                await conn.execute(
                    """
                    UPDATE user_personas
                    SET workout_volume_modifier = 1.0, deload_until = NULL,
                        last_pivot_at = $1, pivot_notes = $2, updated_at = NOW()
                    WHERE user_id = $3
                    """,
                    now,
                    f"On track. Adherence: {adherence_rate:.0%}, weight delta: {weight_delta:+.1f}kg.",
                    user_id,
                )
            else:
                await conn.execute(
                    """
                    UPDATE user_personas
                    SET last_pivot_at = $1, pivot_notes = $2, updated_at = NOW()
                    WHERE user_id = $3
                    """,
                    now,
                    f"On track. Adherence: {adherence_rate:.0%}, weight delta: {weight_delta:+.1f}kg.",
                    user_id,
                )
            pivot_action = "on_track"
            pivot_notes = f"Adherence {adherence_rate:.0%}, delta {weight_delta:+.1f}kg"

        analyzed += 1
        results.append({
            "user_id": str(user_id),
            "action": pivot_action,
            "notes": pivot_notes,
        })

        logger.info(
            f"User {user_id}: action={pivot_action}, "
            f"adherence={adherence_rate:.0%}, "
            f"weight_delta={weight_delta:+.1f}kg"
        )

    logger.info(f"Behavioral Pivot Engine: analyzed {analyzed} users")

    return PivotAnalysisResponse(analyzed=analyzed, results=results)
