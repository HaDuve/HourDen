#!/bin/bash
# Fix HourDen Caddy route order: /api must be handled before file_server SPA fallback.
# Run: ssh root@VM 'bash -s' < scripts/fix-caddy-routes-vm.sh
set -e

CADDYFILE="/opt/Portfolio/caddy/Caddyfile"

python3 <<'PY'
import re
from pathlib import Path

path = Path("/opt/Portfolio/caddy/Caddyfile")
text = path.read_text()

match = re.search(r"hourden\.hannesduve\.com \{.*?\n\}", text, re.DOTALL)
if not match:
    raise SystemExit("hourden.hannesduve.com block not found in Caddyfile")

block = match.group(0)
auth = re.search(r"basic_auth \{[^}]+\}", block, re.DOTALL)
api = re.search(r"handle /api/\* \{[^}]+\}", block, re.DOTALL)
logs = re.search(r"log \{.*?\n    \}", block, re.DOTALL)

if not auth or not api:
    raise SystemExit("Could not parse hourden vhost (basic_auth or handle /api/* missing)")

log_section = f"\n\n    {logs.group(0)}" if logs else ""

replacement = f"""hourden.hannesduve.com {{
    {auth.group(0)}

    encode gzip zstd

    {api.group(0)}

    handle {{
        root * /var/www/hourden
        try_files {{path}} /index.html
        file_server
    }}{log_section}
}}"""

path.write_text(text[: match.start()] + replacement + text[match.end() :])
print("Rewrote hourden vhost with /api before static file_server.")
PY

cd /opt/Portfolio
docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile

echo "Smoke check via Caddy..."
curl -sf -u 'operator:RnDbP9p7J4zg5KLtWEUU' \
  -H 'Host: hourden.hannesduve.com' \
  https://localhost/api/health --resolve hourden.hannesduve.com:443:127.0.0.1 \
  | grep -q workspaceId
echo "OK: /api/health returns JSON through Caddy"
