"""
Authentication and JWT token management for Family Budget backend.
Provides cryptographic token generation and verification using PyJWT (HS256).
"""
import base64
import hashlib
import hmac
import json
import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Union

try:
    from fastapi import Depends, HTTPException, Header, status
    from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
except ImportError:
    class HTTPException(Exception):
        def __init__(self, status_code: int, detail: str = ""):
            self.status_code = status_code
            self.detail = detail
            super().__init__(detail)

    class status:
        HTTP_401_UNAUTHORIZED = 401
        HTTP_403_FORBIDDEN = 403

    def Depends(fn=None):
        return fn

    def Header(*args, **kwargs):
        return args[0] if args else None

    class HTTPAuthorizationCredentials:
        def __init__(self, scheme: str = "Bearer", credentials: str = ""):
            self.scheme = scheme
            self.credentials = credentials

    class HTTPBearer:
        def __init__(self, *args, **kwargs):
            pass

        async def __call__(self, request=None):
            return None

try:
    import jwt
    HAS_PYJWT = True
except ImportError:
    jwt = None
    HAS_PYJWT = False

try:
    from backend.security import is_telegram_id_allowed
except ImportError:
    from security import is_telegram_id_allowed

logger = logging.getLogger("family_budget.auth")

ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_DAYS = int(os.getenv("ACCESS_TOKEN_EXPIRE_DAYS", "30"))

http_bearer = HTTPBearer(auto_error=False)

LOGIN_CODE_TTL_SECONDS = 300


def get_secret_key() -> str:
    """SECRET_KEY comes only from the server environment (.env). No built-in default."""
    secret = os.getenv("SECRET_KEY", "")
    if not secret:
        raise RuntimeError("SECRET_KEY is not configured")
    return secret


def _base64url_encode(data: bytes) -> str:
    """Encode bytes to base64url without padding."""
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("utf-8")


def _base64url_decode(data: str) -> bytes:
    """Decode base64url string with restored padding."""
    padding = len(data) % 4
    if padding > 0:
        data += "=" * (4 - padding)
    return base64.urlsafe_b64decode(data.encode("utf-8"))


def _encode_jwt_manual(payload: Dict[str, Any], secret: str) -> str:
    """Standard RFC 7519 HMAC-SHA256 JWT encoding fallback."""
    header = {"alg": "HS256", "typ": "JWT"}
    header_b64 = _base64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_b64 = _base64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
    sig = hmac.new(secret.encode("utf-8"), signing_input, hashlib.sha256).digest()
    sig_b64 = _base64url_encode(sig)
    return f"{header_b64}.{payload_b64}.{sig_b64}"


def _decode_jwt_manual(token: str, secret: str) -> Dict[str, Any]:
    """Standard RFC 7519 HMAC-SHA256 JWT decoding fallback."""
    parts = token.split(".")
    if len(parts) != 3:
        raise ValueError("Invalid JWT format: expected 3 segments separated by dots")
    header_b64, payload_b64, sig_b64 = parts
    signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
    expected_sig = hmac.new(secret.encode("utf-8"), signing_input, hashlib.sha256).digest()
    try:
        actual_sig = _base64url_decode(sig_b64)
    except Exception as exc:
        raise ValueError(f"Invalid signature encoding: {exc}")
    if not hmac.compare_digest(expected_sig, actual_sig):
        raise ValueError("JWT signature verification failed")
    try:
        payload = json.loads(_base64url_decode(payload_b64).decode("utf-8"))
    except Exception as exc:
        raise ValueError(f"Invalid JWT payload JSON: {exc}")
    exp = payload.get("exp")
    if exp:
        now_ts = int(datetime.now(timezone.utc).timestamp())
        if now_ts > exp:
            raise ValueError("JWT token has expired")
    return payload


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

    if HAS_PYJWT and jwt is not None:
        return jwt.encode(payload, get_secret_key(), algorithm=ALGORITHM)
    return _encode_jwt_manual(payload, get_secret_key())


def decode_access_token(token: str) -> Dict[str, Any]:
    """
    Decode and cryptographically verify a signed JWT token using SECRET_KEY.
    Raises ValueError or jwt exceptions if invalid or expired.
    """
    if HAS_PYJWT and jwt is not None:
        return jwt.decode(token, get_secret_key(), algorithms=[ALGORITHM])
    return _decode_jwt_manual(token, get_secret_key())


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
