import os
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.routers import auth, products, orders, reviews, payouts, uploads

# Initialize FastAPI application
app = FastAPI(
    title="FarmKart API",
    description="Direct Farm-to-Door marketplace connecting Tamil Nadu farmers and buyers.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Enable CORS for mobile app and web frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure local upload directory exists and mount as static path
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/static/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


# Global Exception Handler for unexpected server errors
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch-all error handler that logs and returns clean JSON."""
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "An unexpected error occurred on the server.",
            "error_type": exc.__class__.__name__,
            "message": str(exc),
        },
    )


# Health check endpoint
@app.get("/health", tags=["System"])
def health_check():
    """Simple health check endpoint."""
    return {
        "status": "healthy",
        "service": "FarmKart API",
        "version": "1.0.0",
    }


# Register all API routers
app.include_router(auth.router)
app.include_router(products.router)
app.include_router(orders.router)
app.include_router(reviews.router)
app.include_router(payouts.router)
app.include_router(uploads.router)
