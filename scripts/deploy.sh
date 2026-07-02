#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB_DIST="${WEB_DIST:-$ROOT/apps/web/dist}"
DEPLOY_WEB_DIR="${DEPLOY_WEB_DIR:-/var/www/hourden}"

echo "Building web bundle..."
npm run build -w @hourden/web

echo "Building API..."
npm run build -w @hourden/api

echo "Web dist ready at: $WEB_DIST"
echo ""
echo "Deploy steps (on VM1):"
echo "  1. rsync web dist to $DEPLOY_WEB_DIR"
echo "  2. docker compose up -d --build api postgres"
echo "  3. Ensure Portfolio Caddy vhost proxies /api to api:3001"
echo ""
echo "See README.md for the Caddy snippet and basic-auth setup."
