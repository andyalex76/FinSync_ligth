"""Shared helpers for the end-to-end tests that run against a real PostgreSQL."""
import asyncio
import os
from pathlib import Path

import pytest
from sqlalchemy import text

try:
    from backend.database import engine
except ImportError:
    from database import engine

BOT_KEY = {"X-Internal-Key": os.environ.get("INTERNAL_API_KEY", "ci-test-internal-worker-key")}
ANNA = 424242001
BORIS = 424242002
BACKEND_DIR = Path(__file__).resolve().parent


def alembic_config():
    from alembic.config import Config

    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "migrations"))
    return cfg


async def db_or_skip():
    # Connections pooled by earlier tests belong to another event loop: start from a clean pool.
    await engine.dispose()
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception:
        pytest.skip("PostgreSQL is not available")


async def migrate_to_head():
    from alembic import command

    cfg = alembic_config()
    # env.py runs its own event loop, so Alembic must not run in this loop's thread.
    await asyncio.to_thread(command.upgrade, cfg, "head")
    return cfg


async def wipe_operations():
    """Test database only: remove transactions and goals so assertions start from zero."""
    async with engine.begin() as conn:
        await conn.execute(text("DELETE FROM transaction_tags"))
        await conn.execute(text("DELETE FROM transactions"))
        await conn.execute(text("DELETE FROM savings_goals"))


async def login(client, telegram_id, name):
    r = await client.post(
        "/api/auth/telegram",
        json={"telegram_id": telegram_id, "first_name": name},
        headers=BOT_KEY,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    return {"Authorization": f"Bearer {body['access_token']}"}, body["user"]["member_id"]
