"""
User enums and data types.

Enums are kept for use in Pydantic schemas and biometrics calculations.
The actual DB columns use PostgreSQL enum types defined in schema.sql.
"""

import enum


class Gender(str, enum.Enum):
    male = "male"
    female = "female"
    other = "other"


class ActivityLevel(str, enum.Enum):
    sedentary = "sedentary"
    light = "light"
    moderate = "moderate"
    active = "active"
    very_active = "very_active"


class FitnessGoal(str, enum.Enum):
    lose_weight = "lose_weight"
    maintain = "maintain"
    build_muscle = "build_muscle"
    improve_endurance = "improve_endurance"


class BloodGroup(str, enum.Enum):
    A_pos = "A+"
    A_neg = "A-"
    B_pos = "B+"
    B_neg = "B-"
    AB_pos = "AB+"
    AB_neg = "AB-"
    O_pos = "O+"
    O_neg = "O-"
