#!/usr/bin/env sh
set -eu

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups/postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required"
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "pg_dump command is required"
  exit 1
fi

if ! command -v sha256sum >/dev/null 2>&1; then
  echo "sha256sum command is required"
  exit 1
fi

mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_FILE="$BACKUP_DIR/opengather-$TIMESTAMP.dump"
CHECKSUM_FILE="$BACKUP_FILE.sha256"

STARTED_AT="$(date +%s)"

echo "Creating PostgreSQL backup: $BACKUP_FILE"
pg_dump \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="$BACKUP_FILE" \
  "$DATABASE_URL"

sha256sum "$BACKUP_FILE" > "$CHECKSUM_FILE"
ln -sfn "$(basename "$BACKUP_FILE")" "$BACKUP_DIR/latest.dump"
ln -sfn "$(basename "$CHECKSUM_FILE")" "$BACKUP_DIR/latest.dump.sha256"

find "$BACKUP_DIR" -type f -name 'opengather-*.dump' -mtime "+$RETENTION_DAYS" -delete
find "$BACKUP_DIR" -type f -name 'opengather-*.dump.sha256' -mtime "+$RETENTION_DAYS" -delete

ENDED_AT="$(date +%s)"
DURATION="$((ENDED_AT - STARTED_AT))"

echo "Backup complete in ${DURATION}s"
echo "Backup: $BACKUP_FILE"
echo "Checksum: $CHECKSUM_FILE"
