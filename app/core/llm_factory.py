"""
LLM Factory — Provider-aware factory for building LangChain chat models.

Supports three providers with automatic availability detection:
    1. OpenAI  (ChatOpenAI)
    2. Gemini  (ChatGoogleGenerativeAI)
    3. Groq    (ChatGroq)

Usage:
    llm = create_llm("openai")  # returns ChatOpenAI or raises ValueError
    llms = get_available_llms()  # returns list of (provider_name, llm) tuples
"""

import logging
from typing import Literal

from langchain_core.language_models.chat_models import BaseChatModel

from app.core.config import settings

logger = logging.getLogger(__name__)

ProviderName = Literal["openai", "gemini", "groq"]

# Map provider → (api_key_attr, model_attr) on settings
_PROVIDER_CONFIG: dict[str, tuple[str, str]] = {
    "gemini": ("GEMINI_API_KEY", "GEMINI_MODEL"),
    "groq": ("GROQ_API_KEY", "GROQ_MODEL"),
}


def _key_is_set(key_value: str) -> bool:
    """Return True if the API key is non-empty and not a placeholder."""
    if not key_value:
        return False
    placeholders = {"your-", "sk-your", "change-me"}
    return not any(key_value.startswith(p) for p in placeholders)


def create_llm(provider: str) -> BaseChatModel:
    """
    Build a LangChain chat model for the given provider.

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

    key_attr, model_attr = _PROVIDER_CONFIG[provider]
    api_key = getattr(settings, key_attr)
    model = getattr(settings, model_attr)

    if not _key_is_set(api_key):
        raise ValueError(
            f"API key for provider '{provider}' is not configured. "
            f"Set {key_attr} in your .env file."
        )

    if provider == "gemini":
        from langchain_google_genai import ChatGoogleGenerativeAI

        return ChatGoogleGenerativeAI(
            model=model,
            google_api_key=api_key,
            temperature=0.7,
            max_output_tokens=4096,
        )

    elif provider == "groq":
        from langchain_groq import ChatGroq

        return ChatGroq(
            model=model,
            api_key=api_key,
            temperature=0.7,
            max_tokens=4096,
        )

    # Should never reach here due to the check above
    raise ValueError(f"Unhandled provider: {provider}")


def get_available_llms() -> list[tuple[str, BaseChatModel]]:
    """
    Return a list of (provider_name, llm_instance) tuples for all
    providers that have valid API keys, ordered by ``LLM_PROVIDER_ORDER``.

    This is used by the AIOrchestrator to build a fallback chain.
    """
    order = [
        p.strip().lower()
        for p in settings.LLM_PROVIDER_ORDER.split(",")
        if p.strip()
    ]

    available = []
    for provider in order:
        try:
            llm = create_llm(provider)
            available.append((provider, llm))
            logger.info(f"LLM provider '{provider}' is available")
        except ValueError as e:
            logger.info(f"LLM provider '{provider}' skipped: {e}")

    if not available:
        logger.warning(
            "No LLM providers are available! "
            "Set at least one of GEMINI_API_KEY or GROQ_API_KEY."
        )

    return available
