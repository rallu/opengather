#!/bin/bash
set -euo pipefail

STORAGE_ROOT="${STORAGE_ROOT:-/storage}"
DATABASE_URL="${DATABASE_URL:-}"
PGHOST="${INTERNAL_POSTGRES_HOST:-127.0.0.1}"
PGPORT="${INTERNAL_POSTGRES_PORT:-5432}"
PGDATABASE="${INTERNAL_POSTGRES_DB:-opengather}"
PGUSER="${INTERNAL_POSTGRES_USER:-opengather}"
PGPASSWORD="${INTERNAL_POSTGRES_PASSWORD:-opengather}"
PGDATA="${INTERNAL_POSTGRES_DATA_DIR:-$STORAGE_ROOT/postgres/data}"
PGRUN="${INTERNAL_POSTGRES_RUN_DIR:-$STORAGE_ROOT/postgres/run}"
PGLOG="${INTERNAL_POSTGRES_LOG_FILE:-$STORAGE_ROOT/postgres/postgres.log}"
MEDIA_LOCAL_ROOT="${MEDIA_LOCAL_ROOT:-$STORAGE_ROOT/media}"
VAPID_ENV_FILE="${VAPID_ENV_FILE:-$STORAGE_ROOT/vapid.env}"

export STORAGE_ROOT
export MEDIA_LOCAL_ROOT
export PGHOST
export PGPORT
export PGDATABASE
export PGUSER
export PGPASSWORD

mkdir -p "$STORAGE_ROOT" "$MEDIA_LOCAL_ROOT"

if [ -f "$VAPID_ENV_FILE" ] && { [ -z "${VAPID_PUBLIC_KEY:-}" ] || [ -z "${VAPID_PRIVATE_KEY:-}" ]; }; then
	set -a
	. "$VAPID_ENV_FILE"
	set +a
fi

if [ -z "${VAPID_PUBLIC_KEY:-}" ] || [ -z "${VAPID_PRIVATE_KEY:-}" ]; then
	node --input-type=module <<'EOF' >"$VAPID_ENV_FILE"
import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
EOF
	chmod 600 "$VAPID_ENV_FILE"
	set -a
	. "$VAPID_ENV_FILE"
	set +a
fi

if [ -z "${VAPID_SUBJECT:-}" ]; then
	if [ -n "${APP_BASE_URL:-}" ]; then
		VAPID_SUBJECT="$APP_BASE_URL"
	else
		VAPID_SUBJECT="mailto:admin@localhost"
	fi
fi

export VAPID_PUBLIC_KEY
export VAPID_PRIVATE_KEY
export VAPID_SUBJECT

cleanup() {
	if [ -n "${SERVER_PID:-}" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
		kill "$SERVER_PID"
	fi
	if [ -n "${WORKER_PID:-}" ] && kill -0 "$WORKER_PID" 2>/dev/null; then
		kill "$WORKER_PID"
	fi
	if [ -n "${POSTGRES_STARTED:-}" ]; then
		runuser -u postgres -- /usr/lib/postgresql/*/bin/pg_ctl -D "$PGDATA" stop -m fast >/dev/null 2>&1 || true
	fi
}

trap cleanup EXIT INT TERM

if [ -z "$DATABASE_URL" ]; then
	mkdir -p "$PGRUN" "$(dirname "$PGLOG")"
	chown -R postgres:postgres "$STORAGE_ROOT/postgres"

	if [ ! -s "$PGDATA/PG_VERSION" ]; then
		mkdir -p "$PGDATA"
		chown -R postgres:postgres "$PGDATA"
		chmod 700 "$PGDATA"
		runuser -u postgres -- /usr/lib/postgresql/*/bin/initdb \
			-D "$PGDATA" \
			--username=postgres \
			--auth=trust
	fi

	if ! grep -q "^unix_socket_directories = '$PGRUN'$" "$PGDATA/postgresql.conf"; then
		cat >>"$PGDATA/postgresql.conf" <<EOF
listen_addresses = '127.0.0.1'
port = ${PGPORT}
unix_socket_directories = '${PGRUN}'
EOF
	fi

	runuser -u postgres -- /usr/lib/postgresql/*/bin/pg_ctl \
		-D "$PGDATA" \
		-l "$PGLOG" \
		start
	POSTGRES_STARTED=1

	until pg_isready -h "$PGHOST" -p "$PGPORT" -U postgres >/dev/null 2>&1; do
		sleep 1
	done

	psql -h "$PGHOST" -p "$PGPORT" -U postgres -d postgres \
		-v ON_ERROR_STOP=1 \
		-v db_name="$PGDATABASE" \
		-v db_user="$PGUSER" \
		-v db_password="$PGPASSWORD" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'db_user', :'db_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'db_user')
\gexec
SELECT format('ALTER ROLE %I LOGIN PASSWORD %L', :'db_user', :'db_password')
\gexec
SELECT format('CREATE DATABASE %I OWNER %I', :'db_name', :'db_user')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'db_name')
\gexec
SQL

	DATABASE_URL="postgres://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT}/${PGDATABASE}"
	export DATABASE_URL
fi

npm run prisma:sync
npm run bootstrap:hosted

npm run worker:media &
WORKER_PID=$!

npm run start:server &
SERVER_PID=$!

wait -n "$WORKER_PID" "$SERVER_PID"
