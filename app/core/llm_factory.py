"""
LLM Factory — Provider-aware factory using the OpenAI SDK.

Supports two providers with automatic availability detection:
    1. OpenRouter  (any model via openrouter.ai)
    2. Gemini      (via Google's OpenAI-compatible endpoint)

Both use the `openai` SDK since OpenRouter and Gemini expose
OpenAI-compatible APIs.

Usage:
    client, model = create_llm("openrouter")
    llms = get_available_llms()  # list of (name, client, model) tuples
"""

import logging
from openai import AsyncOpenAI

from app.core.config import settings

logger = logging.getLogger(__name__)


# Map provider → (api_key_attr, model_attr, base_url_attr_or_value)
_PROVIDER_CONFIG: dict[str, tuple[str, str, str]] = {
    "openrouter": ("OPENROUTER_API_KEY", "OPENROUTER_MODEL", "OPENROUTER_BASE_URL"),
    "gemini": ("GEMINI_API_KEY", "GEMINI_MODEL", "https://generativelanguage.googleapis.com/v1beta/openai/"),
}


def _key_is_set(key_value: str) -> bool:
    """Return True if the API key is non-empty and not a placeholder."""
    if not key_value:
        return False
    placeholders = {"your-", "sk-your", "change-me"}
    return not any(key_value.startswith(p) for p in placeholders)


def create_llm(provider: str) -> tuple[AsyncOpenAI, str]:
    """
    Build an AsyncOpenAI client for the given provider.

    Returns
    -------
    tuple[AsyncOpenAI, str]
        (client, model_name)

    Raises
    ------
    ValueError
        If the provider is unknown or its API key is not configured.
    """
    provider = provider.strip().lower()

    if provider not in _PROVIDER_CONFIG:
        raise ValueError(
            f"Unknown LLM provider '{provider}'. "
            f"Supported: {list(_PROVIDER_CONFIG.keys())}"
        )

    key_attr, model_attr, base_url_source = _PROVIDER_CONFIG[provider]
    api_key = getattr(settings, key_attr)
    model = getattr(settings, model_attr)

    if not _key_is_set(api_key):
        raise ValueError(
            f"API key for provider '{provider}' is not configured. "
            f"Set {key_attr} in your .env file."
        )

    # Resolve base URL (either from settings or hardcoded)
    if hasattr(settings, base_url_source):
        base_url = getattr(settings, base_url_source)
    else:
        base_url = base_url_source

    client = AsyncOpenAI(
        api_key=api_key,
        base_url=base_url,
    )

    return client, model


def get_available_llms() -> list[tuple[str, AsyncOpenAI, str]]:
    """
    Return a list of (provider_name, client, model) tuples for all
    providers that have valid API keys, ordered by ``LLM_PROVIDER_ORDER``.

    This is used by the AIOrchestrator to build a fallback chain.
    """
    order = [
        p.strip().lower()
        for p in settings.LLM_PROVIDER_ORDER.split(",")
        if p.strip()
    ]

    available: list[tuple[str, AsyncOpenAI, str]] = []
    for provider in order:
        try:
            client, model = create_llm(provider)
            available.append((provider, client, model))
            logger.info(f"LLM provider '{provider}' is available (model: {model})")
        except ValueError as e:
            logger.info(f"LLM provider '{provider}' skipped: {e}")

    if not available:
        logger.warning(
            "No LLM providers are available! "
            "Set at least one of OPENROUTER_API_KEY or GEMINI_API_KEY."
        )

    return available
