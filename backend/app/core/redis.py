import logging

from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.core.config import settings

logger = logging.getLogger(__name__)

redis_client = Redis.from_url(settings.redis_url, decode_responses=True)

LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 5
LOGIN_RATE_LIMIT_WINDOW_SECONDS = 15 * 60


async def register_login_attempt(email: str) -> int:
    """Increments the per-email failed-login counter and returns the new
    count. First attempt in a window sets the TTL so the counter naturally
    resets 15 minutes after the first failure.

    Fails open: rate limiting is defense-in-depth on top of password
    verification, not the primary auth mechanism, so a Redis outage should
    degrade to "no rate limiting" rather than take down login entirely (see
    the memory note on the 2026-08-12 incident where exactly this happened).
    """
    key = f"login_attempts:{email.lower()}"
    try:
        attempts = await redis_client.incr(key)
        if attempts == 1:
            await redis_client.expire(key, LOGIN_RATE_LIMIT_WINDOW_SECONDS)
        return attempts
    except RedisError:
        logger.warning("Redis unavailable in register_login_attempt; failing open", exc_info=True)
        return 0


async def clear_login_attempts(email: str) -> None:
    try:
        await redis_client.delete(f"login_attempts:{email.lower()}")
    except RedisError:
        logger.warning("Redis unavailable in clear_login_attempts; failing open", exc_info=True)


async def get_login_attempts(email: str) -> int:
    try:
        value = await redis_client.get(f"login_attempts:{email.lower()}")
        return int(value) if value else 0
    except RedisError:
        logger.warning("Redis unavailable in get_login_attempts; failing open", exc_info=True)
        return 0
