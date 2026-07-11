import redis
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

redis_client = None

if settings.REDIS_URL:
    try:
        redis_client = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True, socket_connect_timeout=2)
        redis_client.ping()
        logger.info("Successfully connected to Redis.")
    except Exception as e:
        logger.warning(f"Redis connection failed. Running without Redis cache. Error: {e}")
        redis_client = None
else:
    logger.info("REDIS_URL not configured. Running without Redis cache.")
