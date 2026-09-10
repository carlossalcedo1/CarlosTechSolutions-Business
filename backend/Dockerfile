# Backend API — see LAUNCH_CHECKLIST.md Phase 1.
#
# Build from the repo root: docker build -f backend/Dockerfile .
# (The repo root, not backend/, because app.catalog.CATALOG_PATH resolves
# two directories up from backend/app/catalog.py to find
# frontend/src/data/items.json — this image mirrors that same layout so the
# loader code doesn't need a container-specific branch.)

FROM python:3.12-slim

WORKDIR /app
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONPATH=/app

# Dependencies first, in their own layer, so an app code change doesn't
# invalidate the pip cache.
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend/app backend/app
COPY frontend/src/data/items.json frontend/src/data/items.json

# Sold-state store + subscriber list (see app/sold_store.py) — created here,
# owned by the non-root user below, so it's writable before compose mounts
# a volume over it. deploy/docker-compose.yml mounts one at this exact path.
RUN mkdir -p backend/data

# Run as non-root. A container that only reads its own code and talks to
# Stripe/Resend over HTTPS has no business being root.
RUN useradd --create-home --uid 10001 ctsb \
    && chown -R ctsb:ctsb /app
USER ctsb

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')" || exit 1

# Deliberately ONE worker: RateLimiter (app/ratelimit.py) keeps its counters
# in process memory, so N workers would mean N times the real limit on
# public form endpoints — each worker enforcing the cap independently. A
# single worker is plenty for a NUC; scale out only after moving the
# counters to something shared.
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
