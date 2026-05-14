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

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.gamification import UserStreak, XPLedger

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
    db: AsyncSession,
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
    entry = XPLedger(
        user_id=user_id,
        xp_amount=xp_amount,
        source=source,
        description=description,
    )
    db.add(entry)

    # ── Get or create streak ──────────────────────────────
    streak = await db.execute(
        select(UserStreak).where(UserStreak.user_id == user_id)
    )
    streak = streak.scalar_one_or_none()

    if not streak:
        streak = UserStreak(user_id=user_id)
        db.add(streak)
        await db.flush()

    # ── Update streak ─────────────────────────────────────
    today = date.today()
    old_level = streak.level

    if streak.last_activity_date:
        delta = (today - streak.last_activity_date).days
        if delta == 1:
            # Consecutive day
            streak.current_streak += 1
        elif delta == 0:
            # Same day, no streak change
            pass
        else:
            # Streak broken
            streak.current_streak = 1
    else:
        streak.current_streak = 1

    streak.last_activity_date = today
    streak.longest_streak = max(streak.longest_streak, streak.current_streak)

    # ── Check streak bonuses ──────────────────────────────
    bonus_xp = 0
    for threshold, bonus_source in STREAK_BONUSES.items():
        if streak.current_streak == threshold:
            bonus_xp = XP_AWARDS[bonus_source]
            bonus_entry = XPLedger(
                user_id=user_id,
                xp_amount=bonus_xp,
                source=bonus_source,
                description=f"{threshold}-day streak bonus!",
            )
            db.add(bonus_entry)
            logger.info(f"User {user_id}: {threshold}-day streak bonus +{bonus_xp} XP")
            break

    # ── Update totals ─────────────────────────────────────
    streak.total_xp += xp_amount + bonus_xp
    streak.level = _calculate_level(streak.total_xp)
    leveled_up = streak.level > old_level

    if leveled_up:
        logger.info(f"User {user_id}: LEVEL UP! {old_level} → {streak.level}")

    await db.flush()

    return {
        "xp_awarded": xp_amount + bonus_xp,
        "total_xp": streak.total_xp,
        "level": streak.level,
        "current_streak": streak.current_streak,
        "longest_streak": streak.longest_streak,
        "leveled_up": leveled_up,
        "xp_to_next_level": _xp_for_next_level(streak.level) - streak.total_xp,
    }
