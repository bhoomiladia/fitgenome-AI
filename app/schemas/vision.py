"""
Pydantic schemas for the food vision scanning pipeline.
"""

from pydantic import BaseModel, Field


class ScanFoodRequest(BaseModel):
    """Request to scan a food image for macro estimation."""

    image_base64: str = Field(
        ...,
        description="Base64-encoded image (JPEG, PNG, or WebP)",
    )
    meal_type: str = Field(
        ...,
        description="One of: breakfast, lunch, dinner, snack",
        pattern="^(breakfast|lunch|dinner|snack)$",
    )


class ScannedFoodItem(BaseModel):
    """A single food item identified from the image."""

    name: str = Field(..., description="Food name, e.g. 'Paneer Tikka'")
    portion: str = Field(..., description="Estimated portion, e.g. '150g' or '2 pieces'")
    calories: float = Field(..., ge=0, description="Estimated calories (kcal)")
    protein_g: float = Field(..., ge=0, description="Protein in grams")
    carbs_g: float = Field(..., ge=0, description="Carbohydrates in grams")
    fat_g: float = Field(..., ge=0, description="Fat in grams")


class ScanFoodResponse(BaseModel):
    """Response from the food scanning pipeline."""

    items: list[ScannedFoodItem] = Field(
        ..., description="All food items identified in the image"
    )
    total_calories: float = Field(..., ge=0)
    total_protein_g: float = Field(..., ge=0)
    total_carbs_g: float = Field(..., ge=0)
    total_fat_g: float = Field(..., ge=0)
    provider_used: str = Field(
        ..., description="Vision provider that was used: 'gemini' or 'openrouter'"
    )
    image_quality_score: float = Field(
        ..., description="Laplacian blur score of the input image"
    )
    items_logged: int = Field(
        ..., ge=0, description="Number of items saved to NutritionLog"
    )
