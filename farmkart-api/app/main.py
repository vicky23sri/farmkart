import logging
import os
from fastapi import FastAPI, Request, Depends, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.logging import setup_logging
from app.core.middleware import RequestLoggingMiddleware, SecurityHeadersMiddleware
from app.core.sentry import init_sentry
from app.routers import auth, legal, products, orders, reviews, payouts, uploads, notifications

# Initialize structured logging and Sentry
setup_logging(settings.ENV)
init_sentry(settings.SENTRY_DSN, settings.ENV, settings.SENTRY_TRACES_SAMPLE_RATE)

logger = logging.getLogger(__name__)

APP_VERSION = "1.0.0"

# Initialize FastAPI application
app = FastAPI(
    title="FarmKart API",
    description="Direct Farm-to-Door marketplace connecting Tamil Nadu farmers and buyers.",
    version=APP_VERSION,
    docs_url="/docs" if settings.docs_enabled else None,
    redoc_url="/redoc" if settings.docs_enabled else None,
    openapi_url="/openapi.json" if settings.docs_enabled else None,
)

# CORS: only needed for the web build (native apps are not subject to CORS).
# Development allows any origin; production only allows the explicitly configured origins.
if settings.ENV == "development":
    cors_origins = ["*"]
else:
    cors_origins = settings.CORS_ORIGINS

if cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=False,  # bearer tokens, no cookies
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
        expose_headers=["X-Request-ID"],
    )

app.add_middleware(GZipMiddleware, minimum_size=1024)
app.add_middleware(SecurityHeadersMiddleware)

# Structured request-ID and execution time logging middleware
app.add_middleware(RequestLoggingMiddleware)

# Local upload fallback is only served outside production (production uses S3/CDN)
if not settings.is_production:
    UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    app.mount("/static/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


# Global Exception Handler for unexpected server errors
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch-all error handler that logs the full traceback and returns clean JSON."""
    logger.exception("Unhandled error processing request: %s %s", request.method, request.url)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"},
    )


# Liveness probe: process is up (no dependencies). Use /health for readiness.
@app.get("/livez", tags=["System"], include_in_schema=False)
def liveness():
    return {"status": "ok"}


# Health check endpoint
@app.get("/health", tags=["System"])
def health_check(db: Session = Depends(get_db)):
    """Health check endpoint that verifies database connectivity."""
    try:
        db.execute(text("SELECT 1"))
        return {
            "status": "healthy",
            "service": "FarmKart API",
            "version": APP_VERSION,
            "database": "connected",
        }
    except Exception as exc:
        logger.error("Database health check failed: %s", exc)
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "unhealthy",
                "service": "FarmKart API",
                "version": APP_VERSION,
                "database": "disconnected",
                "detail": "Database connection failed",
            },
        )


# Register all API routers
app.include_router(auth.router)
app.include_router(products.router)
app.include_router(orders.router)
app.include_router(reviews.router)
app.include_router(payouts.router)
app.include_router(uploads.router)
app.include_router(notifications.router)
app.include_router(legal.router)
