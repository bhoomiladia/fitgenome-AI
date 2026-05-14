"""
AIOrchestrator — Central class wiring Pinecone retrieval + LLM generation.

Supports automatic fallback across multiple LLM providers:
    Gemini → Groq

Architecture:
    ┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
    │ User Context │────▶│   Prompt     │────▶│  LLM Call       │
    │  (from DB)   │     │  Assembly    │     │  (with fallback)│
    └─────────────┘     └──────┬───────┘     └──────┬──────────┘
                               │                     │
                        ┌──────▼───────┐      ┌──────▼──────┐
                        │  Pinecone    │      │  Pydantic   │
                        │  Retrieval   │      │  Parsing    │
                        └──────────────┘      └─────────────┘
"""

import logging
from typing import TypeVar

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from pinecone import Pinecone
from pydantic import BaseModel

from app.core.config import settings
from app.core.llm_factory import get_available_llms, _key_is_set
from app.schemas.ai_responses import MealPlanResponse, WorkoutPlanResponse
from app.services.cache import get_cached_plan, set_cached_plan
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


class AIOrchestrator:
    """
    Orchestrates RAG-powered AI generation for workout and meal plans.

    Supports automatic LLM fallback: if the primary provider fails,
    the next available provider in the chain is tried transparently.

    Responsibilities:
        1. Embed queries and retrieve relevant documents from Pinecone
        2. Build contextual prompts from user data + retrieved docs
        3. Call the LLM with structured output enforcement (with fallback)
        4. Return typed Pydantic responses
    """

    def __init__(self) -> None:
        # ── LLM fallback chain ────────────────────────────
        self.llm_chain: list[tuple[str, BaseChatModel]] = get_available_llms()

        if not self.llm_chain:
            raise RuntimeError(
                "No LLM providers configured. Set at least one of: "
                "GEMINI_API_KEY or GROQ_API_KEY"
            )

        primary_name = self.llm_chain[0][0]
        fallback_names = [name for name, _ in self.llm_chain[1:]]
        logger.info(
            f"AIOrchestrator initialized — primary: {primary_name}, "
            f"fallbacks: {fallback_names or 'none'}"
        )

        # ── Embeddings (Google Gemini) ────
        if _key_is_set(settings.GEMINI_API_KEY):
            self.embeddings = GoogleGenerativeAIEmbeddings(
                model="models/text-embedding-004",
                google_api_key=settings.GEMINI_API_KEY,
            )
        else:
            self.embeddings = None
            logger.warning(
                "GEMINI_API_KEY not set — Pinecone retrieval will be unavailable. "
                "RAG will generate based on prompt expertise only."
            )

        # ── Pinecone ──────────────────────────────────────
        if settings.PINECONE_API_KEY:
            try:
                self.pc = Pinecone(api_key=settings.PINECONE_API_KEY)
                self.index = self.pc.Index(settings.PINECONE_INDEX_NAME)
            except Exception as e:
                logger.warning(f"Failed to initialize Pinecone: {e}. RAG retrieval disabled.")
                self.pc = None
                self.index = None
        else:
            self.pc = None
            self.index = None
            logger.warning("Pinecone API key not set — RAG retrieval disabled.")

    # ── LLM Call with Fallback ────────────────────────────

    async def _call_with_fallback(
        self,
        output_schema: type[T],
        messages: list,
    ) -> T:
        """
        Attempt structured LLM generation across the fallback chain.

        Tries each provider in order. If one fails (rate limit, timeout,
        API error), logs the error and moves to the next.

        Raises RuntimeError if ALL providers fail.
        """
        errors: list[str] = []

        for provider_name, llm in self.llm_chain:
            try:
                logger.info(f"Attempting generation with '{provider_name}'...")
                structured_llm = llm.with_structured_output(output_schema)
                response = await structured_llm.ainvoke(messages)
                if response is None:
                    raise ValueError(f"{provider_name} returned None (failed to parse structured output).")
                logger.info(f"Generation succeeded with '{provider_name}'")
                return response

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

    # ── Retrieval ─────────────────────────────────────────

    def _retrieve_context(self, query: str, top_k: int = 5) -> str:
        """
        Embed the query and retrieve the top-k most relevant
        document chunks from Pinecone.

        Returns a formatted string of retrieved passages ready
        for prompt injection.
        """
        if not self.embeddings or not self.index:
            return "Research retrieval unavailable — generating based on training expertise."

        try:
            query_embedding = self.embeddings.embed_query(query)

            results = self.index.query(
                vector=query_embedding,
                top_k=top_k,
                include_metadata=True,
            )

            if not results.get("matches"):
                return "No relevant research documents found."

            passages = []
            for i, match in enumerate(results["matches"], 1):
                metadata = match.get("metadata", {})
                text = metadata.get("text", "")
                source = metadata.get("source", "Unknown")
                score = match.get("score", 0)
                passages.append(
                    f"[{i}] (relevance: {score:.2f}, source: {source})\n{text}"
                )

            return "\n\n".join(passages)

        except Exception as e:
            logger.warning(f"Pinecone retrieval failed: {e}")
            return "Research retrieval unavailable — generating based on training expertise."

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

        Checks Redis cache first. Uses the LLM fallback chain: OpenAI → Gemini → Groq.
        """
        profile = user_context["profile"]
        fitness_goal = profile.get("fitness_goal", "maintain")

        # ── Check Redis cache ─────────────────────────────
        cache_context = {
            "goal": fitness_goal,
            "weight": profile.get("weight_kg"),
            "activity": profile.get("activity_level"),
            "prefs": preferences,
        }
        user_id = str(profile.get("user_id", "unknown"))

        cached = await get_cached_plan("workout", user_id, cache_context)
        if cached:
            logger.info("Returning cached workout plan")
            return WorkoutPlanResponse(**cached)

        # Retrieve relevant research
        retrieval_query = (
            f"progressive overload workout programming for "
            f"{fitness_goal} {profile.get('activity_level', 'moderate')} "
            f"activity level"
        )
        retrieved_docs = self._retrieve_context(retrieval_query)

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
            retrieved_docs=retrieved_docs,
            user_preferences=preferences or "None specified.",
        )

        # Call LLM with structured output + fallback chain
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=WORKOUT_USER_PROMPT),
        ]

        result = await self._call_with_fallback(WorkoutPlanResponse, messages)
        if result is None:
            raise RuntimeError("LLM returned None instead of WorkoutPlanResponse")

        # ── Cache the result ──────────────────────────────
        await set_cached_plan("workout", user_id, cache_context, result.model_dump())

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

        Checks Redis cache first. Uses the LLM fallback chain: OpenAI → Gemini → Groq.
        """
        profile = user_context["profile"]
        fitness_goal = profile.get("fitness_goal", "maintain")
        tdee = profile.get("tdee", 2000)

        # ── Check Redis cache ─────────────────────────────
        cache_context = {
            "goal": fitness_goal,
            "tdee": tdee,
            "cuisine": cuisine_preference,
            "restrictions": sorted(dietary_restrictions or []),
        }
        user_id = str(profile.get("user_id", "unknown"))

        cached = await get_cached_plan("meal", user_id, cache_context)
        if cached:
            logger.info("Returning cached meal plan")
            return MealPlanResponse(**cached)

        # Calculate calorie target based on goal
        adjustment = GOAL_CALORIE_ADJUSTMENTS.get(fitness_goal, 0)
        calorie_target = round(tdee + adjustment)

        # Determine macro strategy
        macro_strategy = GOAL_MACRO_STRATEGIES.get(
            fitness_goal,
            "30P/40C/30F — Balanced macros",
        )

        # Retrieve relevant research
        retrieval_query = (
            f"Indian nutrition meal planning {cuisine_preference} "
            f"macro balancing for {fitness_goal} "
            f"{calorie_target} calories"
        )
        retrieved_docs = self._retrieve_context(retrieval_query)

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
            retrieved_docs=retrieved_docs,
        )

        # Call LLM with structured output + fallback chain
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=MEAL_PLAN_USER_PROMPT),
        ]

        result = await self._call_with_fallback(MealPlanResponse, messages)
        if result is None:
            raise RuntimeError("LLM returned None instead of MealPlanResponse")

        # ── Cache the result ──────────────────────────────
        await set_cached_plan("meal", user_id, cache_context, result.model_dump())

        return result
