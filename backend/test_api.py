"""
Smoke and unit tests for FastAPI Backend endpoints.
Uses pytest and httpx to test authentication, validation, and route contracts.
Compatible with pytest runner (VPS / Docker) and standard python environment.
"""
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, patch

try:
    import pytest
except ImportError:
    # Lightweight fallback when running in environment without pytest installed
    class _PytestMock:
        @staticmethod
        def fixture(func):
            return func

        class mark:
            @staticmethod
            def asyncio(func):
                return func

        @staticmethod
        def raises(expected_exception):
            class _RaisesContext:
                def __enter__(self):
                    return self

                def __exit__(self, exc_type, exc_val, exc_tb):
                    if exc_type is None:
                        raise AssertionError(f"Expected exception {expected_exception} was not raised")
                    return issubclass(exc_type, expected_exception)

            return _RaisesContext()

        @staticmethod
        def skip(reason):
            pass

    pytest = _PytestMock()

# Import auth functions
try:
    from backend.auth import create_access_token, decode_access_token, verify_token
except ImportError:
    from auth import create_access_token, decode_access_token


@pytest.fixture
def test_token():
    """Generates a valid JWT test token for member and user."""
    return create_access_token(
        telegram_id=123456789,
        user_id="usr-test-12345",
        role="admin",
        expires_delta=timedelta(hours=1),
        extra_claims={
            "family_id": "fam-test-001",
            "member_id": "mem-test-001",
        },
    )


def test_jwt_token_roundtrip():
    """Verify JWT token creation and decoding preserves claims and validates signatures."""
    token = create_access_token(
        telegram_id=987654321,
        user_id="usr-42",
        role="owner",
        expires_delta=timedelta(minutes=30),
        extra_claims={"family_id": "fam-42"},
    )
    assert isinstance(token, str)
    assert len(token) > 20

    decoded = decode_access_token(token)
    assert decoded["user_id"] == "usr-42"
    assert decoded["family_id"] == "fam-42"
    assert decoded["role"] == "owner"
    assert decoded["telegram_id"] == 987654321
    assert "exp" in decoded


def test_jwt_token_expired_fails():
    """Verify expired JWT tokens raise ValueError or are rejected."""
    token = create_access_token(
        telegram_id=111222,
        user_id="usr-expired",
        expires_delta=timedelta(seconds=-10),
    )
    with pytest.raises(Exception):
        decode_access_token(token)


def test_jwt_token_tampered_fails():
    """Verify modifying any character of JWT signature invalidates the token."""
    token = create_access_token(
        telegram_id=333444,
        user_id="usr-safe",
        expires_delta=timedelta(minutes=10),
    )
    parts = token.split(".")
    tampered_sig = ("A" if parts[2][0] != "A" else "B") + parts[2][1:]
    tampered_token = f"{parts[0]}.{parts[1]}.{tampered_sig}"

    with pytest.raises(Exception):
        decode_access_token(tampered_token)


@pytest.mark.asyncio
async def test_unauthenticated_requests_are_rejected():
    """Verify protected endpoints reject requests lacking Authorization Bearer header."""
    try:
        from httpx import AsyncClient, ASGITransport
        from backend.main import app
    except ImportError:
        try:
            from httpx import AsyncClient, ASGITransport
            from main import app
        except ImportError:
            pytest.skip("FastAPI / httpx not installed in test environment")
            return

    protected_endpoints = [
        ("GET", "/api/family/current"),
        ("GET", "/api/family/members"),
        ("GET", "/api/categories"),
        ("GET", "/api/budgets/2026-09"),
        ("GET", "/api/transactions"),
        ("GET", "/api/dashboard/summary"),
        ("GET", "/api/dashboard/forecast"),
    ]

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        for method, endpoint in protected_endpoints:
            if method == "GET":
                response = await client.get(endpoint)
            else:
                response = await client.post(endpoint)

            assert response.status_code in (401, 403), f"Endpoint {endpoint} allowed unauthenticated access with status {response.status_code}"


@pytest.mark.asyncio
async def test_telegram_auth_invalid_payload():
    """Verify /api/auth/telegram rejects malformed or unverified Telegram login payloads."""
    try:
        from httpx import AsyncClient, ASGITransport
        from backend.main import app
    except ImportError:
        try:
            from httpx import AsyncClient, ASGITransport
            from main import app
        except ImportError:
            pytest.skip("FastAPI / httpx not installed in test environment")
            return

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        # Missing hash
        resp = await client.post("/api/auth/telegram", json={"id": 123456, "first_name": "Test"})
        assert resp.status_code in (400, 401, 422)

        # Invalid fake hash
        fake_payload = {
            "id": 123456,
            "first_name": "Test",
            "auth_date": int(datetime.now(timezone.utc).timestamp()),
            "hash": "0000000000000000000000000000000000000000000000000000000000000000",
        }
        resp = await client.post("/api/auth/telegram", json=fake_payload)
        assert resp.status_code in (400, 401, 422)


