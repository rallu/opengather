#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Please run as root (or with sudo)." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y docker.io postgresql

cat <<'MSG'
Installed packages:
  - docker.io
  - postgresql

To verify:
  docker --version
  psql --version

To start services on Ubuntu hosts with systemd:
  systemctl enable --now docker
  systemctl enable --now postgresql
MSG
