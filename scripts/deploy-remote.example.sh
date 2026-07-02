#!/usr/bin/env bash
# Deploy merged main from GitHub → VM1 (SSH + git pull + docker compose).
#
# Setup once:
#   cp scripts/deploy-remote.example.sh scripts/deploy-remote.sh
#   chmod +x scripts/deploy-remote.sh
#   # edit SSH_TARGET in deploy-remote.sh
#
# Usage (after changes are merged to main on GitHub):
#   ./scripts/deploy-remote.sh
#
# Optional — verify https://hourden.hannesduve.com after deploy:
#   VERIFY_PRODUCTION=1 HOURDEN_BASIC_AUTH_USER=operator HOURDEN_BASIC_AUTH_PASSWORD='…' ./scripts/deploy-remote.sh
#
# Validate syntax: bash -n scripts/deploy-remote.example.sh
#
# Env: SSH_TARGET, REMOTE_DIR, REPO_URL, REMOTE_WEB_DIR, VERIFY_PRODUCTION,
#      HOURDEN_BASIC_AUTH_USER, HOURDEN_BASIC_AUTH_PASSWORD

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SSH_TARGET="${SSH_TARGET:-root@YOUR_SERVER_IP}"
REMOTE_DIR="${REMOTE_DIR:-/opt/HourDen}"
REPO_URL="${REPO_URL:-https://github.com/HaDuve/HourDen.git}"
REMOTE_WEB_DIR="${REMOTE_WEB_DIR:-/var/www/hourden}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
VERIFY_PRODUCTION="${VERIFY_PRODUCTION:-0}"

if [[ "$SSH_TARGET" == *"YOUR_SERVER_IP"* ]]; then
  echo "Set SSH_TARGET (e.g. export SSH_TARGET=root@YOUR_IP) or edit deploy-remote.sh." >&2
  exit 1
fi

echo "Deploy → ${SSH_TARGET}:${REMOTE_DIR} (origin/${DEPLOY_BRANCH})"
echo "Web static → ${REMOTE_WEB_DIR}"

ssh "$SSH_TARGET" bash -s <<REMOTE
set -euo pipefail
REMOTE_DIR="${REMOTE_DIR}"
REPO_URL="${REPO_URL}"
REMOTE_WEB_DIR="${REMOTE_WEB_DIR}"
DEPLOY_BRANCH="${DEPLOY_BRANCH}"

bootstrap_repo() {
  if [[ -d "\${REMOTE_DIR}/.git" ]]; then
    return 0
  fi
  echo "Cloning \${REPO_URL} → \${REMOTE_DIR}…"
  mkdir -p "\$(dirname "\${REMOTE_DIR}")"
  git clone --branch "\${DEPLOY_BRANCH}" "\${REPO_URL}" "\${REMOTE_DIR}"
}

sync_code() {
  cd "\${REMOTE_DIR}"
  git fetch origin "\${DEPLOY_BRANCH}"
  git checkout "\${DEPLOY_BRANCH}"
  git pull origin "\${DEPLOY_BRANCH}"
}

build_web() {
  cd "\${REMOTE_DIR}"
  echo "Building web bundle in Node container…"
  docker run --rm \
    -v "\${REMOTE_DIR}:/app" \
    -w /app \
    node:22-alpine \
    sh -c "npm ci && npm run build"
}

publish_web() {
  cd "\${REMOTE_DIR}"
  mkdir -p "\${REMOTE_WEB_DIR}"
  rm -rf "\${REMOTE_WEB_DIR:?}/"*
  cp -r apps/web/dist/. "\${REMOTE_WEB_DIR}/"
  echo "Published web dist → \${REMOTE_WEB_DIR}"
}

deploy_compose() {
  cd "\${REMOTE_DIR}"
  docker compose up -d --build
  docker compose ps
}

wait_for_health() {
  for _ in \$(seq 1 30); do
    if curl -sf http://localhost:3001/health >/dev/null 2>&1; then
      echo "API healthy on VM."
      return 0
    fi
    sleep 2
  done
  echo "API health check failed. Logs:" >&2
  cd "\${REMOTE_DIR}"
  docker compose logs --tail=50 api >&2 || true
  return 1
}

bootstrap_repo
sync_code
build_web
publish_web
deploy_compose
wait_for_health
echo "Deploy finished on VM."
REMOTE

if [[ "$VERIFY_PRODUCTION" == "1" ]]; then
  if [[ -z "${HOURDEN_BASIC_AUTH_USER:-}" || -z "${HOURDEN_BASIC_AUTH_PASSWORD:-}" ]]; then
    echo "Set HOURDEN_BASIC_AUTH_USER and HOURDEN_BASIC_AUTH_PASSWORD to verify production." >&2
    exit 1
  fi
  echo "Verifying https://hourden.hannesduve.com…"
  HOURDEN_BASIC_AUTH_USER="$HOURDEN_BASIC_AUTH_USER" \
  HOURDEN_BASIC_AUTH_PASSWORD="$HOURDEN_BASIC_AUTH_PASSWORD" \
    "$ROOT/scripts/verify-production.sh"
fi

echo "Done. Site: https://hourden.hannesduve.com"
