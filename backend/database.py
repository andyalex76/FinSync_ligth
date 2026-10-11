"""
Database connection, session management and engine configuration for SQLAlchemy 2.0 Async.
"""
import logging
import os
import uuid
from typing import Any, AsyncGenerator, Optional
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from backend.models import Base

logger = logging.getLogger("family_budget.database")

# ---------------------------------------------------------------------
# PostgreSQL Configuration with asyncpg
# ---------------------------------------------------------------------
POSTGRES_USER = os.getenv("POSTGRES_USER", "finsync_user")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "finsync_password")
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "localhost")
POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")
POSTGRES_DB = os.getenv("POSTGRES_DB", "finsync")

DEFAULT_DATABASE_URL = (
    f"postgresql+asyncpg://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"
)
DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL)

# Ensure correct asyncpg driver prefix for SQLAlchemy async engine
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("postgresql://") and "+asyncpg" not in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

SQL_DEBUG = os.getenv("SQL_DEBUG", "false").lower() in ("true", "1", "yes")

engine = create_async_engine(
    DATABASE_URL,
    echo=SQL_DEBUG,
    future=True,
    pool_pre_ping=True,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


def to_uuid(val: Any) -> uuid.UUID:
    """
    Safely convert an ID (string, int, or uuid.UUID) to a valid UUID.
    For non-standard string identifiers (e.g. 'mem-01', 'cat-groceries', 'fam-01'),
    it deterministically generates a UUIDv5 namespace hash so relationships remain consistent.
    """
    if isinstance(val, uuid.UUID):
        return val
    try:
        return uuid.UUID(str(val))
    except (ValueError, TypeError, AttributeError):
        return uuid.uuid5(uuid.NAMESPACE_DNS, str(val))


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency yielding an async SQLAlchemy session.
    Commits changes automatically on normal completion, rolls back on exceptions.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """
    Check and create all database tables according to SQLAlchemy metadata.
    """
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables initialized successfully via SQLAlchemy Async.")
    except Exception as exc:
        logger.warning(
            f"Database connection not available at startup ({exc}). "
            f"Tables will be created once database server is reachable."
        )
