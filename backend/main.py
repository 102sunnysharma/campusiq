from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.config import settings
from app.database import get_db
from app.core.exceptions import http_exception_handler, validation_exception_handler
from app.routers import auth, users, departments, categories, facilities, transport, students, staff

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
