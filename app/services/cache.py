"""
Redis caching layer for AI-generated plans.

Caches workout and meal plans keyed by user context hash
to reduce LLM API costs and latency on repeated requests.
"""

import hashlib
import json
import logging
from typing import Any

import redis.asyncio as aioredis

from app.core.config import settings

logger = logging.getLogger(__name__)

_redis_client: aioredis.Redis | None = None

# Cache TTL: 24 hours for generated plans
PLAN_CACHE_TTL = 60 * 60 * 24


async def get_redis() -> aioredis.Redis:
    """Get or create async Redis client."""
    global _redis_client
    if _redis_client is None:
        _redis_client = aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
        )
    return _redis_client


def _make_cache_key(prefix: str, user_id: str, context_data: dict) -> str:
    """
    Generate a deterministic cache key from user context.

    Key format: fitgenome:{prefix}:{user_id}:{context_hash}
    """
    context_str = json.dumps(context_data, sort_keys=True, default=str)
    context_hash = hashlib.sha256(context_str.encode()).hexdigest()[:16]
    return f"fitgenome:{prefix}:{user_id}:{context_hash}"


async def get_cached_plan(prefix: str, user_id: str, context_data: dict) -> dict | None:
    """
    Retrieve a cached AI plan if available.

    Returns None on cache miss or Redis unavailability.
    """
    try:
        r = await get_redis()
        key = _make_cache_key(prefix, user_id, context_data)
        data = await r.get(key)

        if data:
            logger.info(f"Cache HIT for {prefix} plan (user={user_id})")
            return json.loads(data)

        logger.debug(f"Cache MISS for {prefix} plan (user={user_id})")
        return None

    except Exception as e:
        logger.warning(f"Redis cache read failed: {e}")
        return None


async def set_cached_plan(
    prefix: str,
    user_id: str,
    context_data: dict,
    plan_data: dict,
    ttl: int = PLAN_CACHE_TTL,
) -> None:
    """
    Store an AI-generated plan in Redis cache.
    """
    try:
        r = await get_redis()
        key = _make_cache_key(prefix, user_id, context_data)
        await r.setex(key, ttl, json.dumps(plan_data, default=str))
        logger.info(f"Cached {prefix} plan for user={user_id} (TTL={ttl}s)")

    except Exception as e:
        logger.warning(f"Redis cache write failed: {e}")


async def invalidate_user_cache(user_id: str) -> int:
    """
    Invalidate all cached plans for a user (e.g. after profile update).
    """
    try:
        r = await get_redis()
        keys = []
        async for key in r.scan_iter(f"fitgenome:*:{user_id}:*"):
            keys.append(key)

        if keys:
            deleted = await r.delete(*keys)
            logger.info(f"Invalidated {deleted} cached plans for user={user_id}")
            return deleted
        return 0

    except Exception as e:
        logger.warning(f"Redis cache invalidation failed: {e}")
        return 0
