"""
Security tests: Telegram initData verification, allowlist, startup config checks,
one-time login codes and the auth endpoints. No database or network required.
"""
import hmac
import json
import time
from datetime import timedelta
from hashlib import sha256
from urllib.parse import urlencode

import pytest

try:
    from backend import auth, security
    from backend.security import InitDataError, validate_init_data, validate_runtime_config, ConfigError
except ImportError:
    import auth
    import security
    from security import InitDataError, validate_init_data, validate_runtime_config, ConfigError

BOT_TOKEN = "123456:ABCdefGhIJKlmNoPQRsTUVwxyZ_0123456"


def make_init_data(user_id=123456789, bot_token=BOT_TOKEN, auth_date=None, tamper=False, extra=None):
    """Build initData exactly like Telegram does (official algorithm)."""
    fields = {
        "auth_date": str(int(time.time()) if auth_date is None else auth_date),
        "query_id": "AAHdF6IQAAAAAN0XohDhrOrc",
        "user": json.dumps({"id": user_id, "first_name": "Test", "username": "tester"}, separators=(",", ":")),
    }
    if extra:
        fields.update(extra)
    check = "\n".join(f"{k}={v}" for k, v in sorted(fields.items()))
    secret = hmac.new(b"WebAppData", bot_token.encode(), sha256).digest()
    fields["hash"] = hmac.new(secret, check.encode(), sha256).hexdigest()
    if tamper:
        fields["user"] = json.dumps({"id": 999, "first_name": "Evil"}, separators=(",", ":"))
    return urlencode(fields)


# ---------------------------------------------------------------- initData
def test_valid_init_data_returns_user():
    user = validate_init_data(make_init_data(), BOT_TOKEN)
    assert user["id"] == 123456789
    assert user["username"] == "tester"


def test_init_data_with_tampered_payload_is_rejected():
    with pytest.raises(InitDataError):
        validate_init_data(make_init_data(tamper=True), BOT_TOKEN)


def test_init_data_signed_with_other_bot_token_is_rejected():
    forged = make_init_data(bot_token="654321:ZZZdefGhIJKlmNoPQRsTUVwxyZ_9999999")
    with pytest.raises(InitDataError):
        validate_init_data(forged, BOT_TOKEN)


def test_init_data_expired_is_rejected():
    old = make_init_data(auth_date=int(time.time()) - 3 * 24 * 3600)
    with pytest.raises(InitDataError):
        validate_init_data(old, BOT_TOKEN)


def test_init_data_from_the_future_is_rejected():
    future = make_init_data(auth_date=int(time.time()) + 3600)
    with pytest.raises(InitDataError):
        validate_init_data(future, BOT_TOKEN)


def test_init_data_without_hash_or_empty_is_rejected():
    with pytest.raises(InitDataError):
        validate_init_data("auth_date=1&user=%7B%7D", BOT_TOKEN)
    with pytest.raises(InitDataError):
        validate_init_data("", BOT_TOKEN)


def test_init_data_duplicate_fields_are_rejected():
    with pytest.raises(InitDataError):
        validate_init_data(make_init_data() + "&auth_date=1", BOT_TOKEN)


# ---------------------------------------------------------------- allowlist
def test_allowlist_is_fail_closed(monkeypatch):
    monkeypatch.delenv("TELEGRAM_ADMIN_CHAT_IDS", raising=False)
    monkeypatch.delenv("ALLOWED_TELEGRAM_IDS", raising=False)
    assert security.allowed_telegram_ids() == set()
    assert not security.is_telegram_id_allowed(123456789)


def test_allowlist_merges_admins_and_members_and_ignores_garbage(monkeypatch):
    monkeypatch.setenv("TELEGRAM_ADMIN_CHAT_IDS", "1, 2")
    monkeypatch.setenv("ALLOWED_TELEGRAM_IDS", "3,abc,,4")
    assert security.allowed_telegram_ids() == {1, 2, 3, 4}
    assert security.is_telegram_id_allowed("3")
    assert not security.is_telegram_id_allowed(5)
    assert not security.is_telegram_id_allowed(None)


# ---------------------------------------------------------------- startup config
def _good_env(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "a" * 64)
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", BOT_TOKEN)
    monkeypatch.setenv("INTERNAL_API_KEY", "b" * 32)
    monkeypatch.setenv("ADMIN_TOKEN", "")
    monkeypatch.setenv("TELEGRAM_ADMIN_CHAT_IDS", "42")
    monkeypatch.setenv("ALLOWED_TELEGRAM_IDS", "")


def test_runtime_config_accepts_real_looking_values(monkeypatch):
    _good_env(monkeypatch)
    validate_runtime_config()


@pytest.mark.parametrize(
    "name,value",
    [
        ("SECRET_KEY", ""),
        ("SECRET_KEY", "short"),
        ("SECRET_KEY", "generate_random_64_character_hex_key_here"),
        ("SECRET_KEY", "finsync-production-secret-key-32chars-min-987654321"),
        ("TELEGRAM_BOT_TOKEN", ""),
        ("TELEGRAM_BOT_TOKEN", "123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"),
        ("INTERNAL_API_KEY", "generate_strong_internal_api_key_here"),
        ("ADMIN_TOKEN", "generate_strong_admin_token_here"),
        ("TELEGRAM_ADMIN_CHAT_IDS", ""),
    ],
)
def test_runtime_config_rejects_missing_or_placeholder_values(monkeypatch, name, value):
    _good_env(monkeypatch)
    monkeypatch.setenv(name, value)
    with pytest.raises(ConfigError) as exc:
        validate_runtime_config()
    # The error names the variable but never prints secret values.
    assert len(value) < 12 or value not in str(exc.value)