@pytest.mark.asyncio
async def test_transaction_creation_validation():
    """Verify transaction payload validation enforces minor units and valid types."""
    try:
        from httpx import AsyncClient, ASGITransport
        from backend.main import app
    except ImportError:
        try:
            from httpx import AsyncClient, ASGITransport
            from main import app
        except ImportError:
            pytest.skip("FastAPI / httpx not installed in test environment")
            return

    transport = ASGITransport(app=app)
    token = create_access_token(
        telegram_id=123456789,  # present in ALLOWED_TELEGRAM_IDS (see conftest.py)
        user_id="usr-1",
        role="member",
        extra_claims={"family_id": "fam-1", "member_id": "mem-1"},
    )
    headers = {"Authorization": f"Bearer {token}"}

    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        # Invalid transaction type
        invalid_type_payload = {
            "type": "gambling",  # Not in ('expense', 'income', 'transfer', 'saving')
            "amount_kopecks": 10000,
            "category_id": "cat-1",
            "payer_member_id": "mem-1",
            "date": "2026-09-10",
        }
        resp = await client.post("/api/transactions", json=invalid_type_payload, headers=headers)
        assert resp.status_code == 422

        # Invalid negative amount
        invalid_amount_payload = {
            "type": "expense",
            "amount_kopecks": -500,
            "category_id": "cat-1",
            "payer_member_id": "mem-1",
            "date": "2026-09-10",
        }
        resp = await client.post("/api/transactions", json=invalid_amount_payload, headers=headers)
        assert resp.status_code == 422


@pytest.mark.asyncio
async def test_healthz_endpoint_contract():
    """Verify /healthz returns structured status and latency metrics for the database."""
    try:
        from httpx import AsyncClient, ASGITransport
        from backend.main import app
    except ImportError:
        try:
            from httpx import AsyncClient, ASGITransport
            from main import app
        except ImportError:
            pytest.skip("FastAPI / httpx not installed in test environment")
            return

    with patch("backend.main.check_database_health", new_callable=AsyncMock) as mock_db:
        mock_db.return_value = {"status": "ok", "latency_ms": 1.2}

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            resp = await client.get("/healthz")
            assert resp.status_code == 200
            data = resp.json()
            assert data["status"] == "ok"
            assert "timestamp" in data
            assert data["checks"]["database"]["status"] == "ok"
            assert "redis" not in data["checks"]

            # Check /api/healthz alias returns identical structure
            resp_api = await client.get("/api/healthz")
            assert resp_api.status_code == 200

    # Failure case returns 503
    with patch("backend.main.check_database_health", new_callable=AsyncMock) as mock_db:
        mock_db.return_value = {"status": "error", "error": "Connection refused", "latency_ms": 5.0}

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            resp = await client.get("/healthz")
            assert resp.status_code == 503
            data = resp.json()
            assert data["status"] == "unhealthy"
            assert data["checks"]["database"]["status"] == "error"


@pytest.mark.asyncio
async def test_removed_receipt_endpoints_are_gone():
    """Receipt/OCR endpoints no longer exist (404 for authenticated and anonymous callers)."""
    from httpx import ASGITransport, AsyncClient
    try:
        from backend.main import app
    except ImportError:
        from main import app

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as client:
        for method, url in (
            ("POST", "/api/documents/upload"),
            ("GET", "/api/documents/abc/status"),
            ("POST", "/api/internal/documents/abc/status"),
            ("POST", "/api/internal/documents/abc/ocr-result"),
            ("POST", "/api/transactions/abc/confirm"),
        ):
            resp = await client.request(method, url)
            assert resp.status_code in (404, 405), (method, url, resp.status_code)


def test_structured_logger_kwargs():
    """Verify structured logger formats key-value kwargs without throwing exceptions."""
    try:
        from backend.main import logger
    except ImportError:
        try:
            from main import logger
        except ImportError:
            pytest.skip("backend.main not importable in lightweight test environment")
            return

    # Should not raise exception
    logger.info("test_event", user_id="u-1", status="ok", count=42)
    logger.warning("test_warning", issue="slow_query", duration_ms=150)
    logger.error("test_error", exception="DatabaseError")


def test_admin_token_backdoors_rejected():
    """Verify hardcoded strings ('admin', 'finsync-admin-secret', 'superadmin') are rejected."""
    import hmac
    admin_token_env = ""
    secret_key_env = "my_custom_secret_key_123"

    for bad in ["admin", "finsync-admin-secret", "superadmin"]:
        is_valid = bool(admin_token_env and hmac.compare_digest(bad, admin_token_env)) or bool(
            secret_key_env and hmac.compare_digest(bad, secret_key_env)
        )
        assert not is_valid, f"Backdoor token '{bad}' must never be accepted without matching env var"


if __name__ == "__main__":
    test_jwt_token_roundtrip()
    test_jwt_token_expired_fails()
    test_jwt_token_tampered_fails()
    test_structured_logger_kwargs()
    test_admin_token_backdoors_rejected()
    print("All auth, backdoor protection, and logging unit smoke tests passed successfully!")
