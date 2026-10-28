"""
HTTP Client for FinSync FastAPI backend used by Telegram Bot (aiogram 3).
Connects to the local FastAPI backend to execute authenticated PostgreSQL queries
and document uploads without mock data.
"""
import logging
import os
from typing import Any, Dict, List, Optional
import aiohttp

logger = logging.getLogger("family_budget.bot_client")


class BotAPIClient:
    def __init__(self, base_url: Optional[str] = None, internal_key: Optional[str] = None):
        self.base_url = (base_url or os.getenv("BACKEND_API_URL", "http://backend:8000")).rstrip("/")
        # Shared secret between the bot container and the API (set in the server-side .env only).
        # The bot never holds SECRET_KEY and never signs JWTs itself.
        self.internal_key = internal_key or os.getenv("INTERNAL_API_KEY", "")
        self._session: Optional[aiohttp.ClientSession] = None

    async def get_session(self) -> aiohttp.ClientSession:
        """Reuse or create ClientSession with sensible timeouts."""
        if self._session is None or self._session.closed:
            timeout = aiohttp.ClientTimeout(total=30, connect=5)
            self._session = aiohttp.ClientSession(timeout=timeout)
        return self._session

    async def close(self):
        """Close underlying aiohttp session."""
        if self._session and not self._session.closed:
            await self._session.close()

    def _auth_headers(self, token: Optional[str] = None) -> Dict[str, str]:
        headers = {"Accept": "application/json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        return headers

    async def auth_telegram(
        self,
        telegram_id: int,
        first_name: str,
        last_name: Optional[str] = None,
        username: Optional[str] = None,
        avatar_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Authenticate or register a Telegram user on the backend.
        Returns access_token, user info (including member_id, family_id).
        """
        session = await self.get_session()
        payload = {
            "telegram_id": telegram_id,
            "first_name": first_name or "Пользователь",
            "last_name": last_name,
            "username": username,
            "avatar_url": avatar_url,
        }
        url = f"{self.base_url}/api/auth/telegram"
        headers = {"Content-Type": "application/json", "X-Internal-Key": self.internal_key}
        async with session.post(url, json=payload, headers=headers) as resp:
            if resp.status == 200:
                data = await resp.json()
                logger.info("Authenticated Telegram user %s via API", telegram_id)
                return data
            if resp.status == 403:
                raise PermissionError("Telegram user is not in the allowlist")
            error_text = await resp.text()
            logger.error("API auth_telegram failed (%s): %s", resp.status, error_text)
            raise RuntimeError(f"Auth failed with HTTP {resp.status}")

    async def get_login_code(self, telegram_id: int) -> str:
        """Ask the API for a one-time code to open the browser dashboard."""
        session = await self.get_session()
        url = f"{self.base_url}/api/auth/login-link"
        headers = {"Content-Type": "application/json", "X-Internal-Key": self.internal_key}
        async with session.post(url, json={"telegram_id": telegram_id}, headers=headers) as resp:
            if resp.status != 200:
                raise RuntimeError(f"Login link failed with HTTP {resp.status}")
            return (await resp.json())["code"]

    async def get_dashboard_summary(self, token: str) -> Dict[str, Any]:
        """
        Fetch real dashboard summary from PostgreSQL:
        total_income_kopecks, total_expenses_kopecks, net_savings_kopecks, period.
        """
        session = await self.get_session()
        url = f"{self.base_url}/api/dashboard/summary"
        async with session.get(url, headers=self._auth_headers(token)) as resp:
            if resp.status == 200:
                return await resp.json()
            raise RuntimeError(f"Failed to fetch dashboard summary: HTTP {resp.status}")

    async def get_dashboard_forecast(self, token: str) -> Dict[str, Any]:
        """
        Fetch real expense forecast from PostgreSQL:
        projected_spent_kopecks, total_budget_kopecks, daily_average_kopecks, is_over_budget.
        """
        session = await self.get_session()
        url = f"{self.base_url}/api/dashboard/forecast"
        async with session.get(url, headers=self._auth_headers(token)) as resp:
            if resp.status == 200:
                return await resp.json()
            raise RuntimeError(f"Failed to fetch dashboard forecast: HTTP {resp.status}")

    async def create_transaction(
        self,
        token: str,
        amount_kopecks: int,
        description: str,
        paid_by_member_id: Optional[str] = None,
        category_id: Optional[str] = None,
        tx_type: str = "expense",
        tx_date: Optional[str] = None,
        tags: Optional[List[str]] = None,
        to_member_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Record a transaction in PostgreSQL (amount in kopecks).
        tx_type='transfer' requires to_member_id: the payer gives money to that member.
        """
        session = await self.get_session()
        url = f"{self.base_url}/api/transactions"
        payload = {
            "type": tx_type,
            "amount_kopecks": amount_kopecks,
            "currency": "RUB",
            "category_id": category_id,
            "paid_by_member_id": paid_by_member_id,  # None = the authenticated member (decided by the API)
            "description": description,
            "transaction_date": tx_date or "",
            "tags": tags or [],
        }
        if to_member_id:
            payload["to_member_id"] = to_member_id
        headers = self._auth_headers(token)
        headers["Content-Type"] = "application/json"

        async with session.post(url, json=payload, headers=headers) as resp:
            if resp.status in (200, 201):
                return await resp.json()
            err = await resp.text()
            raise RuntimeError(f"Failed to create transaction: HTTP {resp.status} - {err}")

    async def reject_transaction(self, token: str, draft_id: str) -> Dict[str, Any]:
        """
        Cancel a transaction entered by mistake (status becomes "rejected").
        """
        session = await self.get_session()
        url = f"{self.base_url}/api/transactions/{draft_id}/reject"
        headers = self._auth_headers(token)

        # Support both DELETE and POST
        try:
            async with session.delete(url, headers=headers) as resp:
                if resp.status == 200:
                    return await resp.json()
        except Exception:
            pass

        async with session.post(url, headers=headers) as resp:
            if resp.status == 200:
                return await resp.json()
            err = await resp.text()
            raise RuntimeError(f"Failed to reject transaction: HTTP {resp.status} - {err}")

    async def get_categories(self, token: str) -> List[Dict[str, Any]]:
        """Fetch categories list from PostgreSQL."""
        session = await self.get_session()
        url = f"{self.base_url}/api/categories"
        async with session.get(url, headers=self._auth_headers(token)) as resp:
            if resp.status == 200:
                data = await resp.json()
                return data.get("items", [])
            return []

    async def get_members(self, token: str) -> List[Dict[str, Any]]:
        """Active family members with their transfer balances."""
        session = await self.get_session()
        async with session.get(f"{self.base_url}/api/family/members", headers=self._auth_headers(token)) as resp:
            if resp.status != 200:
                raise RuntimeError(f"Failed to load members: HTTP {resp.status}")
            return await resp.json()

    async def get_settlements(self, token: str) -> Dict[str, Any]:
        """Open debts between members (derived from transfers)."""
        session = await self.get_session()
        async with session.get(f"{self.base_url}/api/family/settlements", headers=self._auth_headers(token)) as resp:
            if resp.status != 200:
                raise RuntimeError(f"Failed to load settlements: HTTP {resp.status}")
            return await resp.json()
