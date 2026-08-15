"""
Feedback Router — Phase 5 (Section 11, Section 14)

Endpoints:
  POST  /feedback          — Student only. Save feedback + kick off NLP via BackgroundTasks.
                             Always returns 201 immediately (Section 11.4).
  GET   /feedback/mine     — Student: paginated list of their own feedback + analysis.
  GET   /feedback          — Admin/HOD: paginated, filterable list with full details.
  GET   /feedback/{id}     — Admin/HOD gets full detail; Student gets own only (no other's).

Filtering (Admin/HOD, Section 14.4):
  category_id, sentiment, rating, severity, department_id, date_from, date_to
  Sort by created_at (desc by default).
"""

import uuid
import math
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, status, BackgroundTasks, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, and_

from app.database import get_db
from app.config import settings
from app.models import Feedback, FeedbackAnalysis, Student, Category, Department
from app.schemas.feedback import (
    FeedbackCreate,
    FeedbackResponse,
    FeedbackListResponse,
    FeedbackAnalysisResponse,
    CategorySummary,
    StudentSummary,
)
from app.core.dependencies import get_current_user, require_role
from app.core.exceptions import APIException
from app.services.nlp_service import analyze_feedback_background

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/feedback", tags=["Feedback"])


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _build_feedback_response(fb: Feedback, caller_role: str, caller_student_id=None) -> FeedbackResponse:
    """
    Shape a Feedback ORM object into a FeedbackResponse.
    - Anonymous feedbacks: student info is hidden unless caller is admin/hod.
    - Non-owner students cannot see other students' feedback (enforced at query level).
    """
    # Analysis sub-object
    analysis_out = None
    if fb.analysis:
        a = fb.analysis
        analysis_out = FeedbackAnalysisResponse(
            id=str(a.id),
            feedback_id=str(a.feedback_id),
            sentiment=a.sentiment,
            sentiment_score=float(a.sentiment_score) if a.sentiment_score is not None else None,
            category_prediction=a.category_prediction,
            severity=a.severity,
            confidence_score=float(a.confidence_score) if a.confidence_score is not None else None,
            language=a.language,
            keywords=a.keywords or [],
            topics=a.topics or [],
            model_name=a.model_name,
            model_version=a.model_version,
            analysis_status=a.analysis_status,
            error_message=a.error_message,
            processed_at=a.processed_at,
        )

    # Category sub-object
    cat_out = None
    if fb.category:
        cat_out = CategorySummary(
            id=str(fb.category.id),
            name=fb.category.name,
            department_id=str(fb.category.department_id),
        )

    # Student sub-object — hidden for anonymous feedback unless admin/hod
    student_out = None
    show_student = caller_role in ("admin", "hod") or not fb.is_anonymous
    if show_student and fb.student and fb.student.user:
        student_out = StudentSummary(
            id=str(fb.student.id),
            student_id=fb.student.student_id,
            user_full_name=fb.student.user.full_name,
        )
    elif fb.is_anonymous and caller_role not in ("admin", "hod"):
        student_out = StudentSummary(
            id="anonymous",
            student_id="anonymous",
            user_full_name="Anonymous",
        )

    return FeedbackResponse(
        id=str(fb.id),
        student_id=str(fb.student_id),
        category_id=str(fb.category_id),
        content=fb.content,
        rating=fb.rating,
        is_anonymous=fb.is_anonymous,
        status=fb.status,
        created_at=fb.created_at,
        updated_at=fb.updated_at,
        category=cat_out,
        student=student_out,
        analysis=analysis_out,
    )


# ─── POST /feedback ───────────────────────────────────────────────────────────

@router.post("", status_code=status.HTTP_201_CREATED, response_model=FeedbackResponse)
def submit_feedback(
    payload: FeedbackCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(["student"])),
):
    """
    Student submits feedback.
    - Immediately creates the Feedback row + a PENDING FeedbackAnalysis stub.
    - Kicks off NLP via BackgroundTasks (never blocks this response).
    - Always returns 201 (Section 11.4).
    """
    # Verify student profile exists
    student = db.query(Student).filter(Student.user_id == current_user.id).first()
    if not student:
        raise APIException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="STUDENT_PROFILE_NOT_FOUND",
            message="Student profile not found. Please complete your profile setup.",
        )

    # Verify category exists and is active
    category = db.query(Category).filter(
        Category.id == uuid.UUID(payload.category_id),
        Category.is_active == True,
    ).first()
    if not category:
        raise APIException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="CATEGORY_NOT_FOUND",
            message="The selected category does not exist or is inactive.",
        )

    # Create feedback row
    feedback_id = uuid.uuid4()
    feedback = Feedback(
        id=feedback_id,
        student_id=student.id,
        category_id=category.id,
        content=payload.content,
        rating=payload.rating,
        is_anonymous=payload.is_anonymous,
        status="submitted",
    )
    db.add(feedback)

    # Create PENDING analysis stub immediately (so the background task can update it)
    analysis_stub = FeedbackAnalysis(
        id=uuid.uuid4(),
        feedback_id=feedback_id,
        analysis_status="PENDING",
    )
    db.add(analysis_stub)

    db.commit()
    db.refresh(feedback)
    db.refresh(analysis_stub)

    # Reload with relationships for response
    feedback = (
        db.query(Feedback)
        .options(
            joinedload(Feedback.category),
            joinedload(Feedback.student).joinedload(Student.user),
            joinedload(Feedback.analysis),
        )
        .filter(Feedback.id == feedback_id)
        .first()
    )

    # Kick off NLP in background — never awaited, failure is silent to student
    background_tasks.add_task(
        analyze_feedback_background,
        str(feedback_id),
        payload.content,
        settings.DATABASE_URL,
    )

    logger.info(f"Feedback {feedback_id} submitted by student {student.id} — NLP queued")

    return _build_feedback_response(feedback, "student")


