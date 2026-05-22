"""
Vision Scanner — Gemini Vision primary, OpenRouter fallback.

Sends food images to Gemini Vision with Indian Food Dataset instructions.
If Gemini latency exceeds the threshold, falls back to OpenRouter for
basic classification.
"""

import asyncio
import base64
import json
import logging
import time
from typing import Any

from app.core.config import settings
from app.schemas.vision import ScannedFoodItem

logger = logging.getLogger(__name__)

# ── System instruction for Gemini Vision ──────────────────

VISION_SYSTEM_INSTRUCTION = """You are an expert nutritionist specializing in Indian cuisine and food identification.

Given a food image, you MUST:
1. Identify ALL visible food items in the image
2. Estimate the volume/quantity of each item in grams or ml
3. Calculate macronutrients based on the FitGenome Indian Food Dataset

For each food item, provide:
- name: The food name (use Indian names where applicable, e.g. "Paneer Butter Masala" not "Cottage Cheese Curry")
- portion: Estimated portion size (e.g. "200g", "2 rotis", "1 bowl ~250ml")
- calories: Total calories in kcal
- protein_g: Protein in grams
- carbs_g: Carbohydrates in grams
- fat_g: Fat in grams

Use these reference values for common Indian foods:
- 1 roti (30g): 70 kcal, 2.5g protein, 15g carbs, 0.4g fat
- 1 bowl dal (200ml): 150 kcal, 9g protein, 20g carbs, 4g fat
- 1 cup rice (150g cooked): 180 kcal, 3.5g protein, 40g carbs, 0.4g fat
- Paneer 100g: 265 kcal, 18g protein, 4g carbs, 20g fat
- Chicken breast 100g: 165 kcal, 31g protein, 0g carbs, 3.6g fat
- 1 idli (40g): 39 kcal, 2g protein, 8g carbs, 0.2g fat
- 1 dosa (60g): 120 kcal, 2.5g protein, 18g carbs, 4g fat

RESPOND ONLY with a valid JSON array. Example:
[
  {"name": "Paneer Tikka", "portion": "150g", "calories": 397, "protein_g": 27, "carbs_g": 6, "fat_g": 30},
  {"name": "Whole Wheat Roti", "portion": "2 pieces", "calories": 140, "protein_g": 5, "carbs_g": 30, "fat_g": 0.8}
]"""

OPENROUTER_FALLBACK_PROMPT = """Identify all food items visible in this image.
For each item, estimate the portion size and provide approximate macronutrients.
Focus on Indian cuisine items where applicable.

Return a JSON array with objects having these exact keys:
name, portion, calories, protein_g, carbs_g, fat_g

Example: [{"name": "Rice", "portion": "1 cup", "calories": 180, "protein_g": 3.5, "carbs_g": 40, "fat_g": 0.4}]
Return ONLY the JSON array, no other text."""


def _parse_food_items(raw_text: str) -> list[ScannedFoodItem]:
    """
    Parse LLM response text into a list of ScannedFoodItem.

    Handles:
    - Raw JSON arrays
    - JSON wrapped in ```json ... ``` code blocks
    - Graceful fallback on parse failure
    """
    text = raw_text.strip()

    # Strip markdown code fences
    if text.startswith("```"):
        lines = text.split("\n")
        # Remove first and last lines (fences)
        text = "\n".join(lines[1:-1]).strip()

    try:
        data = json.loads(text)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse vision response as JSON: {e}")
        logger.debug(f"Raw response: {text[:500]}")
        return []

    if not isinstance(data, list):
        data = [data]

    items = []
    for entry in data:
        try:
            items.append(ScannedFoodItem(
                name=entry.get("name", "Unknown Item"),
                portion=entry.get("portion", "1 serving"),
                calories=float(entry.get("calories", 0)),
                protein_g=float(entry.get("protein_g", 0)),
                carbs_g=float(entry.get("carbs_g", 0)),
                fat_g=float(entry.get("fat_g", 0)),
            ))
        except (ValueError, TypeError) as e:
            logger.warning(f"Skipping malformed food entry: {e}")

    return items


