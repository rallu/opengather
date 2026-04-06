#!/usr/bin/env bash
set -euo pipefail

DATABASE_URL="${DATABASE_URL:-postgres://opengather:opengather@127.0.0.1:5433/opengather_e2e}"
STORAGE_ROOT="${STORAGE_ROOT:-./.playwright/storage}"
MEDIA_LOCAL_ROOT="${MEDIA_LOCAL_ROOT:-${STORAGE_ROOT}/media}"

if ! command -v psql >/dev/null 2>&1; then
  echo "PostgreSQL client tools are required to prepare the e2e database." >&2
  exit 1
fi

read -r ADMIN_DATABASE_URL DB_NAME <<EOF
$(DATABASE_URL="$DATABASE_URL" node <<'NODE'
const connectionUrl = new URL(process.env.DATABASE_URL);
const databaseName = connectionUrl.pathname.replace(/^\/+/, "");
connectionUrl.pathname = "/postgres";
connectionUrl.search = "";
console.log(`${connectionUrl.toString()} ${databaseName}`);
NODE
)
EOF

if [[ -z "$DB_NAME" ]]; then
  echo "DATABASE_URL must include a database name." >&2
  exit 1
fi

if ! psql "$ADMIN_DATABASE_URL" -tAc "select 1 from pg_database where datname = '${DB_NAME}'" | grep -q 1; then
  psql "$ADMIN_DATABASE_URL" -c "create database \"${DB_NAME}\""
fi

rm -rf "$STORAGE_ROOT"
mkdir -p "$MEDIA_LOCAL_ROOT"

DATABASE_URL="$DATABASE_URL" npx prisma db push --force-reset --accept-data-loss
DATABASE_URL="$DATABASE_URL" npx prisma generate
