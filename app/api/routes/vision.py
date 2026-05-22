"""
Vision routes — food image scanning and NutritionLog auto-insertion.
"""

import base64
import logging

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_user
from app.db.base import get_db
from app.models.nutrition_log import MealType
from app.schemas.vision import ScanFoodRequest, ScanFoodResponse, ScannedFoodItem
from app.services.image_quality import validate_and_preprocess
from app.services.vision_scanner import scan_food_image

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/vision", tags=["Vision"])


@router.post(
    "/scan-food",
    response_model=ScanFoodResponse,
    summary="Scan a food image and auto-log nutrition",
    description=(
        "Accepts a base64-encoded food image, validates quality (blur/size), "
        "identifies food items via Gemini Vision (with OpenRouter "
        "fallback), estimates macros using the Indian Food Dataset, and "
        "auto-inserts results into the NutritionLog."
    ),
)
async def scan_food(
    body: ScanFoodRequest,
    current_user: asyncpg.Record = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db),
):
    # ── Validate onboarding ───────────────────────────────
    if not current_user["is_onboarded"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Complete onboarding before scanning food.",
        )

    # ── Decode base64 image ───────────────────────────────
    try:
        image_bytes = base64.b64decode(body.image_base64)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid base64 image data.",
        )

    # ── Image quality pre-check ───────────────────────────
    quality = validate_and_preprocess(image_bytes)

    if not quality.is_valid:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=quality.rejection_reason,
        )

    # ── Vision scanning ───────────────────────────────────
    items, provider = await scan_food_image(quality.resized_bytes)

    if not items:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not identify food items. Please try a clearer photo.",
        )

    # ── Map to NutritionLog and insert ────────────────────
    meal_type = MealType(body.meal_type)
    logs_created = 0

    for item in items:
        await conn.execute(
            """
            INSERT INTO nutrition_logs (user_id, food_item, calories, protein_g, carbs_g, fat_g, meal_type)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            """,
            current_user["id"],
            f"{item.name} ({item.portion})",
            item.calories,
            item.protein_g,
            item.carbs_g,
            item.fat_g,
            meal_type.value,
        )
        logs_created += 1

    logger.info(
        f"Scan complete: {logs_created} items logged for user {current_user['id']} "
        f"via {provider}"
    )

    # ── Build response ────────────────────────────────────
    total_cal = sum(i.calories for i in items)
    total_pro = sum(i.protein_g for i in items)
    total_carb = sum(i.carbs_g for i in items)
    total_fat = sum(i.fat_g for i in items)

    return ScanFoodResponse(
        items=items,
        total_calories=total_cal,
        total_protein_g=total_pro,
        total_carbs_g=total_carb,
        total_fat_g=total_fat,
        provider_used=provider,
        image_quality_score=quality.blur_score,
        items_logged=logs_created,
    )
