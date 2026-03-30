#!/usr/bin/env bash
set -euo pipefail

DB_NAME="${DB_NAME:-opengather}"
DB_USER="${DB_USER:-opengather}"
DB_PASSWORD="${DB_PASSWORD:-opengather}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"

if ! command -v psql >/dev/null 2>&1; then
  echo "PostgreSQL client tools are required. Run ./scripts/install-runtime-deps.sh first." >&2
  exit 1
fi

if command -v service >/dev/null 2>&1; then
  service postgresql start >/dev/null 2>&1 || true
fi

runuser -u postgres -- psql -tc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 || \
  runuser -u postgres -- psql -c "CREATE ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASSWORD}';"

runuser -u postgres -- psql -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 || \
  runuser -u postgres -- createdb -O "${DB_USER}" "${DB_NAME}"

cat > .env.local <<ENV
APP_BASE_URL=http://localhost:5173
DATABASE_URL=postgres://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}
BETTER_AUTH_SECRET=opengather-dev-secret-change-me
MEDIA_LOCAL_ROOT=./storage/media
ENV

echo "Wrote .env.local with DATABASE_URL=postgres://${DB_USER}:***@${DB_HOST}:${DB_PORT}/${DB_NAME}"
echo "Environment is ready."
