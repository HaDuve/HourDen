#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$ROOT/.env"
  set +a
fi

BASE_URL="${HOURDEN_BASE_URL:-https://hourden.hannesduve.com}"
OPERATOR_EMAIL="${HOURDEN_OPERATOR_EMAIL:-}"
OPERATOR_PASSWORD="${HOURDEN_OPERATOR_PASSWORD:-}"

if [[ -z "$OPERATOR_EMAIL" || -z "$OPERATOR_PASSWORD" ]]; then
  echo "Set HOURDEN_OPERATOR_EMAIL and HOURDEN_OPERATOR_PASSWORD (e.g. in .env)." >&2
  exit 1
fi

echo "Checking ${BASE_URL}…"

node "$ROOT/scripts/run-production-verify.mjs"

echo "Production verification passed for ${BASE_URL}"
