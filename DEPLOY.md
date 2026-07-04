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

If the vhost was created earlier with Caddy `basic_auth`, remove that block from the Caddyfile and reload Caddy (see [ADR-0009](./docs/adr/0009-session-auth-and-workspace-isolation.md)). Or run `scripts/fix-caddy-vm.sh` on the VM — it strips `basic_auth` from the HourDen vhost automatically.

## Step 2: Operator env on the VM

Before the first deploy after auth slice 1, set operator credentials in `/opt/HourDen/.env` on the VM (`HOURDEN_OPERATOR_EMAIL`, `HOURDEN_OPERATOR_PASSWORD`, and optionally `HOURDEN_OPERATOR_NAME`, `HOURDEN_TIMEZONE`). Migration 012 creates the operator **User** from these values.

## Step 3: Deploy HourDen

From your local machine (make sure latest code is pushed to GitHub):

```bash
cd /Users/hiono/Freelance/Invoices/HourDen
./scripts/deploy-remote.sh
```

Wait for "Deploy finished on VM."

## Step 4: Verify

Visit: https://hourden.hannesduve.com/login

Sign in with `HOURDEN_OPERATOR_EMAIL` / `HOURDEN_OPERATOR_PASSWORD` from your `.env`.

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
