#!/usr/bin/env bash
# =====================================================================
# FinSync (Семейный Бюджет) - VPS Restore Script
# Restores the PostgreSQL database from a pg_dump backup.
# Usage: ./scripts/restore.sh [path_to_db_dump.sql.gz]
# =====================================================================

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/finsync/backups}"
PG_CONTAINER="${PG_CONTAINER:-family_budget_postgres}"
DB_USER="${DB_USER:-budget_admin}"
DB_NAME="${DB_NAME:-family_budget}"

DB_FILE="${1:-}"

# If no DB file specified, pick the latest one from backup dir
if [ -z "$DB_FILE" ]; then
    LATEST_DB=$(find "${BACKUP_DIR}/db" -type f -name "*.sql.gz" 2>/dev/null | sort -r | head -n 1 || true)
    if [ -n "$LATEST_DB" ]; then
        echo "Found latest database backup: $LATEST_DB"
        DB_FILE="$LATEST_DB"
    else
        echo "Error: No database backup file provided and none found in ${BACKUP_DIR}/db"
        echo "Usage: $0 [path/to/backup.sql.gz]"
        exit 1
    fi
fi

if [ ! -f "$DB_FILE" ]; then
    echo "Error: Database backup file does not exist: $DB_FILE"
    exit 1
fi

echo "====================================================================="
echo "WARNING: You are about to RESTORE the FinSync database from:"
echo "  DB File: $DB_FILE"
echo "Current data in database '${DB_NAME}' will be overwritten!"
echo "====================================================================="
read -p "Are you sure you want to proceed with restore? (y/N): " CONFIRM
if [[ ! "$CONFIRM" =~ ^[YyДд]$ ]]; then
    echo "Restore cancelled."
    exit 0
fi

echo "[$(date)] Stopping app services to prevent database lock..."
docker compose stop backend telegram_bot dashboard 2>/dev/null || true

echo "[$(date)] Restoring PostgreSQL database '${DB_NAME}'..."
gunzip -c "$DB_FILE" | docker exec -i "${PG_CONTAINER}" psql -U "${DB_USER}" -d "${DB_NAME}"

echo "[$(date)] Database restored successfully."

echo "[$(date)] Restarting all FinSync services..."
docker compose up -d

echo "[$(date)] FinSync restoration completed successfully!"
