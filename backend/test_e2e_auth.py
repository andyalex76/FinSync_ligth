"""
End-to-end tests against a real PostgreSQL: Alembic migrations, bootstrap of the family by the first
user, auth flow, transactions and transfer-based settlements.
Skipped automatically when the database is not reachable; CI provides a Postgres service.
"""
import asyncio

import pytest

try:
    from backend.database import engine
    from backend.e2e_helpers import ANNA, BORIS, BOT_KEY, db_or_skip, login, migrate_to_head, wipe_operations
    from backend.main import app
except ImportError:
    from database import engine
    from e2e_helpers import ANNA, BORIS, BOT_KEY, db_or_skip, login, migrate_to_head, wipe_operations
    from main import app

from sqlalchemy import text


@pytest.mark.asyncio
async def test_migrations_match_models():
    """Alembic is the only source of the schema: after upgrade head there must be no drift."""
    from alembic import command

    await db_or_skip()
    try:
        cfg = await migrate_to_head()
        await asyncio.to_thread(command.check, cfg)
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_bot_login_dashboard_flow_on_real_database(monkeypatch):
    from httpx import ASGITransport, AsyncClient

    await db_or_skip()
    monkeypatch.setenv("ALLOWED_TELEGRAM_IDS", str(ANNA))
    try:
        await migrate_to_head()
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as c:
            headers, _ = await login(c, ANNA, "Анна")

            assert (await c.get("/api/dashboard/summary", headers=headers)).status_code == 200
            assert (await c.get("/api/dashboard/forecast", headers=headers)).status_code == 200

            # One-time browser link: exchange works once, the second try is rejected
            code = (await c.post("/api/auth/login-link", json={"telegram_id": ANNA}, headers=BOT_KEY)).json()["code"]
            first = await c.post("/api/auth/exchange", json={"code": code})
            assert first.status_code == 200
            assert (await c.post("/api/auth/exchange", json={"code": code})).status_code == 401
            session_headers = {"Authorization": f"Bearer {first.json()['access_token']}"}
            assert (await c.get("/api/dashboard/summary", headers=session_headers)).status_code == 200

            # A stranger is refused even with the trusted bot key
            r = await c.post(
                "/api/auth/telegram",
                json={"telegram_id": 777000777, "first_name": "Чужой"},
                headers=BOT_KEY,
            )
            assert r.status_code == 403
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_family_bootstrap_transfers_and_settlements(monkeypatch):
    from httpx import ASGITransport, AsyncClient

    await db_or_skip()
    monkeypatch.setenv("ALLOWED_TELEGRAM_IDS", f"{ANNA},{BORIS}")
    try:
        await migrate_to_head()
        await wipe_operations()

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as c:
            anna_h, anna_member = await login(c, ANNA, "Анна")
            boris_h, boris_member = await login(c, BORIS, "Борис")

            # No demo people: only the real, logged-in users are family members
            members = (await c.get("/api/family/members", headers=anna_h)).json()
            assert {m["name"] for m in members} >= {"Анна", "Борис"}
            assert not any("Смирнов" in m["name"] or "Елена" in m["name"] for m in members)
            assert next(m for m in members if m["id"] == anna_member)["role"] in ("owner", "member")

            # An expense is NOT split: it does not create any debt
            r = await c.post("/api/transactions", headers=anna_h, json={
                "type": "expense", "amount_kopecks": 120000, "description": "Продукты",
                "transaction_date": "2026-10-01",
                # legacy client ids that do not exist in the database must not break anything
                "paid_by_member_id": "mem-01", "category_id": "cat-does-not-exist",
            })
            assert r.status_code == 201, r.text
            assert r.json()["paid_by_member_id"] == anna_member  # fell back to the authenticated member
            assert (await c.get("/api/family/settlements", headers=anna_h)).json()["count"] == 0

            # Anna lends Boris 5000.00
            r = await c.post("/api/transactions", headers=anna_h, json={
                "type": "transfer", "amount_kopecks": 500000, "description": "Одолжила",
                "transaction_date": "2026-10-02", "to_member_id": boris_member,
            })
            assert r.status_code == 201, r.text
            assert r.json()["to_member_id"] == boris_member

            settlements = (await c.get("/api/family/settlements", headers=boris_h)).json()
            assert settlements["count"] == 1
            debt = settlements["settlements"][0]
            assert debt["debtor_member_id"] == boris_member
            assert debt["creditor_member_id"] == anna_member
            assert debt["amount_kopecks"] == 500000
            assert (debt["debtor_name"], debt["creditor_name"]) == ("Борис", "Анна")

            members = {m["id"]: m for m in (await c.get("/api/family/members", headers=anna_h)).json()}
            assert members[anna_member]["balance_kopecks"] == 500000
            assert members[boris_member]["balance_kopecks"] == -500000

            # Boris repays 2000.00, then the rest: the debt closes
            for amount in (200000, 300000):
                r = await c.post("/api/transactions", headers=boris_h, json={
                    "type": "transfer", "amount_kopecks": amount, "description": "Вернул",
                    "transaction_date": "2026-10-03", "to_member_id": anna_member,
                })
                assert r.status_code == 201, r.text
                if amount == 200000:
                    left = (await c.get("/api/family/settlements", headers=anna_h)).json()["settlements"][0]
                    assert left["amount_kopecks"] == 300000
            assert (await c.get("/api/family/settlements", headers=anna_h)).json()["count"] == 0

            # Transfers are not income or expenses
            summary = (await c.get("/api/dashboard/summary", headers=anna_h)).json()
            assert summary["total_expenses_kopecks"] == 120000
            assert summary["total_income_kopecks"] == 0

            # Validation
            bad = [
                {"type": "transfer", "amount_kopecks": 100, "description": "x", "transaction_date": "2026-10-01"},
                {"type": "expense", "amount_kopecks": 100, "description": "x", "transaction_date": "2026-10-01",
                 "to_member_id": boris_member},
            ]
            for body in bad:
                assert (await c.post("/api/transactions", headers=anna_h, json=body)).status_code == 422
            r = await c.post("/api/transactions", headers=anna_h, json={
                "type": "transfer", "amount_kopecks": 100, "description": "себе",
                "transaction_date": "2026-10-01", "to_member_id": anna_member,
            })
            assert r.status_code == 422
            r = await c.post("/api/transactions", headers=anna_h, json={
                "type": "transfer", "amount_kopecks": 100, "description": "никому",
                "transaction_date": "2026-10-01", "to_member_id": "mem-99",
            })
            assert r.status_code == 422

            # The database itself refuses an inconsistent transfer
            with pytest.raises(Exception):
                async with engine.begin() as conn:
                    await conn.execute(text(
                        "INSERT INTO transactions (id, family_id, paid_by_member_id, type, amount_kopecks, currency, "
                        "description, transaction_date, status, created_at) "
                        "SELECT gen_random_uuid(), family_id, id, 'transfer', 100, 'RUB', 'bad', now(), 'confirmed', now() "
                        "FROM family_members LIMIT 1"
                    ))

            # Legacy sync endpoint: a transfer without a valid recipient is dropped, not retried forever
            r = await c.post("/api/transactions/sync", headers=anna_h, json={"items": [{
                "id": "tx-legacy-1", "action": "create", "type": "transfer", "amount_kopecks": 100,
                "paid_by_member_id": "mem-02", "description": "legacy", "transaction_date": "2026-10-01",
            }]})
            assert r.status_code == 200
            assert r.json()["synced_ids"] == ["tx-legacy-1"]
    finally:
        await engine.dispose()
