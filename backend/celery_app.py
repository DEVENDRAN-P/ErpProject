try:
    from celery import Celery
except ImportError:
    Celery = None  # celery is optional — only needed for background tasks

from backend.core.config import settings

if Celery is not None:
    celery = Celery(
        "productpilot",
        broker=settings.redis_url,
        backend=settings.redis_url,
    )

    celery.conf.update(
        task_serializer="json",
        accept_content=["json"],
        result_serializer="json",
        timezone="UTC",
        enable_utc=True,
    )
else:
    celery = None
