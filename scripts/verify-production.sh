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
BASIC_AUTH_USER="${HOURDEN_BASIC_AUTH_USER:-}"
BASIC_AUTH_PASSWORD="${HOURDEN_BASIC_AUTH_PASSWORD:-}"

if [[ -z "$BASIC_AUTH_USER" || -z "$BASIC_AUTH_PASSWORD" ]]; then
  echo "Set HOURDEN_BASIC_AUTH_USER and HOURDEN_BASIC_AUTH_PASSWORD to verify production."
  exit 1
fi

echo "Checking ${BASE_URL} (basic auth)…"

html_status="$(
  curl --fail --silent --show-error \
    --user "${BASIC_AUTH_USER}:${BASIC_AUTH_PASSWORD}" \
    --write-out '%{http_code}' \
    --output /tmp/hourden-index.html \
    "${BASE_URL}/"
)"

if [[ "$html_status" != "200" ]]; then
  echo "Expected 200 from ${BASE_URL}/, got ${html_status}"
  exit 1
fi

grep -q "HourDen" /tmp/hourden-index.html

health_json="$(
  curl --fail --silent --show-error \
    --user "${BASIC_AUTH_USER}:${BASIC_AUTH_PASSWORD}" \
    "${BASE_URL}/api/health"
)"

echo "$health_json" | grep -q '"status":"ok"'
echo "$health_json" | grep -q 'a0000000-0000-4000-8000-000000000001'

echo "Production verification passed for ${BASE_URL}"
