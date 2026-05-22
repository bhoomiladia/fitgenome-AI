"""
AIOrchestrator — Central class wiring user context + LLM generation.

Supports automatic fallback across multiple LLM providers:
    OpenRouter → Gemini

Architecture:
    ┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
    │ User Context │────▶│   Prompt     │────▶│  LLM Call       │
    │  (from DB)   │     │  Assembly    │     │  (with fallback)│
    └─────────────┘     └──────────────┘     └──────┬──────────┘
                                                    │
                                             ┌──────▼──────┐
                                             │  Pydantic   │
                                             │  Parsing    │
                                             └─────────────┘
"""

import json
import logging
from typing import TypeVar

from openai import AsyncOpenAI
from pydantic import BaseModel

from app.core.config import settings
from app.core.llm_factory import get_available_llms
from app.schemas.ai_responses import MealPlanResponse, WorkoutPlanResponse
from app.services.prompts import (
    MEAL_PLAN_SYSTEM_PROMPT,
    MEAL_PLAN_USER_PROMPT,
    WORKOUT_SYSTEM_PROMPT,
    WORKOUT_USER_PROMPT,
)

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

# ── Goal-based calorie adjustments & macro strategies ─────

GOAL_CALORIE_ADJUSTMENTS: dict[str, float] = {
    "lose_weight": -500,       # deficit
    "maintain": 0,
    "build_muscle": 300,       # surplus
    "improve_endurance": 100,  # slight surplus
}

GOAL_MACRO_STRATEGIES: dict[str, str] = {
    "lose_weight": "40P/30C/30F — High protein to preserve muscle during deficit",
    "maintain": "30P/40C/30F — Balanced maintenance macros",
    "build_muscle": "30P/45C/25F — Higher carbs to fuel hypertrophy training",
    "improve_endurance": "25P/50C/25F — Carb-focused for endurance performance",
}


def _build_json_schema_prompt(model_class: type[T]) -> str:
    """Generate a JSON schema instruction string from a Pydantic model."""
    schema = model_class.model_json_schema()
    return (
        "You MUST respond ONLY with valid JSON matching this exact schema. "
        "Do NOT include any explanatory text, markdown formatting, or code fences.\n\n"
        f"JSON Schema:\n{json.dumps(schema, indent=2)}"
    )


def _parse_json_response(raw_text: str, model_class: type[T]) -> T:
    """Parse an LLM JSON response into a Pydantic model."""
    text = raw_text.strip()

    # Strip markdown code fences if present
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1]).strip()

    data = json.loads(text)
    return model_class.model_validate(data)


