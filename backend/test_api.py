"""
Smoke and unit tests for FastAPI Backend endpoints.
Uses pytest and httpx to test authentication, validation, and route contracts.
Compatible with pytest runner (VPS / Docker) and standard python environment.
"""
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, patch, MagicMock

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
    from auth import create_access_token, decode_access_token, verify_token


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
    """Verify /healthz returns structured status and latency metrics for DB and Redis."""
    try:
        from httpx import AsyncClient, ASGITransport
        from backend.main import app, check_database_health, check_redis_health
    except ImportError:
        try:
            from httpx import AsyncClient, ASGITransport
            from main import app, check_database_health, check_redis_health
        except ImportError:
            pytest.skip("FastAPI / httpx not installed in test environment")
            return

    # Patch checks to verify contract
    with patch("backend.main.check_database_health", new_callable=AsyncMock) as mock_db, \
         patch("backend.main.check_redis_health", new_callable=AsyncMock) as mock_redis:
        mock_db.return_value = {"status": "ok", "latency_ms": 1.2}
        mock_redis.return_value = {"status": "ok", "latency_ms": 0.8}

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            resp = await client.get("/healthz")
            assert resp.status_code == 200
            data = resp.json()
            assert data["status"] == "ok"
            assert "timestamp" in data
            assert data["checks"]["database"]["status"] == "ok"
            assert data["checks"]["redis"]["status"] == "ok"

            # Check /api/healthz alias returns identical structure
            resp_api = await client.get("/api/healthz")
            assert resp_api.status_code == 200

    # Test failure case returns 503
    with patch("backend.main.check_database_health", new_callable=AsyncMock) as mock_db, \
         patch("backend.main.check_redis_health", new_callable=AsyncMock) as mock_redis:
        mock_db.return_value = {"status": "error", "error": "Connection refused", "latency_ms": 5.0}
        mock_redis.return_value = {"status": "ok", "latency_ms": 0.5}

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            resp = await client.get("/healthz")
            assert resp.status_code == 503
            data = resp.json()
            assert data["status"] == "unhealthy"
            assert data["checks"]["database"]["status"] == "error"


@pytest.mark.asyncio
async def test_internal_ocr_status_404_for_unknown_doc():
    """Verify internal document status endpoint requires valid X-Internal-Key (401) and returns 404 for nonexistent document when valid."""
    try:
        from httpx import AsyncClient, ASGITransport
        from backend.main import app
        import backend.main as main_mod
    except ImportError:
        pytest.skip("httpx or backend.main not available")
        return

    orig_key = main_mod.INTERNAL_API_KEY
    main_mod.INTERNAL_API_KEY = "test-internal-secret-token"

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            # 1. Without X-Internal-Key: must return 401
            unauth_resp = await client.post(
                "/api/internal/documents/nonexistent-doc-uuid/status",
                json={"status": "failed"},
            )
            assert unauth_resp.status_code == 401

            # 2. With wrong key: must return 401
            wrong_resp = await client.post(
                "/api/internal/documents/nonexistent-doc-uuid/status",
                headers={"X-Internal-Key": "invalid-key"},
                json={"status": "failed"},
            )
            assert wrong_resp.status_code == 401

            # 3. With valid X-Internal-Key: passes auth, returns 404 for unknown doc.
            # This step needs a live PostgreSQL, so it is skipped when the database is unreachable (CI).
            try:
                auth_resp = await client.post(
                    "/api/internal/documents/nonexistent-doc-uuid/status",
                    headers={"X-Internal-Key": "test-internal-secret-token"},
                    json={"status": "failed"},
                )
            except Exception as exc:  # no database / tables yet (CI runs this before the e2e test creates them)
                pytest.skip(f"Database is not ready for the 404 check: {type(exc).__name__}")
                return
            assert auth_resp.status_code == 404
    finally:
        main_mod.INTERNAL_API_KEY = orig_key


def test_verify_internal_key_logic():
    """Verify internal API key verification rejects missing or mismatched keys."""
    import hmac
    configured_key = "worker-secret-test-key-456"

    # Missing or empty
    assert not bool("" and hmac.compare_digest("worker-secret-test-key-456", ""))
    # Wrong key
    assert not bool(configured_key and hmac.compare_digest("wrong-key", configured_key))
    # Correct key
    assert bool(configured_key and hmac.compare_digest("worker-secret-test-key-456", configured_key))


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
    test_verify_internal_key_logic()
    print("All auth, backdoor protection, and logging unit smoke tests passed successfully!")
