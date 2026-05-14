"""
Re-export all ORM models so Alembic and the application
can discover them from a single import.
"""

from app.models.user import User  # noqa: F401
from app.models.workout_log import WorkoutLog  # noqa: F401
from app.models.nutrition_log import NutritionLog  # noqa: F401
from app.models.daily_metric import DailyMetric  # noqa: F401
from app.models.user_persona import UserPersona  # noqa: F401
from app.models.gamification import XPLedger, UserStreak  # noqa: F401
from app.models.ai_plans import GeneratedPlan  # noqa: F401
from app.models.chat_message import ChatMessage  # noqa: F401
