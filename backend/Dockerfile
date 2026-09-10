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
    PYTHONPATH=/app

# Dependencies first, in their own layer, so an app code change doesn't
# invalidate the pip cache.
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend/app backend/app
COPY frontend/src/data/items.json frontend/src/data/items.json

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')" || exit 1

CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
