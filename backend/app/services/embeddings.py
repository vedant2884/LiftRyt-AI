"""Local sentence embeddings via sentence-transformers — no paid embedding
API, matching the LLM layer's own no-paid-API constraint (steps 9-10).

all-MiniLM-L6-v2 outputs 384-dim vectors, small and fast enough to run
comfortably on CPU for a library this size (exercises: ~60 rows; chat
summaries: a handful per user), while still being a genuinely strong
general-purpose sentence embedding model.
"""

import asyncio
from functools import lru_cache

from sentence_transformers import SentenceTransformer

MODEL_NAME = "all-MiniLM-L6-v2"
EMBEDDING_DIM = 384


@lru_cache(maxsize=1)
def _get_model() -> SentenceTransformer:
    # Lazy singleton: loading the model is a few-hundred-ms-to-seconds cost
    # (plus a one-time download to the hf_cache volume) that should happen
    # once per process on first use, not at import time — importing this
    # module shouldn't pay that cost on every uvicorn --reload restart.
    return SentenceTransformer(MODEL_NAME)


def embed_text(text: str) -> list[float]:
    return embed_texts([text])[0]


def embed_texts(texts: list[str]) -> list[list[float]]:
    model = _get_model()
    # normalize_embeddings=True: unit-length vectors, standard practice for
    # sentence-transformers output and what makes pgvector's cosine_distance
    # comparator a meaningful similarity measure here.
    vectors = model.encode(texts, normalize_embeddings=True)
    return vectors.tolist()


async def embed_text_async(text: str) -> list[float]:
    """CPU-bound (a local sentence-transformers forward pass, no network
    call), so calling embed_text() directly from async code blocks the
    entire event loop for its duration — every other in-flight request
    stalls until it's done. Every actual call site in the coach's request
    path (agent.py, exercise_retrieval.py, chat_memory.py) should go
    through this instead, which runs it in a worker thread so the loop
    stays free."""
    return await asyncio.to_thread(embed_text, text)
