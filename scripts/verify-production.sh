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

html_status="$(
  curl --fail --silent --show-error \
    --write-out '%{http_code}' \
    --output /tmp/hourden-index.html \
    "${BASE_URL}/"
)"

if [[ "$html_status" != "200" ]]; then
  echo "Expected 200 from ${BASE_URL}/, got ${html_status}" >&2
  exit 1
fi

grep -q "HourDen" /tmp/hourden-index.html

health_json="$(
  curl --fail --silent --show-error \
    "${BASE_URL}/api/health"
)"

echo "$health_json" | grep -q '"ok":true'

login_body="$(
  HOURDEN_OPERATOR_EMAIL="$OPERATOR_EMAIL" \
  HOURDEN_OPERATOR_PASSWORD="$OPERATOR_PASSWORD" \
  python3 -c 'import json, os; print(json.dumps({"email": os.environ["HOURDEN_OPERATOR_EMAIL"], "password": os.environ["HOURDEN_OPERATOR_PASSWORD"]}))'
)"

login_json="$(
  curl --fail --silent --show-error \
    -X POST "${BASE_URL}/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "$login_body"
)"

echo "$login_json" | grep -q "\"email\":\"${OPERATOR_EMAIL}\""

echo "Production verification passed for ${BASE_URL}"
