"""
Image Quality Pre-processing — blur detection and size validation.

Uses Laplacian variance (the same technique OpenCV/TF uses internally)
for blur detection, via Pillow + numpy. Avoids a ~2GB TensorFlow dep.
"""

import io
import logging
from dataclasses import dataclass

import numpy as np
from PIL import Image, ImageFilter

from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class ImageQualityResult:
    """Result of image quality analysis."""

    is_valid: bool
    blur_score: float
    width: int
    height: int
    resized_bytes: bytes | None  # Resized image bytes (JPEG), or None if invalid
    rejection_reason: str | None = None


def _compute_laplacian_variance(img: Image.Image) -> float:
    """
    Compute the Laplacian variance of an image as a blur metric.

    Higher values = sharper image. Typical thresholds:
        - < 50:   very blurry
        - 50-100: somewhat blurry
        - > 100:  acceptably sharp

    This is the same algorithm used by OpenCV's cv2.Laplacian().
    """
    # Convert to grayscale
    gray = img.convert("L")

    # Apply Laplacian kernel (edge detection)
    laplacian = gray.filter(ImageFilter.Kernel(
        size=(3, 3),
        kernel=[0, 1, 0, 1, -4, 1, 0, 1, 0],
        scale=1,
        offset=128,
    ))

    # Compute variance of the Laplacian
    arr = np.array(laplacian, dtype=np.float64)
    variance = arr.var()

    return float(variance)


def validate_and_preprocess(image_bytes: bytes) -> ImageQualityResult:
    """
    Validate image quality and resize if necessary.

    Checks:
        1. Valid image format (JPEG, PNG, WebP)
        2. Minimum dimensions (IMAGE_MIN_SIZE_PX)
        3. Blur detection via Laplacian variance
        4. Resize if exceeds IMAGE_MAX_SIZE_PX

    Returns
    -------
    ImageQualityResult
        Contains validation status, blur score, and processed image bytes.
    """
    try:
        img = Image.open(io.BytesIO(image_bytes))
    except Exception as e:
        logger.warning(f"Invalid image data: {e}")
        return ImageQualityResult(
            is_valid=False,
            blur_score=0.0,
            width=0,
            height=0,
            resized_bytes=None,
            rejection_reason="Invalid image format. Supported: JPEG, PNG, WebP.",
        )

    width, height = img.size

    # ── Check minimum size ────────────────────────────────
    min_px = settings.IMAGE_MIN_SIZE_PX
    if width < min_px or height < min_px:
        return ImageQualityResult(
            is_valid=False,
            blur_score=0.0,
            width=width,
            height=height,
            resized_bytes=None,
            rejection_reason=(
                f"Image too small ({width}×{height}). "
                f"Minimum: {min_px}×{min_px} pixels."
            ),
        )

    # ── Blur detection ────────────────────────────────────
    blur_score = _compute_laplacian_variance(img)
    logger.info(f"Image blur score: {blur_score:.1f} (threshold: {settings.IMAGE_BLUR_THRESHOLD})")

    if blur_score < settings.IMAGE_BLUR_THRESHOLD:
        return ImageQualityResult(
            is_valid=False,
            blur_score=blur_score,
            width=width,
            height=height,
            resized_bytes=None,
            rejection_reason=(
                f"Image too blurry (score: {blur_score:.0f}, "
                f"minimum: {settings.IMAGE_BLUR_THRESHOLD:.0f}). "
                f"Please take a clearer photo."
            ),
        )

    # ── Resize if too large ───────────────────────────────
    max_px = settings.IMAGE_MAX_SIZE_PX
    if width > max_px or height > max_px:
        img.thumbnail((max_px, max_px), Image.Resampling.LANCZOS)
        width, height = img.size
        logger.info(f"Image resized to {width}×{height}")

    # ── Convert to JPEG bytes ─────────────────────────────
    # Ensure RGB mode (handle RGBA/palette images)
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")

    buffer = io.BytesIO()
    img.save(buffer, format="JPEG", quality=85)
    processed_bytes = buffer.getvalue()

    return ImageQualityResult(
        is_valid=True,
        blur_score=blur_score,
        width=width,
        height=height,
        resized_bytes=processed_bytes,
    )
