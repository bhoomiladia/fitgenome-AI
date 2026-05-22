"""
Gamification Engine — XP awards, streak tracking, and leveling.

XP Table:
    workout_complete     → 50 XP
    meal_logged          → 10 XP
    scan_food            → 15 XP
    streak_3_day         → 25 XP bonus
    streak_7_day         → 75 XP bonus
    streak_30_day        → 300 XP bonus
    plan_generated       → 20 XP

Level Formula:
    level = floor(sqrt(total_xp / 100)) + 1
    (Level 1: 0 XP, Level 2: 100 XP, Level 5: 1600 XP, Level 10: 8100 XP)
"""

import logging
import math
import uuid
from datetime import date, timedelta

import asyncpg

logger = logging.getLogger(__name__)

# ── XP Awards ─────────────────────────────────────────────

XP_AWARDS = {
    "workout_complete": 50,
    "meal_logged": 10,
    "scan_food": 15,
    "streak_3_day": 25,
    "streak_7_day": 75,
    "streak_30_day": 300,
    "plan_generated": 20,
}

STREAK_BONUSES = {3: "streak_3_day", 7: "streak_7_day", 30: "streak_30_day"}


def _calculate_level(total_xp: int) -> int:
    """Level = floor(sqrt(total_xp / 100)) + 1"""
    if total_xp <= 0:
        return 1
    return int(math.floor(math.sqrt(total_xp / 100))) + 1


def _xp_for_next_level(current_level: int) -> int:
    """XP required to reach the next level."""
    return (current_level) ** 2 * 100


async def award_xp(
    conn: asyncpg.Connection,
    user_id: uuid.UUID,
    source: str,
    description: str = "",
) -> dict:
    """
    Award XP to a user, update streak, and check for level-up.

    Returns a dict with xp_awarded, total_xp, level, streak, leveled_up.
    """
    xp_amount = XP_AWARDS.get(source, 0)
    if xp_amount <= 0:
        return {"xp_awarded": 0}

    # ── Insert XP ledger entry ────────────────────────────
    await conn.execute(
        """
        INSERT INTO xp_ledger (user_id, xp_amount, source, description)
        VALUES ($1, $2, $3, $4)
        """,
        user_id,
        xp_amount,
        source,
        description or None,
    )

    # ── Get or create streak ──────────────────────────────
    streak = await conn.fetchrow(
        "SELECT * FROM user_streaks WHERE user_id = $1",
        user_id,
    )

    today = date.today()

    if not streak:
        await conn.execute(
            """
            INSERT INTO user_streaks (user_id, current_streak, longest_streak, total_xp, level)
            VALUES ($1, 0, 0, 0, 1)
            """,
            user_id,
        )
        streak = await conn.fetchrow(
            "SELECT * FROM user_streaks WHERE user_id = $1",
            user_id,
        )

    # ── Update streak ─────────────────────────────────────
    old_level = streak["level"]
    current_streak = streak["current_streak"]
    longest_streak = streak["longest_streak"]
    total_xp = streak["total_xp"]

    last_activity = streak["last_activity_date"]
    if last_activity:
        delta = (today - last_activity).days
        if delta == 1:
            # Consecutive day
            current_streak += 1
        elif delta == 0:
            # Same day, no streak change
            pass
        else:
            # Streak broken
            current_streak = 1
    else:
        current_streak = 1

    longest_streak = max(longest_streak, current_streak)

    # ── Check streak bonuses ──────────────────────────────
    bonus_xp = 0
    for threshold, bonus_source in STREAK_BONUSES.items():
        if current_streak == threshold:
            bonus_xp = XP_AWARDS[bonus_source]
            await conn.execute(
                """
                INSERT INTO xp_ledger (user_id, xp_amount, source, description)
                VALUES ($1, $2, $3, $4)
                """,
                user_id,
                bonus_xp,
                bonus_source,
                f"{threshold}-day streak bonus!",
            )
            logger.info(f"User {user_id}: {threshold}-day streak bonus +{bonus_xp} XP")
            break

    # ── Update totals ─────────────────────────────────────
    total_xp += xp_amount + bonus_xp
    new_level = _calculate_level(total_xp)
    leveled_up = new_level > old_level

    if leveled_up:
        logger.info(f"User {user_id}: LEVEL UP! {old_level} → {new_level}")

    await conn.execute(
        """
        UPDATE user_streaks
        SET current_streak = $1,
            longest_streak = $2,
            last_activity_date = $3,
            total_xp = $4,
            level = $5,
            updated_at = NOW()
        WHERE user_id = $6
        """,
        current_streak,
        longest_streak,
        today,
        total_xp,
        new_level,
        user_id,
    )

    return {
        "xp_awarded": xp_amount + bonus_xp,
        "total_xp": total_xp,
        "level": new_level,
        "current_streak": current_streak,
        "longest_streak": longest_streak,
        "leveled_up": leveled_up,
        "xp_to_next_level": _xp_for_next_level(new_level) - total_xp,
    }