# ─── GET /feedback/mine ───────────────────────────────────────────────────────

@router.get("/mine", response_model=FeedbackListResponse)
def get_my_feedback(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user=Depends(require_role(["student"])),
):
    """Student retrieves their own feedback history (paginated)."""
    student = db.query(Student).filter(Student.user_id == current_user.id).first()
    if not student:
        raise APIException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="STUDENT_PROFILE_NOT_FOUND",
            message="Student profile not found.",
        )

    base_q = (
        db.query(Feedback)
        .options(
            joinedload(Feedback.category),
            joinedload(Feedback.student).joinedload(Student.user),
            joinedload(Feedback.analysis),
        )
        .filter(Feedback.student_id == student.id)
        .order_by(desc(Feedback.created_at))
    )

    total = base_q.count()
    items = base_q.offset((page - 1) * page_size).limit(page_size).all()

    return FeedbackListResponse(
        items=[_build_feedback_response(fb, "student") for fb in items],
        page=page,
        page_size=page_size,
        total=total,
        total_pages=math.ceil(total / page_size) if total else 1,
    )


# ─── GET /feedback (Admin/HOD) ────────────────────────────────────────────────

@router.get("", response_model=FeedbackListResponse)
def list_all_feedback(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    category_id: Optional[str] = Query(default=None),
    department_id: Optional[str] = Query(default=None),
    sentiment: Optional[str] = Query(default=None, description="positive / neutral / negative"),
    rating: Optional[int] = Query(default=None, ge=1, le=5),
    severity: Optional[str] = Query(default=None, description="critical / high / medium / low"),
    date_from: Optional[str] = Query(default=None, description="ISO date YYYY-MM-DD"),
    date_to: Optional[str] = Query(default=None, description="ISO date YYYY-MM-DD"),
    search: Optional[str] = Query(default=None, description="Search in feedback content"),
    db: Session = Depends(get_db),
    current_user=Depends(require_role(["admin", "hod"])),
):
    """
    Admin/HOD: paginated + filterable feedback list.
    HOD sees only feedbacks within their department's categories.
    """
    caller_role = current_user.role.name

    # Determine HOD's department restriction
    hod_department_id = None
    if caller_role == "hod" and current_user.staff_profile:
        hod_department_id = current_user.staff_profile.department_id

    # Build query with eager loads
    query = (
        db.query(Feedback)
        .join(Feedback.category)
        .options(
            joinedload(Feedback.category),
            joinedload(Feedback.student).joinedload(Student.user),
            joinedload(Feedback.analysis),
        )
    )

    filters = []

    # HOD scope restriction
    if hod_department_id:
        filters.append(Category.department_id == hod_department_id)

    # Category filter
    if category_id:
        try:
            filters.append(Feedback.category_id == uuid.UUID(category_id))
        except ValueError:
            pass

    # Department filter (joins through Category)
    if department_id:
        try:
            filters.append(Category.department_id == uuid.UUID(department_id))
        except ValueError:
            pass

    # Rating filter
    if rating is not None:
        filters.append(Feedback.rating == rating)

    # Content search
    if search:
        filters.append(Feedback.content.ilike(f"%{search}%"))

    # Date range
    if date_from:
        try:
            filters.append(Feedback.created_at >= datetime.fromisoformat(date_from))
        except ValueError:
            pass
    if date_to:
        try:
            filters.append(Feedback.created_at <= datetime.fromisoformat(date_to + "T23:59:59"))
        except ValueError:
            pass

    # Sentiment / Severity — filter through analysis join
    if sentiment or severity:
        query = query.join(Feedback.analysis)
        if sentiment:
            filters.append(FeedbackAnalysis.sentiment == sentiment)
        if severity:
            filters.append(FeedbackAnalysis.severity == severity)

    if filters:
        query = query.filter(and_(*filters))

    query = query.order_by(desc(Feedback.created_at))

    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()

    return FeedbackListResponse(
        items=[_build_feedback_response(fb, caller_role) for fb in items],
        page=page,
        page_size=page_size,
        total=total,
        total_pages=math.ceil(total / page_size) if total else 1,
    )


# ─── GET /feedback/{id} ───────────────────────────────────────────────────────

@router.get("/{feedback_id}", response_model=FeedbackResponse)
def get_feedback_by_id(
    feedback_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Get a single feedback by ID.
    - Admin/HOD: can access any feedback.
    - Student: can only access their own feedback.
    """
    try:
        fid = uuid.UUID(feedback_id)
    except ValueError:
        raise APIException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="INVALID_ID",
            message="Invalid feedback ID format.",
        )

    feedback = (
        db.query(Feedback)
        .options(
            joinedload(Feedback.category),
            joinedload(Feedback.student).joinedload(Student.user),
            joinedload(Feedback.analysis),
        )
        .filter(Feedback.id == fid)
        .first()
    )

    if not feedback:
        raise APIException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="FEEDBACK_NOT_FOUND",
            message="Feedback not found.",
        )

    caller_role = current_user.role.name

    # Students can only view their own feedback
    if caller_role == "student":
        student = db.query(Student).filter(Student.user_id == current_user.id).first()
        if not student or feedback.student_id != student.id:
            raise APIException(
                status_code=status.HTTP_403_FORBIDDEN,
                code="PERMISSION_DENIED",
                message="You can only view your own feedback.",
            )

    return _build_feedback_response(feedback, caller_role)
