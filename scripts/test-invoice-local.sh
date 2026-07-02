#!/usr/bin/env bash
# End-to-end smoke test: Client → Project → Time Entries → Invoice PDF (local API via curl).
#
# Prerequisites:
#   - Postgres + API running (docker compose up, or npm run dev:api with DATABASE_URL)
#   - curl, node
#
# Usage:
#   ./scripts/test-invoice-local.sh
#   OUTPUT=./my-invoice.pdf ./scripts/test-invoice-local.sh
#   UPDATE_SNAPSHOT=1 ./scripts/test-invoice-local.sh   # accept PDF layout changes
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$ROOT/.env"
  set +a
fi

BASE_URL="${HOURDEN_API_URL:-http://localhost:${PORT:-3001}}"
OUTPUT="${OUTPUT:-$ROOT/invoice-test.pdf}"
BILLING_FROM="${BILLING_FROM:-2026-06-01}"
BILLING_TO="${BILLING_TO:-2026-06-30}"
RUN_ID="$(date +%s)"

json_field() {
  node -e "
    const data = JSON.parse(process.argv[1]);
    const path = process.argv[2].split('.');
    let value = data;
    for (const key of path) value = value?.[key];
    if (value === undefined || value === null) process.exit(1);
    process.stdout.write(String(value));
  " "$1" "$2"
}

curl_api() {
  local args=(-sS --fail-with-body)
  if [[ -n "${HOURDEN_API_KEY:-}" ]]; then
    args+=(-H "X-API-Key: ${HOURDEN_API_KEY}")
  fi
  curl "${args[@]}" "$@"
}

echo "HourDen invoice smoke test → ${BASE_URL}"
echo "Billing period: ${BILLING_FROM} … ${BILLING_TO}"
echo "Output PDF: ${OUTPUT}"
echo

health="$(curl_api "${BASE_URL}/api/health")"
echo "Health: $(json_field "$health" status) (workspace $(json_field "$health" workspaceId))"

client_json="$(curl_api -X POST "${BASE_URL}/api/clients" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Invoice Test ${RUN_ID}\",
    \"defaultRate\": 60,
    \"legalName\": \"Invoice Test GmbH ${RUN_ID}\",
    \"addressLine1\": \"Example Street 1\",
    \"addressLine2\": \"12345 Example City\"
  }")"
client_id="$(json_field "$client_json" id)"
echo "Client: $(json_field "$client_json" name) (${client_id})"

project_json="$(curl_api -X POST "${BASE_URL}/api/projects" \
  -H "Content-Type: application/json" \
  -d "{
    \"clientId\": \"${client_id}\",
    \"name\": \"Smoke test project\"
  }")"
project_id="$(json_field "$project_json" id)"
echo "Project: $(json_field "$project_json" name) (${project_id})"

curl_api -X POST "${BASE_URL}/api/time-entries" \
  -H "Content-Type: application/json" \
  -d "{
    \"projectId\": \"${project_id}\",
    \"description\": \"App Development\",
    \"startedAt\": \"2026-06-18T14:33:00.000Z\",
    \"endedAt\": \"2026-06-18T15:39:00.000Z\"
  }" >/dev/null

curl_api -X POST "${BASE_URL}/api/time-entries" \
  -H "Content-Type: application/json" \
  -d "{
    \"projectId\": \"${project_id}\",
    \"description\": \"App Development\",
    \"startedAt\": \"2026-06-18T09:43:00.000Z\",
    \"endedAt\": \"2026-06-18T09:51:00.000Z\"
  }" >/dev/null

echo "Logged 2 Time Entries (grouped: 74 min, 74 EUR)"

report="$(curl_api "${BASE_URL}/api/reports?from=${BILLING_FROM}&to=${BILLING_TO}")"
report_amount="$(node -e "
  const report = JSON.parse(process.argv[1]);
  const client = report.clients.find((c) => c.clientName.includes('Invoice Test'));
  if (!client) process.exit(1);
  console.log(client.totalAmount);
" "$report")"
echo "Report total for client: ${report_amount} EUR"

invoice_headers="$(mktemp)"
curl_api -X POST "${BASE_URL}/api/invoices" \
  -H "Content-Type: application/json" \
  -d "{
    \"clientId\": \"${client_id}\",
    \"from\": \"${BILLING_FROM}\",
    \"to\": \"${BILLING_TO}\"
  }" \
  -D "$invoice_headers" \
  -o "$OUTPUT"

invoice_number="$(grep -i '^x-invoice-number:' "$invoice_headers" | cut -d' ' -f2- | tr -d '\r')"
rm -f "$invoice_headers"

magic="$(head -c 4 "$OUTPUT")"
if [[ "$magic" != "%PDF" ]]; then
  echo "Expected a PDF at ${OUTPUT}, got:" >&2
  head -c 200 "$OUTPUT" >&2
  echo >&2
  exit 1
fi

bytes="$(wc -c < "$OUTPUT" | tr -d ' ')"
echo
echo "Invoice ${invoice_number} written to ${OUTPUT} (${bytes} bytes)"

legal_name="$(json_field "$client_json" legalName)"
smoke_golden="$ROOT/packages/domain/test/fixtures/invoice-smoke.snapshot.txt"
normalized_pdf="$(node "$ROOT/scripts/normalize-invoice-pdf-text.mjs" "$OUTPUT" \
  --invoice-number "$invoice_number" \
  --legal-name "$legal_name")"

if [[ "${UPDATE_SNAPSHOT:-}" == "1" ]]; then
  printf '%s' "$normalized_pdf" > "$smoke_golden"
  echo "Updated smoke snapshot: ${smoke_golden}"
elif [[ ! -f "$smoke_golden" ]]; then
  echo "Missing smoke snapshot ${smoke_golden}. Run UPDATE_SNAPSHOT=1 ./scripts/test-invoice-local.sh once." >&2
  exit 1
elif ! diff -u "$smoke_golden" <(printf '%s' "$normalized_pdf"); then
  echo "Invoice PDF layout changed (smoke snapshot). Review diff above." >&2
  echo "If the change is intentional: UPDATE_SNAPSHOT=1 ./scripts/test-invoice-local.sh" >&2
  exit 1
else
  echo "Smoke PDF matches layout snapshot."
fi

echo "Running domain invoice PDF snapshot test…"
(
  cd "$ROOT"
  npm run test -w @hourden/domain -- src/invoice-pdf-snapshot.test.ts >/dev/null
)
echo "Domain PDF snapshot test passed."
echo "Smoke test passed."
