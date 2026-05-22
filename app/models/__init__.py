"""
Model exports — enums and types used across the application.

With the move to raw asyncpg, ORM model classes are removed.
Only enums and shared types are exported from this package.
"""

from app.models.user import (  # noqa: F401
    Gender,
    ActivityLevel,
    FitnessGoal,
    BloodGroup,
)
from app.models.nutrition_log import MealType  # noqa: F401
