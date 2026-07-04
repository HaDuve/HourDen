#!/bin/bash
# Fix HourDen vhost on VM1: proxy target + static mount prerequisites.
# Run: ssh root@VM 'bash -s' < scripts/fix-caddy-vm.sh
set -e

CADDYFILE="/opt/Portfolio/caddy/Caddyfile"
COMPOSE="/opt/Portfolio/docker-compose.yml"

if [ ! -f "$CADDYFILE" ]; then
  echo "Missing $CADDYFILE — run setup-caddy-vm.sh first." >&2
  exit 1
fi

echo "Patching Caddyfile proxy target and removing HourDen basic_auth (if present)..."
awk '
function brace_delta(s,    tmp, opens, closes) {
  tmp = s
  opens = gsub(/\{/, "&", tmp)
  tmp = s
  closes = gsub(/\}/, "&", tmp)
  return opens - closes
}
BEGIN { in_hourden = 0; hourden_depth = 0; skip_basic = 0; basic_depth = 0 }
{
  line = $0
  trimmed = line
  sub(/^[ \t]+/, "", trimmed)

  if (!in_hourden && trimmed ~ /^hourden\.hannesduve\.com[ \t]*\{/) {
    in_hourden = 1
    hourden_depth = 1
    print line
    next
  }

  if (in_hourden) {
    if (!skip_basic && trimmed ~ /^basic_auth[ \t]*\{/) {
      skip_basic = 1
      basic_depth = 1
      next
    }
    if (skip_basic) {
      basic_depth += brace_delta(line)
      if (basic_depth <= 0) skip_basic = 0
      next
    }
    hourden_depth += brace_delta(line)
    print line
    if (hourden_depth <= 0) in_hourden = 0
    next
  }

  print line
}
' "$CADDYFILE" > "${CADDYFILE}.tmp" && mv "${CADDYFILE}.tmp" "$CADDYFILE"

sed -i.bak-"$(date +%Y%m%d-%H%M%S)" \
  -e 's|reverse_proxy localhost:3001|reverse_proxy host.docker.internal:3001|g' \
  -e 's/handle_path \/api\/\*/handle \/api\/\*/g' \
  "$CADDYFILE"

if ! grep -q "host.docker.internal:host-gateway" "$COMPOSE" 2>/dev/null; then
  echo "Patching Portfolio docker-compose.yml..."
  cp "$COMPOSE" "${COMPOSE}.bak-$(date +%Y%m%d-%H%M%S)"
  awk '
    /ports:/ { in_ports=1 }
    in_ports && /443:443/ {
      print
      print "    extra_hosts:"
      print "      - \"host.docker.internal:host-gateway\""
      in_ports=0
      next
    }
    /site_data:\/var\/www\/html/ && !done {
      print
      print "      - /var/www/hourden:/var/www/hourden:ro"
      done=1
      next
    }
    { print }
  ' "$COMPOSE" > "${COMPOSE}.tmp" && mv "${COMPOSE}.tmp" "$COMPOSE"
fi

echo "Recreating Caddy..."
cd /opt/Portfolio
docker compose up -d caddy
docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile

echo "Smoke check..."
curl -sf http://localhost:3001/health >/dev/null
echo "OK: HourDen API on host :3001"
echo "OK: Caddy proxies to host.docker.internal:3001"
