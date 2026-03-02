#!/usr/bin/env sh
set -eu

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 <backup-file.dump>"
  exit 1
fi

BACKUP_FILE="$1"
TARGET_DATABASE_URL="${TARGET_DATABASE_URL:-${DATABASE_URL:-}}"

if [ -z "$TARGET_DATABASE_URL" ]; then
  echo "TARGET_DATABASE_URL or DATABASE_URL is required"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Backup file not found: $BACKUP_FILE"
  exit 1
fi

if ! command -v pg_restore >/dev/null 2>&1; then
  echo "pg_restore command is required"
  exit 1
fi

if ! command -v sha256sum >/dev/null 2>&1; then
  echo "sha256sum command is required"
  exit 1
fi

if [ -f "$BACKUP_FILE.sha256" ]; then
  echo "Verifying checksum"
  sha256sum -c "$BACKUP_FILE.sha256"
fi

echo "Restoring backup into target database"
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --dbname="$TARGET_DATABASE_URL" \
  "$BACKUP_FILE"

echo "Restore complete"