async def _scan_with_gemini(image_bytes: bytes) -> tuple[list[ScannedFoodItem], float]:
    """
    Send image to Gemini Vision for food identification.

    Returns (items, latency_ms).
    """
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=settings.GEMINI_API_KEY)

    b64_image = base64.b64encode(image_bytes).decode("utf-8")

    start = time.monotonic()

    response = await asyncio.to_thread(
        client.models.generate_content,
        model=settings.GEMINI_VISION_MODEL,
        contents=[
            types.Content(
                parts=[
                    types.Part(text=VISION_SYSTEM_INSTRUCTION + "\n\nAnalyze this food image:"),
                    types.Part(
                        inline_data=types.Blob(
                            mime_type="image/jpeg",
                            data=base64.b64decode(b64_image),
                        )
                    ),
                ],
            ),
        ],
    )

    latency_ms = (time.monotonic() - start) * 1000

    raw_text = response.text or ""
    items = _parse_food_items(raw_text)

    logger.info(
        f"Gemini Vision: {len(items)} items identified in {latency_ms:.0f}ms"
    )

    return items, latency_ms


async def _scan_with_openrouter(image_bytes: bytes) -> list[ScannedFoodItem]:
    """
    Fallback: Send image to OpenRouter vision-capable model for food classification.
    """
    from openai import AsyncOpenAI

    client = AsyncOpenAI(
        api_key=settings.OPENROUTER_API_KEY,
        base_url=settings.OPENROUTER_BASE_URL,
    )

    b64_image = base64.b64encode(image_bytes).decode("utf-8")

    start = time.monotonic()

    response = await client.chat.completions.create(
        model=settings.OPENROUTER_VISION_MODEL,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": OPENROUTER_FALLBACK_PROMPT},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{b64_image}",
                        },
                    },
                ],
            },
        ],
        temperature=0.3,
        max_tokens=2048,
    )

    latency_ms = (time.monotonic() - start) * 1000

    raw_text = response.choices[0].message.content or ""
    items = _parse_food_items(raw_text)

    logger.info(
        f"OpenRouter Vision fallback: {len(items)} items identified in {latency_ms:.0f}ms"
    )

    return items


async def scan_food_image(image_bytes: bytes) -> tuple[list[ScannedFoodItem], str]:
    """
    Scan a food image and return identified items with macros.

    Pipeline:
        1. Try Gemini Vision (primary)
        2. If latency exceeds threshold OR Gemini fails → fall back to OpenRouter

    Parameters
    ----------
    image_bytes : bytes
        Pre-processed JPEG image bytes.

    Returns
    -------
    tuple[list[ScannedFoodItem], str]
        (items, provider_used)
    """
    threshold_ms = settings.VISION_LATENCY_THRESHOLD_MS

    # ── Try Gemini first ──────────────────────────────────
    if settings.GEMINI_API_KEY:
        try:
            items, latency_ms = await asyncio.wait_for(
                _scan_with_gemini(image_bytes),
                timeout=threshold_ms / 1000 + 2,  # small buffer
            )

            if latency_ms <= threshold_ms and items:
                return items, "gemini"

            if not items:
                logger.warning("Gemini returned no items, falling back to OpenRouter")
            else:
                logger.warning(
                    f"Gemini latency {latency_ms:.0f}ms exceeded "
                    f"threshold {threshold_ms}ms, falling back to OpenRouter"
                )

        except asyncio.TimeoutError:
            logger.warning(f"Gemini timed out after {threshold_ms}ms, falling back to OpenRouter")
        except Exception as e:
            logger.error(f"Gemini Vision failed: {e}, falling back to OpenRouter")

    # ── OpenRouter fallback ───────────────────────────────
    if settings.OPENROUTER_API_KEY:
        try:
            items = await _scan_with_openrouter(image_bytes)
            if items:
                return items, "openrouter"
        except Exception as e:
            logger.error(f"OpenRouter Vision fallback also failed: {e}")

    # ── Both failed ───────────────────────────────────────
    logger.error("All vision providers failed")
    return [], "none"
