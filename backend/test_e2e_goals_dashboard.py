"""
End-to-end: savings goals (balance derived from transactions) and the read-only dashboard payload.
Needs a real PostgreSQL; skipped when it is not reachable (CI provides a Postgres service).
"""
from datetime import date, timedelta

import pytest

try:
    from backend.database import engine
    from backend.e2e_helpers import ANNA, BORIS, db_or_skip, login, migrate_to_head, wipe_operations
    from backend.main import app
except ImportError:
    from database import engine
    from e2e_helpers import ANNA, BORIS, db_or_skip, login, migrate_to_head, wipe_operations
    from main import app

TODAY = date.today().isoformat()


def _tx(kind, amount, description, **extra):
    return {"type": kind, "amount_kopecks": amount, "description": description, "transaction_date": TODAY, **extra}


@pytest.mark.asyncio
async def test_savings_goals_and_dashboard(monkeypatch):
    from httpx import ASGITransport, AsyncClient

    await db_or_skip()
    monkeypatch.setenv("ALLOWED_TELEGRAM_IDS", f"{ANNA},{BORIS}")
    try:
        await migrate_to_head()
        await wipe_operations()

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as c:
            anna_h, anna_member = await login(c, ANNA, "Анна")
            boris_h, boris_member = await login(c, BORIS, "Борис")

            # The dashboard needs authentication
            assert (await c.get("/api/dashboard")).status_code == 401

            # ---- goals: creation and validation
            deadline = (date.today() + timedelta(days=200)).isoformat()
            r = await c.post("/api/goals", headers=anna_h, json={
                "name": "Отпуск", "target_amount_kopecks": 15_000_000, "target_date": deadline,
            })
            assert r.status_code == 201, r.text
            goal = r.json()
            assert goal["saved_kopecks"] == 0 and goal["progress_percent"] == 0

            assert (await c.post("/api/goals", headers=anna_h, json={
                "name": "  отпуск ", "target_amount_kopecks": 100})).status_code == 409
            assert (await c.post("/api/goals", headers=anna_h, json={
                "name": "Прошлое", "target_amount_kopecks": 100, "target_date": "2020-01-01"})).status_code == 422
            assert (await c.post("/api/goals", headers=anna_h, json={
                "name": "Ноль", "target_amount_kopecks": 0})).status_code == 422

            # ---- deposits and withdrawals
            dep = await c.post("/api/transactions", headers=anna_h, json=_tx(
                "saving", 500_000, "В отпуск", goal_id=goal["id"]))
            assert dep.status_code == 201, dep.text
            assert dep.json()["goal_id"] == goal["id"]
            assert (await c.post("/api/transactions", headers=boris_h, json=_tx(
                "withdrawal", 200_000, "Снял", goal_id=goal["id"]))).status_code == 201

            goals = (await c.get("/api/goals", headers=anna_h)).json()["goals"]
            assert goals[0]["saved_kopecks"] == 300_000
            assert goals[0]["remaining_kopecks"] == 14_700_000
            assert goals[0]["progress_percent"] == 2
            assert goals[0]["required_per_month_kopecks"] and goals[0]["days_left"] == 200

            # cannot withdraw more than saved; goal is mandatory and only for savings operations
            over = await c.post("/api/transactions", headers=anna_h, json=_tx(
                "withdrawal", 400_000, "Много", goal_id=goal["id"]))
            assert over.status_code == 422 and "только" in over.json()["detail"]
            assert (await c.post("/api/transactions", headers=anna_h, json=_tx(
                "withdrawal", 100, "x", goal_id="no-such-goal"))).status_code == 422
            assert (await c.post("/api/transactions", headers=anna_h, json=_tx("saving", 100, "x"))).status_code == 422
            assert (await c.post("/api/transactions", headers=anna_h, json=_tx(
                "expense", 100, "x", goal_id=goal["id"]))).status_code == 422

            # cancelling a deposit whose money was already withdrawn would make the balance negative
            blocked = await c.post(f"/api/transactions/{dep.json()['id']}/reject", headers=anna_h)
            assert blocked.status_code == 409
            assert (await c.get("/api/goals", headers=anna_h)).json()["goals"][0]["saved_kopecks"] == 300_000

            # cancelling an untouched deposit works and the balance is unchanged
            extra = await c.post("/api/transactions", headers=anna_h, json=_tx(
                "saving", 100_000, "Лишнее", goal_id=goal["id"]))
            assert (await c.get("/api/goals", headers=anna_h)).json()["goals"][0]["saved_kopecks"] == 400_000
            assert (await c.post(f"/api/transactions/{extra.json()['id']}/reject", headers=anna_h)).status_code == 200
            assert (await c.get("/api/goals", headers=anna_h)).json()["goals"][0]["saved_kopecks"] == 300_000

            await c.post("/api/transactions", headers=anna_h, json=_tx(
                "saving", 500_000, "Ещё в отпуск", goal_id=goal["id"]))

            # ---- budgets: plan vs fact, including an overspent category
            cats = {x["name"]: x["id"] for x in (await c.get("/api/categories", headers=anna_h)).json()}
            await c.post("/api/transactions", headers=anna_h, json=_tx(
                "expense", 100_000, "Магазин", category_id=cats["Продукты"]))
            await c.post("/api/transactions", headers=boris_h, json=_tx(
                "expense", 2_000_000, "Аренда", category_id=cats["Жилье и ЖКХ"]))
            await c.post("/api/transactions", headers=boris_h, json=_tx(
                "income", 10_000_000, "Зарплата", category_id=cats["Зарплата и Доход"]))
            await c.post("/api/transactions", headers=anna_h, json=_tx(
                "transfer", 300_000, "Одолжила", to_member_id=boris_member))

            dash = (await c.get("/api/dashboard", headers=boris_h)).json()

            totals = dash["totals"]
            assert totals["income_kopecks"] == 10_000_000
            assert totals["expenses_kopecks"] == 2_100_000          # transfers/savings are not expenses
            # deposits 500k + 500k (the cancelled 100k is ignored) minus a 200k withdrawal
            assert totals["saved_kopecks"] == 800_000
            assert totals["balance_kopecks"] == 10_000_000 - 2_100_000 - 800_000

            by_name = {b["name"]: b for b in dash["budgets"]}
            groceries, housing = by_name["Продукты"], by_name["Жилье и ЖКХ"]
            assert groceries["spent_kopecks"] == 100_000 and groceries["limit_kopecks"] == 4_500_000
            assert groceries["percent"] == 2 and groceries["is_over"] is False
            assert housing["spent_kopecks"] == 2_000_000 and housing["is_over"] is True and housing["percent"] > 100
            assert housing["remaining_kopecks"] == 0
            assert dash["unbudgeted_spent_kopecks"] == 0

            assert dash["forecast"]["actual_spent_kopecks"] == 2_100_000
            assert dash["forecast"]["has_budget"] is True

            assert dash["goals"][0]["name"] == "Отпуск"
            assert dash["goals"][0]["saved_kopecks"] == 800_000
            kinds = {t["type"] for t in dash["recent_transactions"]}
            assert {"expense", "income", "transfer", "saving", "withdrawal"} <= kinds
            dep_row = next(t for t in dash["recent_transactions"] if t["type"] == "saving")
            assert dep_row["goal_name"] == "Отпуск"
            tr_row = next(t for t in dash["recent_transactions"] if t["type"] == "transfer")
            assert (tr_row["paid_by_name"], tr_row["to_name"]) == ("Анна", "Борис")
            assert all(t["description"] != "Лишнее" for t in dash["recent_transactions"])  # the cancelled one is hidden

            assert dash["settlements"][0]["amount_kopecks"] == 300_000
            assert (dash["settlements"][0]["debtor_name"], dash["settlements"][0]["creditor_name"]) == ("Борис", "Анна")
            balances = {m["name"]: m["balance_kopecks"] for m in dash["members"]}
            assert balances["Анна"] == 300_000 and balances["Борис"] == -300_000

            # Legacy web client: savings operations without a server-side goal are dropped, not retried forever
            r = await c.post("/api/transactions/sync", headers=anna_h, json={"items": [{
                "id": "tx-legacy-saving", "action": "create", "type": "saving", "amount_kopecks": 100,
                "paid_by_member_id": "mem-01", "description": "legacy", "transaction_date": TODAY,
            }]})
            assert r.status_code == 200 and r.json()["synced_ids"] == ["tx-legacy-saving"]
    finally:
        await engine.dispose()
