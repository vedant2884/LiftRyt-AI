from redis.asyncio import Redis

from app.core.config import settings

redis_client = Redis.from_url(settings.redis_url, decode_responses=True)

LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 5
LOGIN_RATE_LIMIT_WINDOW_SECONDS = 15 * 60


async def register_login_attempt(email: str) -> int:
    """Increments the per-email failed-login counter and returns the new
    count. First attempt in a window sets the TTL so the counter naturally
    resets 15 minutes after the first failure."""
    key = f"login_attempts:{email.lower()}"
    attempts = await redis_client.incr(key)
    if attempts == 1:
        await redis_client.expire(key, LOGIN_RATE_LIMIT_WINDOW_SECONDS)
    return attempts


async def clear_login_attempts(email: str) -> None:
    await redis_client.delete(f"login_attempts:{email.lower()}")


async def get_login_attempts(email: str) -> int:
    value = await redis_client.get(f"login_attempts:{email.lower()}")
    return int(value) if value else 0
