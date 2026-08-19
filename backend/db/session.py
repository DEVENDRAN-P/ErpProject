from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.core.config import settings

# SQLite needs check_same_thread=False; for other DBs, connect_args is empty
_connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}

engine = create_engine(settings.database_url, pool_pre_ping=True, connect_args=_connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

