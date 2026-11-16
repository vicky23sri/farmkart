#!/bin/sh
set -e

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "[Startup] Running database migrations..."
  alembic upgrade head
  echo "[Startup] Database migrations completed."
fi

WORKERS="${GUNICORN_WORKERS:-2}"
PORT="${PORT:-8000}"
# Comma-separated IPs of the reverse proxy / load balancer allowed to set X-Forwarded-* headers.
# Leave as 127.0.0.1 unless you run behind a proxy; "*" trusts every client (do not use on a public port).
FORWARDED_ALLOW_IPS="${FORWARDED_ALLOW_IPS:-127.0.0.1}"

echo "[Startup] Starting Gunicorn with ${WORKERS} Uvicorn workers on port ${PORT}..."
exec gunicorn \
    -k uvicorn_worker.UvicornWorker \
    -w "${WORKERS}" \
    -b "0.0.0.0:${PORT}" \
    --forwarded-allow-ips "${FORWARDED_ALLOW_IPS}" \
    --access-logfile - \
    --error-logfile - \
    --timeout 60 \
    --graceful-timeout 30 \
    --keep-alive 5 \
    --max-requests 2000 \
    --max-requests-jitter 200 \
    app.main:app
