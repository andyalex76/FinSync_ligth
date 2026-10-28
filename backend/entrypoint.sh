#!/usr/bin/env sh
set -e

echo "Applying database migrations (alembic upgrade head)..."
# Alembic is the only source of the schema. If a migration fails the container stops here
# (no silent "stamp"), so a broken database is never served.
alembic -c backend/alembic.ini upgrade head

echo "Starting FinSync backend..."
exec uvicorn backend.main:app --host 0.0.0.0 --port 8000
