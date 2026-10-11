#!/usr/bin/env sh
set -e

echo "Running database migrations (alembic upgrade head)..."
alembic -c backend/alembic.ini upgrade head || {
    echo "Direct upgrade failed, checking if tables were pre-created by initdb schema..."
    alembic -c backend/alembic.ini stamp head 2>/dev/null || echo "Alembic stamp skipped"
}

echo "Starting FinSync backend..."
exec uvicorn backend.main:app --host 0.0.0.0 --port 8000
