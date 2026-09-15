#!/usr/bin/env bash
#
# Ship a new version of CarlosTechSolutions-Business.
#
#   ./deploy/deploy.sh                  frontend + backend
#   ./deploy/deploy.sh --backend-only   skip the npm build
#   ./deploy/deploy.sh --frontend-only  skip the API rebuild
#
# Caddy serves ../frontend/dist through a bind mount, so a fresh frontend
# build is live the moment it lands on disk — no restart, no downtime. The
# API is a container, so it gets rebuilt and restarted.
#
# There's no database migration step here (unlike promptworks/deploy.sh) —
# the catalog is a JSON file baked into the image, and sold-state/
# subscribers live in a named volume, not a schema.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_DIR="$REPO_ROOT/deploy"
cd "$REPO_ROOT"

DO_FRONTEND=1
DO_BACKEND=1

for arg in "$@"; do
	case "$arg" in
		--backend-only)  DO_FRONTEND=0 ;;
		--frontend-only) DO_BACKEND=0 ;;
		-h|--help)       sed -n '2,13p' "${BASH_SOURCE[0]}"; exit 0 ;;
		*) echo "Unknown option: $arg" >&2; exit 2 ;;
	esac
done

step() { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }
warn() { printf '\033[1;33mWARNING: %s\033[0m\n' "$1" >&2; }

# All compose commands run from deploy/, so .env and the relative build
# context (../ = repo root) resolve the way the compose file expects.
compose() { (cd "$DEPLOY_DIR" && docker compose "$@"); }

step "Checking for local changes"
if ! git diff --quiet || ! git diff --cached --quiet; then
	echo "Working tree is dirty. Commit or stash before deploying." >&2
	git status --short >&2
	exit 1
fi

step "Checking the catalog"
# Inventory is gitignored — each computer keeps its own copy (see
# docs/ADDING_INVENTORY.md), so it's never in the repo. Stop here rather
# than let the build or API image quietly ship without it.
CATALOG="frontend/src/data/items.json"
if [ ! -f "$CATALOG" ]; then
	echo "$CATALOG is missing. Inventory isn't in git: copy it, and" >&2
	echo "frontend/public/items/, over from the computer you add inventory on." >&2
	echo "To deploy an empty store instead: echo '[]' > $CATALOG" >&2
	exit 1
fi
echo "Catalog: $(grep -c '"id":' "$CATALOG" || true) items"

if [ "$DO_BACKEND" = "1" ]; then
	step "Checking configuration"

	if [ ! -f "$DEPLOY_DIR/.env" ]; then
		echo "deploy/.env is missing. Copy deploy/.env.example and fill it in." >&2
		exit 1
	fi

	missing=()
	for var in TUNNEL_TOKEN STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET RESEND_API_KEY SITE_URL; do
		if ! grep -qE "^${var}=.+" "$DEPLOY_DIR/.env"; then
			missing+=("$var")
		fi
	done
	if [ ${#missing[@]} -gt 0 ]; then
		echo "deploy/.env is missing values for: ${missing[*]}" >&2
		exit 1
	fi

	for var in NOTIFY_EMAIL SALE_NOTIFY_EMAIL; do
		grep -qE "^${var}=.+" "$DEPLOY_DIR/.env" || \
			warn "$var is empty — that notification path will silently do nothing."
	done

	echo "Configuration looks complete."
fi

if [ "$DO_FRONTEND" = "1" ]; then
	step "Installing frontend dependencies"
	(cd frontend && npm ci)

	step "Building frontend"
	(cd frontend && npm run build)

	step "Verifying build output"
	test -f frontend/dist/index.html || {
		echo "dist/index.html missing — build failed" >&2; exit 1; }
fi

if [ "$DO_BACKEND" = "1" ]; then
	step "Building API image"
	compose build api

	step "Restarting API"
	compose up -d api
fi

step "Starting Caddy and cloudflared (no-op if already up)"
compose up -d caddy cloudflared

step "Checking the site answers"
if curl -fsS -o /dev/null --max-time 5 http://127.0.0.1:8081/; then
	echo "Frontend OK."
else
	warn "http://127.0.0.1:8081/ did not respond. Is the stack up?"
	echo "  cd deploy && docker compose ps" >&2
fi

if [ "$DO_BACKEND" = "1" ]; then
	printf 'Waiting for the API'
	api_ok=0
	for _ in $(seq 1 20); do
		if curl -fsS -o /dev/null --max-time 3 http://127.0.0.1:8081/api/health 2>/dev/null; then
			api_ok=1
			printf ' ready\n'
			break
		fi
		printf '.'
		sleep 2
	done

	if [ "$api_ok" = "1" ]; then
		echo "API OK: /api/health responded."
	else
		printf '\n'
		warn "/api/health did not respond."
		echo "  cd deploy && docker compose logs --tail=50 api" >&2
		exit 1
	fi
fi

step "Deployed"
echo "Commit: $(git -C "$REPO_ROOT" rev-parse --short HEAD)"
echo "Built:  $(date -Is)"
