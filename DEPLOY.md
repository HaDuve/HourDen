# Quick Deploy Guide

## Domain cutover (hourden.com)

Canonical public URL: **https://hourden.com**

| Host | Role |
|------|------|
| `hourden.com` | Full app (API + SPA) |
| `www.hourden.com` | 301 → apex |
| `hourden.hannesduve.com` | 301 → apex |

**Cutover sequence (operator-timed):**

1. **DNS** — Point `hourden.com` and `www.hourden.com` A/AAAA records at the VM (keep the old subdomain serving until step 2).
2. **Apex vhost** — Run `scripts/setup-caddy-vm.sh` on the VM. It appends the apex and `www` blocks and **replaces an existing legacy app vhost with a redirect** so Caddy never sees duplicate site labels.
3. **Env** — Set `HOURDEN_PUBLIC_URL=https://hourden.com` in `/opt/HourDen/.env` on the VM and in local `.env` for production verify.
4. **Verify** — Run production verify (below). No manual legacy swap is needed when step 2 used `setup-caddy-vm.sh`.

After cutover, verify:

```bash
VERIFY_PRODUCTION=1 ./scripts/deploy-remote.sh
```

## Step 1: Add HourDen to Portfolio's Caddy (one-time setup)

Requires HourDen cloned at `/opt/HourDen` on the VM (same path used by deploy). On a fresh VM, run at least one deploy first, or clone the repo manually before this step.

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
HOURDEN_REPO="/opt/HourDen"

if grep -q "hourden.com {" "$CADDYFILE" 2>/dev/null; then
  echo "HourDen apex vhost already exists."
else
  echo "Backing up → $BACKUP"
  cp "$CADDYFILE" "$BACKUP"
  node "$HOURDEN_REPO/scripts/apply-caddy-hourden-cutover.mjs" "$CADDYFILE"
  cd /opt/Portfolio
  docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile
  echo "✓ HourDen vhosts added and Caddy reloaded."
fi

exit
```

If the vhost was created earlier with Caddy `basic_auth`, remove that block from the Caddyfile and reload Caddy (see [ADR-0009](./docs/adr/0009-session-auth-and-workspace-isolation.md)). Or run `scripts/fix-caddy-vm.sh` on the VM — it strips `basic_auth` from the HourDen vhost automatically.

## Step 2: Operator env on the VM

Before the first deploy after auth slice 1, set operator credentials in `/opt/HourDen/.env` on the VM (`HOURDEN_OPERATOR_EMAIL`, `HOURDEN_OPERATOR_PASSWORD`, and optionally `HOURDEN_OPERATOR_NAME`, `HOURDEN_TIMEZONE`). Set `HOURDEN_PUBLIC_URL=https://hourden.com` for OAuth redirect URIs and production verify. Migration 012 creates the operator **User** from these values.

## Step 3: Deploy HourDen

From your local machine (make sure latest code is pushed to GitHub):

```bash
cd /Users/hiono/Freelance/Invoices/HourDen
./scripts/deploy-remote.sh
```

Wait for "Deploy finished on VM."

## Step 4: Verify

Visit: https://hourden.com/login

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

### SSE (live updates)

`GET /api/events` streams `text/event-stream` for workspace invalidation signals (`timer-changed`, `today-changed`). Caddy must **not** gzip or buffer this path — the vhost above routes `/api/events*` through `reverse_proxy` with `flush_interval -1` and keeps `encode` off that handle. If you added HourDen before this block existed, append the `/api/events*` handle above the general `/api/*` block and reload Caddy.
