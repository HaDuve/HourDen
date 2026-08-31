#!/bin/bash
# Run this on the VM to add HourDen vhosts to Portfolio's Caddyfile
set -e

CADDYFILE="/opt/Portfolio/caddy/Caddyfile"
BACKUP="${CADDYFILE}.backup-$(date +%Y%m%d-%H%M%S)"
HOURDEN_REPO="${HOURDEN_REPO:-/opt/HourDen}"
SNIPPET_SCRIPT="$HOURDEN_REPO/scripts/print-caddy-hourden-snippet.mjs"

if grep -q "hourden.com {" "$CADDYFILE" 2>/dev/null; then
  echo "HourDen apex vhost already exists in Caddyfile."
  exit 0
fi

if [ ! -f "$SNIPPET_SCRIPT" ]; then
  echo "Missing $SNIPPET_SCRIPT — deploy HourDen to $HOURDEN_REPO first (or set HOURDEN_REPO)." >&2
  exit 1
fi

echo "Backing up Caddyfile -> $BACKUP"
cp "$CADDYFILE" "$BACKUP"

echo "Adding HourDen vhosts to Caddyfile..."
printf '\n%s\n' "$(node "$SNIPPET_SCRIPT")" >> "$CADDYFILE"

echo "Reloading Caddy..."
cd /opt/Portfolio
docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile

echo "OK: HourDen vhosts added and Caddy reloaded."
echo "Backup saved: $BACKUP"
