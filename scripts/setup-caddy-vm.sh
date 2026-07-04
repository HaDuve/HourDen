#!/bin/bash
# Run this on the VM to add HourDen vhost to Portfolio's Caddyfile
set -e

CADDYFILE="/opt/Portfolio/caddy/Caddyfile"
BACKUP="${CADDYFILE}.backup-$(date +%Y%m%d-%H%M%S)"

if grep -q "hourden.hannesduve.com" "$CADDYFILE" 2>/dev/null; then
  echo "HourDen vhost already exists in Caddyfile."
  exit 0
fi

echo "Backing up Caddyfile -> $BACKUP"
cp "$CADDYFILE" "$BACKUP"

echo "Adding HourDen vhost to Caddyfile..."
cat >> "$CADDYFILE" <<'EOF'

hourden.hannesduve.com {
    # SSE must not be compressed or buffered (ADR-0010).
    handle /api/events* {
        reverse_proxy host.docker.internal:3001 {
            flush_interval -1
        }
    }

    handle /api/* {
        encode gzip zstd
        reverse_proxy host.docker.internal:3001
    }

    handle {
        encode gzip zstd
        root * /var/www/hourden
        try_files {path} /index.html
        file_server
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

echo "OK: HourDen vhost added and Caddy reloaded."
echo "Backup saved: $BACKUP"
