"""Test environment: harmless fake values so tests never depend on a real .env."""
import os

os.environ.setdefault("SECRET_KEY", "ci-test-secret-key-not-for-production")
os.environ.setdefault("ADMIN_TOKEN", "ci-test-admin-token")
os.environ.setdefault("INTERNAL_API_KEY", "ci-test-internal-worker-key")
os.environ.setdefault("TELEGRAM_BOT_TOKEN", "123456:ABCdefGhIJKlmNoPQRsTUVwxyZ_0123456")
os.environ.setdefault("ALLOWED_TELEGRAM_IDS", "123456789")
