"""
End-to-end auth flow against a real PostgreSQL (first run on an empty database seeds the family).
Skipped automatically when the database is not reachable; CI provides a Postgres service.
"""
import os

import pytest

try:
    from backend.database import engine, init_db
    from backend.main import app
except ImportError:
    from database import engine, init_db
    from main import app

from sqlalchemy import text

BOT_KEY = {"X-Internal-Key": os.environ.get("INTERNAL_API_KEY", "ci-test-internal-worker-key")}
ALLOWED_ID = 424242001


@pytest.mark.asyncio
async def test_bot_login_dashboard_flow_on_real_database(monkeypatch):
    from httpx import ASGITransport, AsyncClient

    # Connections pooled by earlier tests belong to another event loop: start from a clean pool.
    await engine.dispose()
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception:
        pytest.skip("PostgreSQL is not available")
        return

    monkeypatch.setenv("ALLOWED_TELEGRAM_IDS", str(ALLOWED_ID))
    try:
        await init_db()
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as c:
            # 1. Bot authenticates an allowlisted user (also seeds the family on an empty database)
            r = await c.post(
                "/api/auth/telegram",
                json={"telegram_id": ALLOWED_ID, "first_name": "Тест"},
                headers=BOT_KEY,
            )
            assert r.status_code == 200, r.text
            token = r.json()["access_token"]
            headers = {"Authorization": f"Bearer {token}"}

            # 2. Session token opens the dashboard endpoints
            assert (await c.get("/api/dashboard/summary", headers=headers)).status_code == 200
            assert (await c.get("/api/dashboard/forecast", headers=headers)).status_code == 200

            # 3. One-time browser link: exchange works once, the second try is rejected
            code = (await c.post("/api/auth/login-link", json={"telegram_id": ALLOWED_ID}, headers=BOT_KEY)).json()["code"]
            first = await c.post("/api/auth/exchange", json={"code": code})
            assert first.status_code == 200
            assert (await c.post("/api/auth/exchange", json={"code": code})).status_code == 401
            session_headers = {"Authorization": f"Bearer {first.json()['access_token']}"}
            assert (await c.get("/api/dashboard/summary", headers=session_headers)).status_code == 200

            # 4. A stranger is refused even with the trusted bot key
            r = await c.post(
                "/api/auth/telegram",
                json={"telegram_id": 777000777, "first_name": "Чужой"},
                headers=BOT_KEY,
            )
            assert r.status_code == 403
    finally:
        await engine.dispose()
