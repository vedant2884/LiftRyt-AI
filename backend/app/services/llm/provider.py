"""Provider-agnostic LLM client.

Groq and Ollama both expose an OpenAI-compatible chat-completions API
(including tool calling), so instead of writing a bespoke client per
provider, this returns the same AsyncOpenAI client pointed at a different
base_url/model. Swapping providers is the LLM_PROVIDER env var, not a
rewritten call site — the "provider abstraction" the spec asks for, kept to
its actual minimum rather than an unnecessary abstract-base-class hierarchy
around a difference that's really just configuration.
"""

from openai import AsyncOpenAI

from app.core.config import settings


class LLMProviderError(Exception):
    """Raised when the configured LLM provider fails to respond (bad key,
    network error, rate limit, model not pulled locally, etc.) — the chat
    router turns this into a clean 502 instead of a raw stack trace."""


def get_llm_client() -> AsyncOpenAI:
    if settings.llm_provider == "ollama":
        # Ollama doesn't check the key, but the client requires a non-empty string.
        return AsyncOpenAI(api_key="ollama", base_url=f"{settings.ollama_base_url}/v1")
    return AsyncOpenAI(api_key=settings.groq_api_key, base_url="https://api.groq.com/openai/v1")


def get_llm_model() -> str:
    if settings.llm_provider == "ollama":
        return settings.ollama_model
    return settings.groq_model
