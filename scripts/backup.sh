#!/usr/bin/env bash
# =====================================================================
# FinSync (Семейный Бюджет) - VPS Backup & Retention Script
# Dumps the PostgreSQL database with pg_dump, applies gzip compression
# and rotates backups (keeps 14 days).
# =====================================================================

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/finsync/backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
PG_CONTAINER="${PG_CONTAINER:-family_budget_postgres}"
DB_USER="${DB_USER:-budget_admin}"
DB_NAME="${DB_NAME:-family_budget}"

mkdir -p "${BACKUP_DIR}/db"

echo "[$(date)] Starting FinSync backup..."

# 1. Database dump with pg_dump and gzip
DB_FILE="${BACKUP_DIR}/db/backup_${DB_NAME}_${TIMESTAMP}.sql.gz"
echo "Dumping PostgreSQL database '${DB_NAME}'..."
docker exec -t "${PG_CONTAINER}" pg_dump -U "${DB_USER}" -d "${DB_NAME}" --clean --if-exists | gzip -9 > "${DB_FILE}"
echo "Database backup created: ${DB_FILE} ($(du -sh "${DB_FILE}" | cut -f1))"

# 2. Retention policy: delete backups older than 14 days
echo "Cleaning up backups older than 14 days..."
find "${BACKUP_DIR}/db" -type f -name "*.sql.gz" -mtime +14 -exec rm -f {} +

echo "[$(date)] Backup completed successfully."
