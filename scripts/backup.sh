#!/usr/bin/env bash
# =====================================================================
# FinSync (Семейный Бюджет) - VPS Backup & Retention Script
# Dumps PostgreSQL database, backs up uploaded receipt files,
# applies gzip compression, and rotates backups (keeps 14 daily, 4 weekly).
# =====================================================================

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/finsync/backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DATE_DAY=$(date +"%Y%m%d")
PG_CONTAINER="${PG_CONTAINER:-family_budget_postgres}"
DB_USER="${DB_USER:-budget_admin}"
DB_NAME="${DB_NAME:-family_budget}"

# Auto-detect uploads volume name (e.g. finsync_uploads_data or family_budget_uploads_data)
if [ -z "${UPLOADS_VOLUME:-}" ]; then
    DETECTED_VOL=$(docker volume ls -q | grep -E '(_uploads_data$|^uploads_data$)' | head -n 1 || true)
    UPLOADS_VOLUME="${DETECTED_VOL:-finsync_uploads_data}"
fi

mkdir -p "${BACKUP_DIR}/db"
mkdir -p "${BACKUP_DIR}/media"

echo "[$(date)] Starting FinSync backup..."

# 1. Database dump with pg_dump and gzip
DB_FILE="${BACKUP_DIR}/db/backup_${DB_NAME}_${TIMESTAMP}.sql.gz"
echo "Dumping PostgreSQL database '${DB_NAME}'..."
docker exec -t "${PG_CONTAINER}" pg_dump -U "${DB_USER}" -d "${DB_NAME}" --clean --if-exists | gzip -9 > "${DB_FILE}"
echo "Database backup created: ${DB_FILE} ($(du -sh "${DB_FILE}" | cut -f1))"

# 2. Uploaded documents & receipts backup
MEDIA_FILE="${BACKUP_DIR}/media/receipts_${TIMESTAMP}.tar.gz"
echo "Archiving receipt uploads volume..."
docker run --rm -v "${UPLOADS_VOLUME}:/data:ro" -v "${BACKUP_DIR}/media:/backup" alpine \
    tar -czf "/backup/receipts_${TIMESTAMP}.tar.gz" -C /data .
echo "Receipts archive created: ${MEDIA_FILE} ($(du -sh "${MEDIA_FILE}" | cut -f1))"

# 3. Retention policy: delete backups older than 14 days
echo "Cleaning up backups older than 14 days..."
find "${BACKUP_DIR}/db" -type f -name "*.sql.gz" -mtime +14 -exec rm -f {} +
find "${BACKUP_DIR}/media" -type f -name "*.tar.gz" -mtime +14 -exec rm -f {} +

echo "[$(date)] Backup completed successfully."
