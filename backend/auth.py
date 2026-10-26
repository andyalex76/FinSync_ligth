"""
Authentication and JWT token management for Family Budget backend.
Provides cryptographic token generation and verification using PyJWT (HS256).
"""
import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Union

import jwt
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

try:
    from backend.security import is_telegram_id_allowed
except ImportError:
    from security import is_telegram_id_allowed

logger = logging.getLogger("family_budget.auth")

ALGORITHM = "HS256"  # fixed on purpose: the algorithm must never come from configuration
ACCESS_TOKEN_EXPIRE_DAYS = int(os.getenv("ACCESS_TOKEN_EXPIRE_DAYS", "30"))

http_bearer = HTTPBearer(auto_error=False)

LOGIN_CODE_TTL_SECONDS = 300


def get_secret_key() -> str:
    """SECRET_KEY comes only from the server environment (.env). No built-in default."""
    secret = os.getenv("SECRET_KEY", "")
    if not secret:
        raise RuntimeError("SECRET_KEY is not configured")
    return secret


def create_access_token(
    telegram_id: Union[int, str],
    user_id: Optional[str] = None,
    role: str = "member",
    expires_delta: Optional[timedelta] = None,
    extra_claims: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Generate a cryptographically signed JWT access token for a Telegram user.
    """
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)

    payload: Dict[str, Any] = {
        "sub": str(telegram_id),
        "telegram_id": int(telegram_id) if str(telegram_id).isdigit() else telegram_id,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
        "role": role,
    }
    if user_id:
        payload["user_id"] = str(user_id)
    if extra_claims:
        payload.update(extra_claims)

    return jwt.encode(payload, get_secret_key(), algorithm=ALGORITHM)


def decode_access_token(token: str) -> Dict[str, Any]:
    """
    Decode and cryptographically verify a signed JWT token using SECRET_KEY.
    Raises jwt exceptions if invalid or expired.
    """
    return jwt.decode(token, get_secret_key(), algorithms=[ALGORITHM])


async def verify_token(
    authorization: Optional[str] = Header(None, alias="Authorization"),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(http_bearer),
    token: Optional[str] = None,
) -> Dict[str, Any]:
    """
    FastAPI dependency to verify JWT authentication on protected endpoints.
    Accepts:
      - 'Authorization: Bearer <token>'
      - Injected HTTPAuthorizationCredentials
      - Direct 'token' argument for programmatic verification
    Returns:
      Decoded token payload containing user identity and claims.
    Raises:
      HTTP 401 UNAUTHORIZED if token is missing, invalid, or expired.
    """
    raw_token: Optional[str] = None

    if token:
        raw_token = token
    elif credentials and credentials.credentials:
        raw_token = credentials.credentials
    elif authorization:
        auth_str = authorization.strip()
        if auth_str.lower().startswith("bearer "):
            raw_token = auth_str[7:].strip()
        else:
            raw_token = auth_str

    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Токен авторизации отсутствует. Передайте заголовок Authorization: Bearer <token>",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = decode_access_token(raw_token)
    except Exception as exc:
        logger.warning("JWT verification failed: %s", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Недействительный токен авторизации",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # One-time login codes are not session tokens.
    if payload.get("typ") == "login":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Недействительный токен авторизации",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Removing an ID from the allowlist revokes access immediately, even for unexpired tokens.
    if not is_telegram_id_allowed(payload.get("telegram_id")):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ запрещён",
        )
    return payload


# ---------------------------------------------------------------------
# One-time login codes: bot -> link -> browser dashboard
# ---------------------------------------------------------------------
_used_login_codes: Dict[str, int] = {}


def create_login_code(telegram_id: Union[int, str]) -> str:
    """Short-lived (5 min) single-use code that the browser exchanges for a session token."""
    return create_access_token(
        telegram_id=telegram_id,
        expires_delta=timedelta(seconds=LOGIN_CODE_TTL_SECONDS),
        extra_claims={"typ": "login", "jti": uuid.uuid4().hex},
    )


def consume_login_code(code: str) -> int:
    """Validate and burn a login code. Returns telegram_id. Raises ValueError if invalid/used."""
    payload = decode_access_token(code)
    if payload.get("typ") != "login" or not payload.get("jti"):
        raise ValueError("not a login code")
    now = int(datetime.now(timezone.utc).timestamp())
    for jti, exp in list(_used_login_codes.items()):
        if exp < now:
            del _used_login_codes[jti]
    if payload["jti"] in _used_login_codes:
        raise ValueError("login code already used")
    _used_login_codes[payload["jti"]] = int(payload.get("exp", now))
    return int(payload["telegram_id"])
