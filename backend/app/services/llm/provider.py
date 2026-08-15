"""Provider-agnostic LLM client.

OpenRouter and Ollama both expose an OpenAI-compatible chat-completions API
(including tool calling), so instead of writing a bespoke client per
provider, this returns the same AsyncOpenAI client pointed at a different
base_url/model. Swapping providers is the LLM_PROVIDER env var, not a
rewritten call site — the "provider abstraction" the spec asks for, kept to
its actual minimum rather than an unnecessary abstract-base-class hierarchy
around a difference that's really just configuration.
"""

import logging

from openai import AsyncOpenAI

from app.core.config import settings

logger = logging.getLogger(__name__)


class LLMProviderError(Exception):
    """Raised when the configured LLM provider fails to respond (bad key,
    network error, rate limit, model not pulled locally, etc.) — the chat
    router turns this into a clean 502 instead of a raw stack trace."""


def get_llm_client() -> AsyncOpenAI:
    if settings.llm_provider == "ollama":
        # Ollama doesn't check the key, but the client requires a non-empty string.
        return AsyncOpenAI(api_key="ollama", base_url=f"{settings.ollama_base_url}/v1")
    # OpenRouter's own docs recommend these attribution headers; harmless
    # to include, never required for the request to succeed.
    return AsyncOpenAI(
        api_key=settings.openrouter_api_key,
        base_url="https://openrouter.ai/api/v1",
        default_headers={"HTTP-Referer": settings.frontend_url, "X-Title": settings.app_name},
    )


def get_llm_models() -> list[str]:
    """Models to try, in order. Ollama only ever has the one locally-pulled
    model; OpenRouter gets a primary plus an optional fallback, since its
    free-tier models are the part of this stack most likely to rate-limit
    or briefly go down."""
    if settings.llm_provider == "ollama":
        return [settings.ollama_model]
    models = [settings.openrouter_model]
    if settings.openrouter_fallback_model:
        models.append(settings.openrouter_fallback_model)
    return models


async def create_chat_completion(client: AsyncOpenAI, **kwargs):
    """chat.completions.create, retrying against each configured fallback
    model in turn if the current one errors. Raises LLMProviderError only
    once every model in the list has failed."""
    models = get_llm_models()
    last_exc: Exception | None = None
    for index, model in enumerate(models):
        try:
            response = await client.chat.completions.create(model=model, **kwargs)
            if index > 0:
                logger.warning("LLM primary model failed, fell back to %s", model)
            return response
        except Exception as exc:
            last_exc = exc
            continue
    raise LLMProviderError(f"All LLM models failed ({', '.join(models)}): {last_exc}") from last_exc
