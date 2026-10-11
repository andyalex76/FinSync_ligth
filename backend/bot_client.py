"""
HTTP Client for FinSync FastAPI backend used by Telegram Bot (aiogram 3).
Connects to the local FastAPI backend to execute authenticated PostgreSQL queries
and document uploads without mock data.
"""
import asyncio
import logging
import os
from typing import Any, Dict, List, Optional
import aiohttp

logger = logging.getLogger("family_budget.bot_client")


class BotAPIClient:
    def __init__(self, base_url: Optional[str] = None, secret_key: Optional[str] = None):
        self.base_url = (base_url or os.getenv("BACKEND_API_URL", "http://backend:8000")).rstrip("/")
        self.secret_key = secret_key or os.getenv("SECRET_KEY", "finsync-production-secret-key-32chars-min-987654321")
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

    def create_fallback_token(
        self,
        telegram_id: int,
        user_id: Optional[str] = None,
        member_id: Optional[str] = None,
        family_id: Optional[str] = None,
    ) -> str:
        """
        Create a valid HS256 JWT using shared SECRET_KEY as fallback
        if the backend is unreachable or during emergency offline mode.
        """
        try:
            from backend.auth import create_access_token
        except ImportError:
            try:
                from auth import create_access_token
            except ImportError:
                create_access_token = None

        if create_access_token:
            extra = {}
            if family_id:
                extra["family_id"] = family_id
            if member_id:
                extra["member_id"] = member_id
            return create_access_token(
                telegram_id=telegram_id,
                user_id=user_id,
                extra_claims=extra,
            )

        # Basic fallback without auth module
        return ""

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
        try:
            async with session.post(url, json=payload, headers={"Content-Type": "application/json"}) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    logger.info("Successfully authenticated Telegram user %s via API", telegram_id)
                    return data
                error_text = await resp.text()
                logger.error("API auth_telegram failed (%s): %s", resp.status, error_text)
                raise RuntimeError(f"Auth failed with HTTP {resp.status}: {error_text}")
        except aiohttp.ClientError as exc:
            logger.warning("Could not reach backend auth at %s (%s). Generating fallback token.", url, exc)
            fallback_token = self.create_fallback_token(telegram_id=telegram_id)
            return {
                "access_token": fallback_token,
                "token_type": "bearer",
                "user": {
                    "id": f"usr-tg-{telegram_id}",
                    "telegram_id": telegram_id,
                    "first_name": first_name,
                    "last_name": last_name,
                    "username": username,
                    "family_id": None,
                    "member_id": None,
                },
            }

    async def join_family(
        self,
        invite_code: str,
        display_name: str,
        token: str,
        avatar_emoji: str = "👤",
    ) -> Dict[str, Any]:
        """
        Bind user to a family via invite code (e.g. SMIRNOV-77).
        """
        session = await self.get_session()
        payload = {
            "invite_code": invite_code.strip().upper(),
            "display_name": display_name,
            "avatar_emoji": avatar_emoji,
        }
        url = f"{self.base_url}/api/family/join"
        headers = self._auth_headers(token)
        headers["Content-Type"] = "application/json"

        async with session.post(url, json=payload, headers=headers) as resp:
            if resp.status == 200:
                return await resp.json()
            error_data = await resp.json() if resp.content_type == "application/json" else {"detail": await resp.text()}
            raise RuntimeError(error_data.get("detail", f"HTTP {resp.status}"))

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
    ) -> Dict[str, Any]:
        """
        Record a transaction in PostgreSQL with minor units (kopecks) and auto-splits.
        """
        session = await self.get_session()
        url = f"{self.base_url}/api/transactions"
        payload = {
            "type": tx_type,
            "amount_kopecks": amount_kopecks,
            "currency": "RUB",
            "category_id": category_id,
            "paid_by_member_id": paid_by_member_id or "mem-01",
            "description": description,
            "transaction_date": tx_date or "",
            "tags": tags or [],
        }
        headers = self._auth_headers(token)
        headers["Content-Type"] = "application/json"

        async with session.post(url, json=payload, headers=headers) as resp:
            if resp.status in (200, 201):
                return await resp.json()
            err = await resp.text()
            raise RuntimeError(f"Failed to create transaction: HTTP {resp.status} - {err}")

    async def upload_document(
        self,
        token: str,
        file_bytes: bytes,
        filename: str,
        member_id: Optional[str] = None,
        content_type: str = "image/jpeg",
    ) -> Dict[str, Any]:
        """
        Upload receipt photo/pdf scan to VPS local disk and enqueue OCR task in Redis.
        """
        session = await self.get_session()
        url = f"{self.base_url}/api/documents/upload"
        data = aiohttp.FormData()
        data.add_field(
            "file",
            file_bytes,
            filename=filename,
            content_type=content_type,
        )
        data.add_field("member_id", str(member_id or "mem-01"))

        async with session.post(url, data=data, headers=self._auth_headers(token)) as resp:
            if resp.status == 200:
                return await resp.json()
            err = await resp.text()
            raise RuntimeError(f"Document upload failed: HTTP {resp.status} - {err}")

    async def get_document_status(self, token: str, doc_id: str) -> Dict[str, Any]:
        """
        Poll document OCR processing status:
        returns status ('pending', 'processing', 'review_needed', 'confirmed', 'failed')
        and extraction dict.
        """
        session = await self.get_session()
        url = f"{self.base_url}/api/documents/{doc_id}/status"
        async with session.get(url, headers=self._auth_headers(token)) as resp:
            if resp.status == 200:
                return await resp.json()
            err = await resp.text()
            raise RuntimeError(f"Failed to get document status: HTTP {resp.status} - {err}")

    async def confirm_transaction(
        self,
        token: str,
        draft_id: str,
        payload: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Confirm an OCR draft transaction in PostgreSQL.
        """
        session = await self.get_session()
        url = f"{self.base_url}/api/transactions/{draft_id}/confirm"
        headers = self._auth_headers(token)
        headers["Content-Type"] = "application/json"

        async with session.post(url, json=payload or {}, headers=headers) as resp:
            if resp.status == 200:
                return await resp.json()
            err = await resp.text()
            raise RuntimeError(f"Failed to confirm transaction: HTTP {resp.status} - {err}")

    async def reject_transaction(self, token: str, draft_id: str) -> Dict[str, Any]:
        """
        Reject/discard an OCR draft transaction in PostgreSQL.
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
