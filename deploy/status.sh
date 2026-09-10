#!/usr/bin/env bash
#
# CarlosTechSolutions-Business status indicator.
#
#   ./deploy/status.sh
#
# Set CTSB_DOMAIN in your environment (or edit the default below) so the
# public check knows what to hit.

DOMAIN="${CTSB_DOMAIN:-shop.carlostechsolutions.com}"
DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

G='\033[0;32m'; R='\033[0;31m'; D='\033[0;90m'; N='\033[0m'
ok()   { printf "  ${G}\xe2\x97\x8f${N} %s ${D}%s${N}\n" "$1" "${2:-}"; }
bad()  { printf "  ${R}\xe2\x97\x8f${N} %s ${D}%s${N}\n" "$1" "${2:-}"; }

printf "\n  ${D}carlostechsolutions-business${N}\n\n"

# --- containers -------------------------------------------------------------
for c in ctsb-caddy ctsb-cloudflared ctsb-api; do
  running=$(docker inspect -f '{{.State.Running}}' "$c" 2>/dev/null)
  if [ "$running" = "true" ]; then
    since=$(docker inspect -f '{{.State.StartedAt}}' "$c" 2>/dev/null | cut -c1-16 | tr 'T' ' ')
    restarts=$(docker inspect -f '{{.RestartCount}}' "$c" 2>/dev/null)
    note="since $since"
    [ "${restarts:-0}" -gt 0 ] && note="$note · ${restarts} restarts"
    ok "${c#ctsb-}" "$note"
  else
    bad "${c#ctsb-}" "not running"
  fi
done

# --- local http -------------------------------------------------------------
if curl -fsS -o /dev/null --max-time 3 http://127.0.0.1:8081/ 2>/dev/null; then
  ok "caddy serving" "127.0.0.1:8081"
else
  bad "caddy serving" "no response on :8081"
fi

# --- spa fallback -----------------------------------------------------------
if curl -fsS --max-time 3 http://127.0.0.1:8081/shop 2>/dev/null | grep -qi '<!doctype html'; then
  ok "spa fallback" "deep links resolve"
else
  bad "spa fallback" "/shop is not returning index.html"
fi

# --- api ---------------------------------------------------------------------
# Checked through Caddy rather than directly, so this exercises the /api/*
# route too — the API being up but unroutable looks identical to users.
if curl -fsS --max-time 3 http://127.0.0.1:8081/api/health 2>/dev/null | grep -q '"ok"'; then
  ok "api" "/api/health through caddy"
else
  bad "api" "/api/health not responding"
fi

sold=$(curl -fsS --max-time 3 http://127.0.0.1:8081/api/sold-items 2>/dev/null)
if [ -n "$sold" ]; then
  count=$(printf '%s' "$sold" | python3 -c "import json,sys; print(len(json.load(sys.stdin)['sold_item_ids']))" 2>/dev/null)
  ok "sold-state store" "${count:-?} item(s) marked sold"
else
  bad "sold-state store" "/api/sold-items not responding"
fi

# --- public -------------------------------------------------------------------
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 "https://${DOMAIN}" 2>/dev/null)
if [ "$code" = "200" ]; then
  ok "public site" "https://${DOMAIN}"
else
  bad "public site" "https://${DOMAIN} returned ${code:-no response}"
fi

# --- build ---------------------------------------------------------------------
DIST="$DEPLOY_DIR/../frontend/dist/index.html"
if [ -f "$DIST" ]; then
  built=$(date -r "$DIST" '+%Y-%m-%d %H:%M')
  commit=$(git -C "$DEPLOY_DIR/.." rev-parse --short HEAD 2>/dev/null)
  ok "build" "$built · ${commit:-unknown}"
else
  bad "build" "frontend/dist/index.html missing"
fi

# --- sleep guard (only matters if this box is the same one running promptworks) ---
if systemctl is-enabled sleep.target 2>/dev/null | grep -q masked; then
  ok "suspend" "masked"
else
  bad "suspend" "NOT masked — this box can sleep and take both sites down"
fi

printf "\n"
