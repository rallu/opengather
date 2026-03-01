#!/usr/bin/env sh
set -eu

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
HUB_DIR="$(cd "$ROOT_DIR/../opengather-hub" && pwd)"

export DATABASE_URL="${DATABASE_URL:-postgres://opengather:opengather@localhost:5432/opengather}"

cleanup() {
  kill "$API_WEB_PID" "$HUB_PID" 2>/dev/null || true
}

trap cleanup INT TERM EXIT

(
  cd "$ROOT_DIR"
  npm run dev
) &
API_WEB_PID=$!

(
  cd "$HUB_DIR"
  npm run dev
) &
HUB_PID=$!

wait "$API_WEB_PID" "$HUB_PID"
