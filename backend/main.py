from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.config import settings
from app.database import get_db, SessionLocal
from app.core.exceptions import http_exception_handler, validation_exception_handler
from app.routers import (
    auth,
    users,
    departments,
    categories,
    facilities,
    transport,
    students,
    staff,
    feedback,
    grievances,
    sla,
    notifications,
    audit_logs,
    analytics,
)
import asyncio
import logging

logger = logging.getLogger(__name__)

app = FastAPI(
    title="KRMU Campus Intelligence Platform API",
    description="Backend REST API for KRMU Campus Intelligence Platform",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Exception handlers for standard error format (Section 14.1)
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)

# CORS Middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(departments.router)
app.include_router(categories.router)
app.include_router(facilities.router)
app.include_router(transport.router)
app.include_router(students.router)
app.include_router(staff.router)
app.include_router(feedback.router)
app.include_router(grievances.router)
app.include_router(sla.router)
app.include_router(notifications.router)
app.include_router(audit_logs.router)
app.include_router(analytics.router)


async def _daily_aggregation_loop():
    """
    Background task that runs the operational_metrics aggregation once on startup
    for yesterday's data, then repeats every 24 hours.
    No Redis / Celery / external scheduler required (Section 16, Section 12.1).
    """
    from app.services.analytics_service import aggregate_metrics_for_yesterday
    # Small initial delay to let the DB settle on boot
    await asyncio.sleep(5)
    while True:
        db = SessionLocal()
        try:
            rows = aggregate_metrics_for_yesterday(db)
            logger.info(f"[Analytics] Daily aggregation complete — {rows} rows updated")
        except Exception as exc:
            logger.error(f"[Analytics] Daily aggregation failed: {exc}", exc_info=True)
        finally:
            db.close()
        # Sleep 24 hours before the next run
        await asyncio.sleep(86400)


@app.on_event("startup")
async def startup_event():
    """Launch the daily analytics aggregation loop as a background task."""
    asyncio.create_task(_daily_aggregation_loop())


@app.get("/")
def root():
    return {
        "success": True,
        "message": "KRMU Campus Intelligence Platform API is running",
        "version": "1.0.0",
        "docs": "/docs"
    }

@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {
            "status": "healthy",
            "database": "connected",
            "environment": settings.ENVIRONMENT
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "DATABASE_DISCONNECTED",
                "message": f"Database connection failed: {str(e)}"
            }
        )