# ---------------------------------------------------------------- tokens and login codes
def test_login_code_is_single_use():
    code = auth.create_login_code(123456789)
    assert auth.consume_login_code(code) == 123456789
    with pytest.raises(ValueError):
        auth.consume_login_code(code)


def test_session_token_cannot_be_used_as_login_code():
    session_token = auth.create_access_token(telegram_id=123456789)
    with pytest.raises(ValueError):
        auth.consume_login_code(session_token)


def test_expired_login_code_is_rejected():
    expired = auth.create_access_token(
        telegram_id=123456789,
        expires_delta=timedelta(seconds=-5),
        extra_claims={"typ": "login", "jti": "x"},
    )
    with pytest.raises(Exception):
        auth.consume_login_code(expired)


@pytest.mark.asyncio
async def test_verify_token_rejects_login_codes_and_revoked_users(monkeypatch):
    from fastapi import HTTPException

    session_token = auth.create_access_token(telegram_id=123456789)
    assert (await auth.verify_token(token=session_token))["telegram_id"] == 123456789

    # login code is not a session
    with pytest.raises(HTTPException) as exc:
        await auth.verify_token(token=auth.create_login_code(123456789))
    assert exc.value.status_code == 401

    # removed from allowlist -> existing token stops working immediately
    monkeypatch.setenv("ALLOWED_TELEGRAM_IDS", "1")
    monkeypatch.delenv("TELEGRAM_ADMIN_CHAT_IDS", raising=False)
    with pytest.raises(HTTPException) as exc:
        await auth.verify_token(token=session_token)
    assert exc.value.status_code == 403


def test_secret_key_has_no_builtin_default(monkeypatch):
    monkeypatch.delenv("SECRET_KEY", raising=False)
    with pytest.raises(RuntimeError):
        auth.create_access_token(telegram_id=1)


# ---------------------------------------------------------------- HTTP endpoints
@pytest.fixture
def client():
    from httpx import ASGITransport, AsyncClient

    try:
        from backend.main import app
    except ImportError:
        from main import app
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver")


@pytest.mark.asyncio
async def test_auth_rejects_bare_telegram_id(client):
    """The old hole: anyone could send an arbitrary telegram_id and get a token."""
    async with client as c:
        r = await c.post("/api/auth/telegram", json={"telegram_id": 123456789, "first_name": "Evil"})
        assert r.status_code == 401
        r = await c.post(
            "/api/auth/telegram",
            json={"telegram_id": 123456789, "first_name": "Evil"},
            headers={"X-Internal-Key": "wrong-key"},
        )
        assert r.status_code == 401


@pytest.mark.asyncio
async def test_auth_rejects_forged_init_data(client):
    async with client as c:
        r = await c.post("/api/auth/telegram", json={"init_data": make_init_data(tamper=True)})
        assert r.status_code == 401
        r = await c.post("/api/auth/telegram", json={"init_data": "hash=abc"})
        assert r.status_code == 401


@pytest.mark.asyncio
async def test_auth_denies_valid_init_data_of_non_allowlisted_user(client):
    async with client as c:
        r = await c.post("/api/auth/telegram", json={"init_data": make_init_data(user_id=777000777)})
        assert r.status_code == 403


@pytest.mark.asyncio
async def test_auth_denies_trusted_service_call_for_non_allowlisted_user(client):
    async with client as c:
        r = await c.post(
            "/api/auth/telegram",
            json={"telegram_id": 777000777, "first_name": "Stranger"},
            headers={"X-Internal-Key": "ci-test-internal-worker-key"},
        )
        assert r.status_code == 403


@pytest.mark.asyncio
async def test_login_link_requires_service_key_and_allowlist(client):
    async with client as c:
        r = await c.post("/api/auth/login-link", json={"telegram_id": 123456789})
        assert r.status_code == 401
        r = await c.post(
            "/api/auth/login-link",
            json={"telegram_id": 777000777},
            headers={"X-Internal-Key": "ci-test-internal-worker-key"},
        )
        assert r.status_code == 403
        r = await c.post(
            "/api/auth/login-link",
            json={"telegram_id": 123456789},
            headers={"X-Internal-Key": "ci-test-internal-worker-key"},
        )
        assert r.status_code == 200
        assert r.json()["code"]


@pytest.mark.asyncio
async def test_exchange_rejects_garbage_and_session_tokens(client):
    async with client as c:
        r = await c.post("/api/auth/exchange", json={"code": "not-a-jwt"})
        assert r.status_code == 401
        r = await c.post("/api/auth/exchange", json={"code": auth.create_access_token(telegram_id=123456789)})
        assert r.status_code == 401


@pytest.mark.asyncio
async def test_admin_endpoint_rejects_secret_key_as_credential(client):
    """SECRET_KEY used to double as an admin token."""
    async with client as c:
        for headers in (
            {"X-Admin-Token": "ci-test-secret-key-not-for-production"},
            {"Authorization": "Bearer ci-test-secret-key-not-for-production"},
        ):
            r = await c.post("/api/system/reset", json={"mode": "clean"}, headers=headers)
            assert r.status_code in (401, 403)
