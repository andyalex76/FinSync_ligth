#!/usr/bin/env bash
# =====================================================================
# FinSync (Семейный Бюджет) - VPS Restore Script
# Restores PostgreSQL database and uploaded receipt files from backup.
# Usage: ./scripts/restore.sh [path_to_db_dump.sql.gz] [path_to_receipts.tar.gz]
# =====================================================================

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/finsync/backups}"
PG_CONTAINER="${PG_CONTAINER:-family_budget_postgres}"
DB_USER="${DB_USER:-budget_admin}"
DB_NAME="${DB_NAME:-family_budget}"

# Auto-detect uploads volume name
if [ -z "${UPLOADS_VOLUME:-}" ]; then
    DETECTED_VOL=$(docker volume ls -q | grep -E '(_uploads_data$|^uploads_data$)' | head -n 1 || true)
    UPLOADS_VOLUME="${DETECTED_VOL:-finsync_uploads_data}"
fi

DB_FILE="${1:-}"
MEDIA_FILE="${2:-}"

# If no DB file specified, pick the latest one from backup dir
if [ -z "$DB_FILE" ]; then
    LATEST_DB=$(find "${BACKUP_DIR}/db" -type f -name "*.sql.gz" 2>/dev/null | sort -r | head -n 1 || true)
    if [ -n "$LATEST_DB" ]; then
        echo "Found latest database backup: $LATEST_DB"
        DB_FILE="$LATEST_DB"
    else
        echo "Error: No database backup file provided and none found in ${BACKUP_DIR}/db"
        echo "Usage: $0 [path/to/backup.sql.gz] [optional_path/to/receipts.tar.gz]"
        exit 1
    fi
fi

if [ ! -f "$DB_FILE" ]; then
    echo "Error: Database backup file does not exist: $DB_FILE"
    exit 1
fi

echo "====================================================================="
echo "WARNING: You are about to RESTORE the FinSync database from:"
echo "  DB File:    $DB_FILE"
if [ -n "$MEDIA_FILE" ]; then
    echo "  Media File: $MEDIA_FILE"
fi
echo "Current data in database '${DB_NAME}' will be overwritten!"
echo "====================================================================="
read -p "Are you sure you want to proceed with restore? (y/N): " CONFIRM
if [[ ! "$CONFIRM" =~ ^[YyДд]$ ]]; then
    echo "Restore cancelled."
    exit 0
fi

echo "[$(date)] Stopping app services to prevent database lock..."
docker compose stop backend telegram_bot ocr_worker dashboard 2>/dev/null || true

echo "[$(date)] Restoring PostgreSQL database '${DB_NAME}'..."
gunzip -c "$DB_FILE" | docker exec -i "${PG_CONTAINER}" psql -U "${DB_USER}" -d "${DB_NAME}"

echo "[$(date)] Database restored successfully."

# Restore media files if provided or found
if [ -z "$MEDIA_FILE" ]; then
    LATEST_MEDIA=$(find "${BACKUP_DIR}/media" -type f -name "*.tar.gz" 2>/dev/null | sort -r | head -n 1 || true)
    if [ -n "$LATEST_MEDIA" ]; then
        MEDIA_FILE="$LATEST_MEDIA"
    fi
fi

if [ -n "$MEDIA_FILE" ] && [ -f "$MEDIA_FILE" ]; then
    echo "[$(date)] Restoring uploaded receipts to volume '${UPLOADS_VOLUME}'..."
    MEDIA_DIR=$(dirname "$(realpath "$MEDIA_FILE")")
    MEDIA_NAME=$(basename "$MEDIA_FILE")
    docker run --rm -v "${UPLOADS_VOLUME}:/data" -v "${MEDIA_DIR}:/backup:ro" alpine \
        tar -xzf "/backup/${MEDIA_NAME}" -C /data
    echo "[$(date)] Receipt files restored successfully."
fi

echo "[$(date)] Restarting all FinSync services..."
docker compose up -d

echo "[$(date)] FinSync restoration completed successfully!"
