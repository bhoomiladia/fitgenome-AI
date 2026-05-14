"""
AI Coach chat route — conversational fitness coaching powered by LLM.
"""

import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.base import get_db
from app.models.gamification import UserStreak
from app.models.nutrition_log import NutritionLog
from app.models.chat_message import ChatMessage
from app.models.user import User
from app.models.workout_log import WorkoutLog
from app.services.user_context import build_user_context

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["AI Coach"])


# ── Schemas ───────────────────────────────────────────────


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    history: list[dict[str, str]] = Field(default_factory=list)


class ChatResponse(BaseModel):
    reply: str
    suggestions: list[str] = []


# ── Coaching System Prompt ────────────────────────────────

COACH_SYSTEM_PROMPT = """You are FitGenome AI Coach — a friendly, knowledgeable fitness and nutrition coach.

Your personality:
- Warm, encouraging, and motivational
- Use emojis sparingly for engagement
- Provide specific, actionable advice
- Reference the user's actual data when available
- Focus on Indian cuisine and culturally relevant fitness advice
- Keep responses concise (2-4 sentences for simple questions, more for complex ones)

User Context:
{user_context}

Guidelines:
- For workout questions: suggest specific exercises, sets, reps based on their goal
- For nutrition questions: recommend Indian foods with macro breakdowns
- For recovery: suggest sleep, stretching, and active recovery strategies
- For motivation: reference their streak, XP, and progress
- Always be evidence-based and safety-conscious
- Never give medical advice; suggest consulting a doctor for health concerns
"""


# ── Fallback Responses ────────────────────────────────────


def _fallback_response(message: str, user: User, streak_days: int) -> ChatResponse:
    """Context-aware template responses when LLM is unavailable."""
    lq = message.lower()

    name = user.full_name.split()[0] if user.full_name else "there"
    goal = user.fitness_goal.value if user.fitness_goal else "stay fit"
    tdee = user.tdee or 2000
    weight = user.weight_kg or 70
    protein_target = round(weight * 1.8)

    if any(w in lq for w in ["workout", "exercise", "train", "adjust", "gym"]):
        reply = (
            f"Based on your goal to {goal.replace('_', ' ')}, I'd recommend focusing on "
            f"compound movements like squats, deadlifts, and bench press. Aim for progressive "
            f"overload — increase weight by 2.5kg when you can complete all reps with good form. "
            f"Try generating a fresh AI workout plan from the Workout tab! 💪"
        )
    elif any(w in lq for w in ["eat", "food", "meal", "diet", "nutrition", "hungry", "protein"]):
        reply = (
            f"Hey {name}! Your TDEE is ~{round(tdee)} kcal. Aim for {protein_target}g protein daily. "
            f"Great Indian protein sources: paneer bhurji (25g/200g), dal tadka (18g/bowl), "
            f"egg bhurji (18g/3 eggs), chicken curry (35g/200g). Try scanning your meals "
            f"with the camera for automatic macro tracking! 🥗"
        )
    elif any(w in lq for w in ["sleep", "rest", "recovery", "tired", "sore"]):
        reply = (
            f"Recovery is crucial for progress, {name}! Aim for 7-9 hours of sleep. "
            f"Try warm turmeric milk (haldi doodh) before bed — curcumin helps reduce "
            f"inflammation. For sore muscles, consider light stretching or a 20-min walk. "
            f"Your body builds muscle during rest, not during training! 😴"
        )
    elif any(w in lq for w in ["progress", "weight", "result", "change"]):
        streak_msg = f"You're on a {streak_days}-day streak! " if streak_days > 0 else ""
        reply = (
            f"{streak_msg}Consistency is the #1 predictor of fitness success. "
            f"Check the Progress tab for your Digital Twin projection — it shows "
            f"your predicted body composition over the next 30 days based on your "
            f"current habits. Keep logging your meals and workouts! 📈"
        )
    elif any(w in lq for w in ["hello", "hi", "hey", "sup", "what's up"]):
        reply = (
            f"Hey {name}! 👋 I'm your FitGenome AI coach. I can help with:\n"
            f"• 💪 Workout adjustments and exercise tips\n"
            f"• 🥗 Nutrition advice with Indian food focus\n"
            f"• 😴 Recovery and sleep optimization\n"
            f"• 📈 Progress tracking insights\n"
            f"What would you like to work on today?"
        )
    else:
        reply = (
            f"Great question, {name}! Based on your profile — goal: {goal.replace('_', ' ')}, "
            f"TDEE: {round(tdee)} kcal — I'd suggest maintaining consistency with both "
            f"training and nutrition. Aim for {protein_target}g protein daily and "
            f"progressive overload in your workouts. Feel free to ask me about specific "
            f"exercises, meal ideas, or recovery strategies! 🎯"
        )

    return ChatResponse(
        reply=reply,
        suggestions=[
            "💪 Adjust my workout",
            "🥗 What should I eat?",
            "😴 Recovery tips",
            "📈 Track my progress",
        ],
    )