class AIOrchestrator:
    """
    Orchestrates AI generation for workout and meal plans.

    Supports automatic LLM fallback: if the primary provider fails,
    the next available provider in the chain is tried transparently.

    Responsibilities:
        1. Build contextual prompts from user data
        2. Call the LLM with structured output enforcement (with fallback)
        3. Return typed Pydantic responses
    """

    def __init__(self) -> None:
        # ── LLM fallback chain ────────────────────────────
        self.llm_chain: list[tuple[str, AsyncOpenAI, str]] = get_available_llms()

        if not self.llm_chain:
            raise RuntimeError(
                "No LLM providers configured. Set at least one of: "
                "OPENROUTER_API_KEY or GEMINI_API_KEY"
            )

        primary_name = self.llm_chain[0][0]
        fallback_names = [name for name, _, _ in self.llm_chain[1:]]
        logger.info(
            f"AIOrchestrator initialized — primary: {primary_name}, "
            f"fallbacks: {fallback_names or 'none'}"
        )

    # ── LLM Call with Fallback ────────────────────────────

    async def _call_with_fallback(
        self,
        output_schema: type[T],
        system_prompt: str,
        user_prompt: str,
    ) -> T:
        """
        Attempt structured LLM generation across the fallback chain.

        Tries each provider in order. If one fails (rate limit, timeout,
        API error), logs the error and moves to the next.

        Raises RuntimeError if ALL providers fail.
        """
        schema_instruction = _build_json_schema_prompt(output_schema)
        full_system = f"{system_prompt}\n\n{schema_instruction}"

        errors: list[str] = []

        for provider_name, client, model in self.llm_chain:
            try:
                logger.info(f"Attempting generation with '{provider_name}' (model: {model})...")

                response = await client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": full_system},
                        {"role": "user", "content": user_prompt},
                    ],
                    temperature=0.7,
                    max_tokens=4096,
                )

                raw_text = response.choices[0].message.content or ""
                result = _parse_json_response(raw_text, output_schema)
                logger.info(f"Generation succeeded with '{provider_name}'")
                return result

            except Exception as e:
                error_msg = f"{provider_name}: {type(e).__name__}: {e}"
                errors.append(error_msg)
                logger.warning(
                    f"Provider '{provider_name}' failed: {e}. "
                    f"Falling back to next provider..."
                )
                continue

        # All providers failed
        error_summary = "\n".join(f"  • {err}" for err in errors)
        raise RuntimeError(
            f"All LLM providers failed:\n{error_summary}"
        )

    # ── Prompt Assembly ───────────────────────────────────

    @staticmethod
    def _format_workout_history(recent_workouts: list[dict]) -> str:
        """Format recent workout logs into a readable text block."""
        if not recent_workouts:
            return "No recent workout data available (new user)."

        lines = []
        for w in recent_workouts:
            weight_str = f" @ {w['weight_kg']}kg" if w.get("weight_kg") else ""
            lines.append(
                f"  • {w['date']} — {w['exercise']}: "
                f"{w['sets']}×{w['reps']}{weight_str}"
            )
        return "\n".join(lines)

    # ── Workout Generation ────────────────────────────────

    async def generate_workout(
        self,
        user_context: dict,
        preferences: str = "",
    ) -> WorkoutPlanResponse:
        """
        Generate a personalized weekly workout plan with progressive overload.

        Uses the LLM fallback chain: OpenRouter → Gemini.
        """
        profile = user_context["profile"]
        fitness_goal = profile.get("fitness_goal", "maintain")

        # Format recent workout history
        recent_workouts_text = self._format_workout_history(
            user_context.get("recent_workouts", [])
        )

        # Build the system prompt
        metrics = user_context.get("daily_metrics", {})
        system_prompt = WORKOUT_SYSTEM_PROMPT.format(
            full_name=profile.get("full_name", "User"),
            age=profile.get("age", "N/A"),
            gender=profile.get("gender", "N/A"),
            height_cm=profile.get("height_cm", "N/A"),
            weight_kg=profile.get("weight_kg", "N/A"),
            activity_level=profile.get("activity_level", "N/A"),
            fitness_goal=fitness_goal,
            bmr=profile.get("bmr", "N/A"),
            tdee=profile.get("tdee", "N/A"),
            recent_workouts_text=recent_workouts_text,
            avg_steps=metrics.get("avg_steps", "N/A"),
            avg_sleep_hours=metrics.get("avg_sleep_hours", "N/A"),
            user_preferences=preferences or "None specified.",
        )

        # Call LLM with structured output + fallback chain
        result = await self._call_with_fallback(
            WorkoutPlanResponse, system_prompt, WORKOUT_USER_PROMPT
        )
        if result is None:
            raise RuntimeError("LLM returned None instead of WorkoutPlanResponse")

        return result

    # ── Meal Plan Generation ──────────────────────────────

    async def generate_meal_plan(
        self,
        user_context: dict,
        dietary_restrictions: list[str] | None = None,
        cuisine_preference: str = "Indian",
    ) -> MealPlanResponse:
        """
        Generate a personalized multi-day meal plan with Indian
        macro-balancing focus.

        Uses the LLM fallback chain: OpenRouter → Gemini.
        """
        profile = user_context["profile"]
        fitness_goal = profile.get("fitness_goal", "maintain")
        tdee = profile.get("tdee", 2000)

        # Calculate calorie target based on goal
        adjustment = GOAL_CALORIE_ADJUSTMENTS.get(fitness_goal, 0)
        calorie_target = round(tdee + adjustment)

        # Determine macro strategy
        macro_strategy = GOAL_MACRO_STRATEGIES.get(
            fitness_goal,
            "30P/40C/30F — Balanced macros",
        )

        # Format nutrition context
        avg_nutrition = user_context.get("avg_nutrition", {})

        # Format dietary restrictions
        restrictions_text = (
            ", ".join(dietary_restrictions)
            if dietary_restrictions
            else "None specified"
        )

        # Build the system prompt
        system_prompt = MEAL_PLAN_SYSTEM_PROMPT.format(
            full_name=profile.get("full_name", "User"),
            age=profile.get("age", "N/A"),
            gender=profile.get("gender", "N/A"),
            height_cm=profile.get("height_cm", "N/A"),
            weight_kg=profile.get("weight_kg", "N/A"),
            activity_level=profile.get("activity_level", "N/A"),
            fitness_goal=fitness_goal,
            bmr=profile.get("bmr", "N/A"),
            tdee=tdee,
            calorie_target=calorie_target,
            macro_strategy=macro_strategy,
            avg_daily_calories=avg_nutrition.get("avg_daily_calories", "N/A"),
            avg_daily_protein_g=avg_nutrition.get("avg_daily_protein_g", "N/A"),
            avg_daily_carbs_g=avg_nutrition.get("avg_daily_carbs_g", "N/A"),
            avg_daily_fat_g=avg_nutrition.get("avg_daily_fat_g", "N/A"),
            dietary_restrictions=restrictions_text,
            cuisine_preference=cuisine_preference,
        )

        # Call LLM with structured output + fallback chain
        result = await self._call_with_fallback(
            MealPlanResponse, system_prompt, MEAL_PLAN_USER_PROMPT
        )
        if result is None:
            raise RuntimeError("LLM returned None instead of MealPlanResponse")

        return result
