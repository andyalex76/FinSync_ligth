"""
Security helpers for FinSync backend.

- Allowlist of Telegram IDs (fail-closed): only listed people can get a token or use the API.
- Telegram Mini App `initData` verification (HMAC-SHA256, official algorithm).
- Trusted-service check (Telegram bot -> backend) via INTERNAL_API_KEY.
- Startup validation of secrets: the app refuses to start with missing/placeholder secrets.

Real secrets live only in the server-side `.env`; the repository contains placeholders only.
"""
import hmac
import json
import logging
import os
import re
import time
from hashlib import sha256
from typing import Any, Dict, List, Optional, Set
from urllib.parse import parse_qsl

logger = logging.getLogger("family_budget.security")

# Values that look like template placeholders from .env.example / docs / old defaults.
_PLACEHOLDER_MARKERS = (
    "generate_",
    "your_",
    "your-",
    "changeme",
    "change_me",
    "replace_me",
    "example",
    "finsync-production-secret",
    "vps_secure_password",
    "redis_pass_123",
)

MIN_SECRET_LENGTH = 32
MIN_SERVICE_KEY_LENGTH = 16
_BOT_TOKEN_RE = re.compile(r"^\d{6,}:[A-Za-z0-9_-]{30,}$")


class InitDataError(ValueError):
    """Raised when Telegram WebApp initData is missing, forged or expired."""


class ConfigError(RuntimeError):
    """Raised at startup when required secrets are missing or look like placeholders."""


def _looks_like_placeholder(value: str) -> bool:
    low = value.strip().lower()
    return any(marker in low for marker in _PLACEHOLDER_MARKERS)


def _parse_ids(raw: str) -> Set[int]:
    ids: Set[int] = set()
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        try:
            ids.add(int(part))
        except ValueError:
            logger.warning("Ignoring non-numeric Telegram ID in allowlist config")
    return ids


def admin_telegram_ids() -> Set[int]:
    return _parse_ids(os.getenv("TELEGRAM_ADMIN_CHAT_IDS", ""))


def allowed_telegram_ids() -> Set[int]:
    """Admins plus explicitly allowed family members. Empty set means nobody is allowed."""
    return admin_telegram_ids() | _parse_ids(os.getenv("ALLOWED_TELEGRAM_IDS", ""))


def is_telegram_id_allowed(telegram_id: Any) -> bool:
    try:
        return int(telegram_id) in allowed_telegram_ids()
    except (TypeError, ValueError):
        return False


def service_key_ok(provided: Optional[str]) -> bool:
    """Constant-time check of the trusted-service key (used by the Telegram bot container)."""
    expected = os.getenv("INTERNAL_API_KEY", "")
    if not expected or not provided:
        return False
    return hmac.compare_digest(provided, expected)


def validate_init_data(
    init_data: str,
    bot_token: str,
    max_age_seconds: int = 24 * 3600,
    now: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Verify Telegram Mini App initData and return the `user` object.
    Algorithm: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
    Raises InitDataError on any problem.
    """
    if not init_data or not bot_token:
        raise InitDataError("initData or bot token is missing")

    pairs = parse_qsl(init_data, keep_blank_values=True)
    data: Dict[str, str] = {}
    for key, value in pairs:
        if key in data:
            raise InitDataError("duplicate field in initData")
        data[key] = value

    received_hash = data.pop("hash", None)
    if not received_hash:
        raise InitDataError("hash is missing")

    data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(data.items()))
    secret_key = hmac.new(b"WebAppData", bot_token.encode("utf-8"), sha256).digest()
    calculated = hmac.new(secret_key, data_check_string.encode("utf-8"), sha256).hexdigest()
    if not hmac.compare_digest(calculated, received_hash):
        raise InitDataError("signature mismatch")

    try:
        auth_date = int(data["auth_date"])
    except (KeyError, ValueError):
        raise InitDataError("auth_date is missing or invalid")
    current = time.time() if now is None else now
    if current - auth_date > max_age_seconds:
        raise InitDataError("initData expired")
    if auth_date - current > 300:
        raise InitDataError("auth_date is in the future")

    try:
        user = json.loads(data["user"])
        user["id"] = int(user["id"])
    except (KeyError, ValueError, TypeError):
        raise InitDataError("user is missing or invalid")
    return user


def validate_runtime_config() -> None:
    """
    Fail fast at startup. Never prints secret values, only variable names.
    """
    problems: List[str] = []

    secret = os.getenv("SECRET_KEY", "")
    if not secret:
        problems.append("SECRET_KEY is not set")
    elif len(secret) < MIN_SECRET_LENGTH or _looks_like_placeholder(secret):
        problems.append(f"SECRET_KEY is a placeholder or shorter than {MIN_SECRET_LENGTH} chars")

    bot_token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    if not _BOT_TOKEN_RE.match(bot_token):
        problems.append("TELEGRAM_BOT_TOKEN is not set or is not a valid bot token")

    internal = os.getenv("INTERNAL_API_KEY", "")
    if len(internal) < MIN_SERVICE_KEY_LENGTH or _looks_like_placeholder(internal):
        problems.append("INTERNAL_API_KEY is not set, too short or a placeholder")

    admin_token = os.getenv("ADMIN_TOKEN", "")
    if admin_token and _looks_like_placeholder(admin_token):
        problems.append("ADMIN_TOKEN is a placeholder (leave it empty to disable it)")

    if not allowed_telegram_ids():
        problems.append("no Telegram IDs allowed: set TELEGRAM_ADMIN_CHAT_IDS and/or ALLOWED_TELEGRAM_IDS")

    if problems:
        raise ConfigError("Insecure or incomplete configuration: " + "; ".join(problems))
