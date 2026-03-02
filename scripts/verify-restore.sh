#!/usr/bin/env sh
set -eu

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 <backup-file.dump>"
  exit 1
fi

BACKUP_FILE="$1"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required"
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql command is required"
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "node command is required"
  exit 1
fi

BASE_DB_NAME="$(node -e 'const u=new URL(process.env.DATABASE_URL); console.log(u.pathname.replace(/^\//, ""));')"
ADMIN_DATABASE_URL="$(node -e 'const u=new URL(process.env.DATABASE_URL); u.pathname="/postgres"; console.log(u.toString());')"
TEST_DB="${BASE_DB_NAME}_restore_test_$(date +%Y%m%d%H%M%S)"
TARGET_DATABASE_URL="$(TEST_DB="$TEST_DB" node -e 'const u=new URL(process.env.DATABASE_URL); u.pathname="/" + process.env.TEST_DB; console.log(u.toString());')"

cleanup() {
  psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"$TEST_DB\";" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

echo "Creating restore test database: $TEST_DB"
psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"$TEST_DB\";" >/dev/null

STARTED_AT="$(date +%s)"
TARGET_DATABASE_URL="$TARGET_DATABASE_URL" "$(dirname "$0")/restore-db.sh" "$BACKUP_FILE"

REQUIRED_TABLES='config,instance_membership,post,notification,audit_log'
FOUND_COUNT="$(psql "$TARGET_DATABASE_URL" -At -c "
SELECT count(*)
FROM unnest(string_to_array('$REQUIRED_TABLES', ',')) AS t(name)
WHERE to_regclass('public.' || t.name) IS NOT NULL;")"

if [ "$FOUND_COUNT" -lt 5 ]; then
  echo "Restore validation failed: expected required tables not found"
  exit 1
fi

ROW_CHECK="$(psql "$TARGET_DATABASE_URL" -At -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")"
if [ "$ROW_CHECK" -eq 0 ]; then
  echo "Restore validation failed: no public tables"
  exit 1
fi

ENDED_AT="$(date +%s)"
DURATION="$((ENDED_AT - STARTED_AT))"

echo "Restore validation successful"
echo "Restore duration: ${DURATION}s"
echo "Validated required tables: $REQUIRED_TABLES"
