# Quick Deploy Guide

## Step 1: Add HourDen to Portfolio's Caddy (one-time setup)

SSH to your VM and run this single command:

```bash
ssh root@188.245.242.141 'bash -s' < scripts/setup-caddy-vm.sh
```

Or copy-paste this directly into an SSH session:

```bash
ssh root@188.245.242.141

# Then paste this entire block:
CADDYFILE="/opt/Portfolio/caddy/Caddyfile"
BACKUP="${CADDYFILE}.backup-$(date +%Y%m%d-%H%M%S)"

if grep -q "hourden.hannesduve.com" "$CADDYFILE" 2>/dev/null; then
  echo "HourDen vhost already exists."
else
  echo "Backing up → $BACKUP"
  cp "$CADDYFILE" "$BACKUP"
  
  cat >> "$CADDYFILE" <<'EOF'

hourden.hannesduve.com {
    basic_auth {
        operator $2a$14$Hhcab4yh26gYSIWyztWgPuU0kfsJ2kx9D46jDfXRJjESEPaUtGgyS
    }

    encode gzip zstd

    handle /api/* {
        reverse_proxy host.docker.internal:3001
    }

    handle {
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

  cd /opt/Portfolio
  docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile
  echo "✓ HourDen vhost added and Caddy reloaded."
fi

exit
```

## Step 2: Deploy HourDen

From your local machine (make sure latest code is pushed to GitHub):

```bash
cd /Users/hiono/Freelance/Invoices/HourDen
./scripts/deploy-remote.sh
```

Wait for "Deploy finished on VM."

## Step 3: Verify

Visit: https://hourden.hannesduve.com

**Login:**
- Username: `operator`
- Password: `RnDbP9p7J4zg5KLtWEUU`

Or run:

```bash
VERIFY_PRODUCTION=1 ./scripts/deploy-remote.sh
```

## Future deploys

Just push to main and run:

```bash
./scripts/deploy-remote.sh
```

No Caddy changes needed after initial setup.