# ── Endpoint ──────────────────────────────────────────────


@router.post(
    "",
    response_model=ChatResponse,
    summary="Send a message to the AI fitness coach",
)
async def chat_with_coach(
    body: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Get streak for context
    streak_result = await db.execute(
        select(UserStreak).where(UserStreak.user_id == current_user.id)
    )
    streak = streak_result.scalar_one_or_none()
    streak_days = streak.current_streak if streak else 0

    # Try LLM-powered response
    has_llm = any([
        settings.GEMINI_API_KEY,
        settings.GROQ_API_KEY,
    ])

    if has_llm:
        try:
            user_context = await build_user_context(current_user, db)

            import json
            context_str = json.dumps(user_context, default=str, indent=2)

            # Use the AI orchestrator's LLM with coaching prompt
            from app.core.llm_factory import get_available_llms
            available_llms = get_available_llms()
            if not available_llms:
                raise RuntimeError("No LLM available")
            llm = available_llms[0][1]

            system_prompt = COACH_SYSTEM_PROMPT.format(user_context=context_str)

            from langchain_core.messages import HumanMessage, SystemMessage, AIMessage

            messages = [SystemMessage(content=system_prompt)]
            
            # Add conversation history
            for msg in body.history[-10:]: # keep last 10 messages for context window
                if msg.get("role") == "user":
                    messages.append(HumanMessage(content=msg.get("text", "")))
                elif msg.get("role") == "coach":
                    messages.append(AIMessage(content=msg.get("text", "")))
                    
            messages.append(HumanMessage(content=body.message))

            response = await llm.ainvoke(messages)
            reply_text = response.content

            # PERSIST: Save user message and coach reply
            db.add_all([
                ChatMessage(user_id=current_user.id, role="user", content=body.message),
                ChatMessage(user_id=current_user.id, role="coach", content=reply_text)
            ])
            await db.flush()

            return ChatResponse(
                reply=reply_text,
                suggestions=[
                    "💪 Adjust my workout",
                    "🥗 What should I eat?",
                    "😴 Recovery tips",
                    "📈 Track my progress",
                ],
            )

        except Exception as e:
            logger.warning(f"LLM chat failed, falling back to templates: {e}")
            resp = _fallback_response(body.message, current_user, streak_days)
            db.add_all([
                ChatMessage(user_id=current_user.id, role="user", content=body.message),
                ChatMessage(user_id=current_user.id, role="coach", content=resp.reply)
            ])
            await db.flush()
            return resp

    # Fallback to template responses
    resp = _fallback_response(body.message, current_user, streak_days)
    db.add_all([
        ChatMessage(user_id=current_user.id, role="user", content=body.message),
        ChatMessage(user_id=current_user.id, role="coach", content=resp.reply)
    ])
    await db.flush()
    return resp


@router.get("/history", response_model=list[dict])
async def get_chat_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fetch the chat history for the current user."""
    stmt = (
        select(ChatMessage)
        .where(ChatMessage.user_id == current_user.id)
        .order_by(ChatMessage.created_at.asc())
    )
    result = await db.execute(stmt)
    messages = result.scalars().all()
    
    return [
        {
            "id": str(msg.id),
            "role": msg.role,
            "text": msg.content,
            "timestamp": msg.created_at,
        }
        for msg in messages
    ]
