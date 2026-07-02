#!/usr/bin/env bash
# Run this on the VM to add HourDen vhost to Portfolio's Caddyfile
set -euo pipefail

CADDYFILE="/opt/Portfolio/caddy/Caddyfile"
BACKUP="${CADDYFILE}.backup-$(date +%Y%m%d-%H%M%S)"

if grep -q "hourden.hannesduve.com" "$CADDYFILE" 2>/dev/null; then
  echo "HourDen vhost already exists in Caddyfile."
  exit 0
fi

echo "Backing up Caddyfile → $BACKUP"
cp "$CADDYFILE" "$BACKUP"

echo "Adding HourDen vhost to Caddyfile..."
cat >> "$CADDYFILE" <<'EOF'

hourden.hannesduve.com {
    basicauth {
        operator $2a$14$Hhcab4yh26gYSIWyztWgPuU0kfsJ2kx9D46jDfXRJjESEPaUtGgyS
    }

    root * /var/www/hourden
    encode gzip zstd
    try_files {path} /index.html
    file_server

    handle_path /api/* {
        reverse_proxy localhost:3001
    }

    log {
        output file /var/log/caddy/hourden-access.log {
            roll_size 50mb
            roll_keep 12
            roll_keep_for 8760h
        }
        format json
    }
}
EOF

echo "Reloading Caddy..."
cd /opt/Portfolio
docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile

echo "✓ HourDen vhost added and Caddy reloaded."
echo "  Backup saved: $BACKUP"
