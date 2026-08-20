"""
Grievance Router — Phase 6 (Section 6.2, 7, 8, 14)

Endpoints:
  POST   /grievances              — Student: submit grievance (auto-assigns department & starts SLA)
  GET    /grievances/mine         — Student: list own grievances (paginated, filterable)
  GET    /grievances/assigned     — Staff: list grievances assigned to them
  GET    /grievances              — Admin/HOD/Staff: list and filter grievances (HOD department-scoped)
  GET    /grievances/{id}         — Get single grievance detail with update timeline & SLA countdown
  PATCH  /grievances/{id}/status  — Transition grievance status (strict Section 7 rules)
  PATCH  /grievances/{id}/assign  — Assign/reassign staff (Admin/HOD)
"""

import uuid
import math
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, and_, or_

from app.database import get_db
from app.models import (
    Grievance,
    GrievanceUpdate,
    SLAEvent,
    Student,
    Staff,
    Category,
    Department,
    User,
)
from app.schemas.grievance import (
    GrievanceCreate,
    GrievanceStatusUpdate,
    GrievanceAssign,
    GrievanceResponse,
    GrievanceListResponse,
    GrievanceUpdateResponse,
    DepartmentSummary,
    CategorySummary,
    StudentSummary,
    StaffSummary,
)
from app.schemas.sla import SLAEventResponse
from app.core.dependencies import get_current_user, require_role
from app.core.exceptions import APIException
from app.services.sla_service import (
    create_sla_event,
    complete_sla_event,
    reopen_sla_event,
    calculate_sla_metrics,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/grievances", tags=["Grievance Management"])


# ─── Helper Builders ──────────────────────────────────────────────────────────

def _build_sla_event_response(event: SLAEvent) -> SLAEventResponse:
    metrics = calculate_sla_metrics(event)
    priority_val = event.sla_policy.priority if event.sla_policy else "medium"
    return SLAEventResponse(
        id=str(event.id),
        grievance_id=str(event.grievance_id),
        sla_policy_id=str(event.sla_policy_id),
        priority=priority_val,
        started_at=event.started_at,
        deadline_at=event.deadline_at,
        warning_at=event.warning_at,
        completed_at=event.completed_at,
        status=metrics["status"],
        breached_at=event.breached_at,
        time_remaining_minutes=metrics["time_remaining_minutes"],
        percentage_elapsed=metrics["percentage_elapsed"],
    )


def _build_grievance_response(grv: Grievance) -> GrievanceResponse:
    # Build category summary
    cat_summary = None
    if grv.category:
        cat_summary = CategorySummary(
            id=str(grv.category.id),
            name=grv.category.name,
            department_id=str(grv.category.department_id),
        )

    # Build department summary
    dept_summary = None
    if grv.department:
        dept_summary = DepartmentSummary(
            id=str(grv.department.id),
            code=grv.department.code,
            name=grv.department.name,
        )

    # Build student summary
    stu_summary = None
    if grv.student:
        stu_summary = StudentSummary(
            id=str(grv.student.id),
            student_id=grv.student.student_id,
            user_full_name=grv.student.user.full_name if grv.student.user else None,
            user_email=grv.student.user.email if grv.student.user else None,
            program=grv.student.program,
            course_name=grv.student.course_name,
            semester=grv.student.semester,
            roll_number=grv.student.roll_number,
        )

    # Build assigned staff summary
    staff_summary = None
    if grv.assigned_staff:
        staff_summary = StaffSummary(
            id=str(grv.assigned_staff.id),
            employee_id=grv.assigned_staff.employee_id,
            user_full_name=grv.assigned_staff.user.full_name if grv.assigned_staff.user else None,
            user_email=grv.assigned_staff.user.email if grv.assigned_staff.user else None,
            designation=grv.assigned_staff.designation,
        )

    # Build updates history
    updates_out = []
    if grv.updates:
        # Sort updates chronologically
        sorted_updates = sorted(grv.updates, key=lambda u: u.created_at)
        for u in sorted_updates:
            updater_name = u.updater.full_name if u.updater else "System"
            updater_role = u.updater.role.name if (u.updater and u.updater.role) else "system"
            updates_out.append(
                GrievanceUpdateResponse(
                    id=str(u.id),
                    grievance_id=str(u.grievance_id),
                    updated_by=str(u.updated_by),
                    updater_name=updater_name,
                    updater_role=updater_role,
                    old_status=u.old_status,
                    new_status=u.new_status,
                    comment=u.comment,
                    created_at=u.created_at,
                )
            )

    # Build SLA events & current active SLA
    sla_events_out = []
    current_sla_out = None
    if grv.sla_events:
        # Sort events by started_at desc
        sorted_sla = sorted(grv.sla_events, key=lambda s: s.started_at, reverse=True)
        sla_events_out = [_build_sla_event_response(e) for e in sorted_sla]
        # Current SLA is the latest one
        if sla_events_out:
            current_sla_out = sla_events_out[0]

    return GrievanceResponse(
        id=str(grv.id),
        ticket_number=grv.ticket_number,
        student_id=str(grv.student_id),
        category_id=str(grv.category_id),
        department_id=str(grv.department_id),
        assigned_staff_id=str(grv.assigned_staff_id) if grv.assigned_staff_id else None,
        title=grv.title,
        description=grv.description,
        priority=grv.priority,
        status=grv.status,
        source=grv.source,
        created_at=grv.created_at,
        updated_at=grv.updated_at,
        resolved_at=grv.resolved_at,
        closed_at=grv.closed_at,
        category=cat_summary,
        department=dept_summary,
        student=stu_summary,
        assigned_staff=staff_summary,
        updates=updates_out,
        current_sla=current_sla_out,
        sla_events=sla_events_out,
    )


def _generate_ticket_number(db: Session) -> str:
    """Generates unique ticket number formatted as GRV-YYYYMMDD-XXXX."""
    date_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    for _ in range(10):
        rand_hex = uuid.uuid4().hex[:6].upper()
        ticket = f"GRV-{date_str}-{rand_hex}"
        exists = db.query(Grievance).filter(Grievance.ticket_number == ticket).first()
        if not exists:
            return ticket
    # Fallback with full timestamp suffix
    return f"GRV-{date_str}-{int(datetime.now().timestamp())}"


# ─── POST /grievances (Student submission) ────────────────────────────────────

@router.post("", status_code=status.HTTP_201_CREATED, response_model=GrievanceResponse)
def submit_grievance(
    payload: GrievanceCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(["student"])),
):
    """
    Student submits a Grievance (Section 6.2).
    - Auto-assigns department from category.
    - Generates ticket number.
    - Initiates SLA countdown clock (Section 8.1).
    - Creates initial update history row.
    """
    student = db.query(Student).filter(Student.user_id == current_user.id).first()
    if not student:
        raise APIException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="STUDENT_PROFILE_NOT_FOUND",
            message="Student profile not found. Please complete your profile first.",
        )

    # Validate category
    try:
        cat_id = uuid.UUID(payload.category_id)
    except ValueError:
        raise APIException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="INVALID_CATEGORY_ID",
            message="Invalid category ID format.",
        )

    category = db.query(Category).filter(Category.id == cat_id, Category.is_active == True).first()
    if not category:
        raise APIException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="CATEGORY_NOT_FOUND",
            message="The selected category does not exist or is inactive.",
        )

    grievance_id = uuid.uuid4()
    ticket_number = _generate_ticket_number(db)

    # Create Grievance
    grievance = Grievance(
        id=grievance_id,
        ticket_number=ticket_number,
        student_id=student.id,
        category_id=category.id,
        department_id=category.department_id,
        assigned_staff_id=None,
        title=payload.title,
        description=payload.description,
        priority=payload.priority.lower(),
        status="open",
        source="web",
    )
    db.add(grievance)
    db.flush()

    # Create SLA Event
    create_sla_event(db, grievance_id, payload.priority.lower())

    # Create initial update log
    initial_update = GrievanceUpdate(
        id=uuid.uuid4(),
        grievance_id=grievance_id,
        updated_by=current_user.id,
        old_status="none",
        new_status="open",
        comment="Grievance submitted by student.",
    )
    db.add(initial_update)

    db.commit()

    # Re-fetch with all eager loads
    grievance = (
        db.query(Grievance)
        .options(
            joinedload(Grievance.category),
            joinedload(Grievance.department),
            joinedload(Grievance.student).joinedload(Student.user),
            joinedload(Grievance.assigned_staff).joinedload(Staff.user),
            joinedload(Grievance.updates).joinedload(GrievanceUpdate.updater).joinedload(User.role),
            joinedload(Grievance.sla_events).joinedload(SLAEvent.sla_policy),
        )
        .filter(Grievance.id == grievance_id)
        .first()
    )

    logger.info(f"Grievance {ticket_number} created by student {student.id}")
    return _build_grievance_response(grievance)


# ─── GET /grievances/mine (Student list) ───────────────────────────────────────

@router.get("/mine", response_model=GrievanceListResponse)
def list_my_grievances(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=50),
    status: Optional[str] = Query(default=None),
    priority: Optional[str] = Query(default=None),
    category_id: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(require_role(["student"])),
):
    """Student views their own submitted grievances."""
    student = db.query(Student).filter(Student.user_id == current_user.id).first()
    if not student:
        raise APIException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="STUDENT_PROFILE_NOT_FOUND",
            message="Student profile not found.",
        )

    query = (
        db.query(Grievance)
        .options(
            joinedload(Grievance.category),
            joinedload(Grievance.department),
            joinedload(Grievance.student).joinedload(Student.user),
            joinedload(Grievance.assigned_staff).joinedload(Staff.user),
            joinedload(Grievance.updates).joinedload(GrievanceUpdate.updater).joinedload(User.role),
            joinedload(Grievance.sla_events).joinedload(SLAEvent.sla_policy),
        )
        .filter(Grievance.student_id == student.id)
    )

    filters = []
    if status:
        filters.append(Grievance.status == status.lower())
    if priority:
        filters.append(Grievance.priority == priority.lower())
    if category_id:
        try:
            filters.append(Grievance.category_id == uuid.UUID(category_id))
        except ValueError:
            pass
    if search:
        search_pattern = f"%{search}%"
        filters.append(or_(
            Grievance.title.ilike(search_pattern),
            Grievance.ticket_number.ilike(search_pattern),
            Grievance.description.ilike(search_pattern),
        ))

    if filters:
        query = query.filter(and_(*filters))

    query = query.order_by(desc(Grievance.created_at))

    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()

    return GrievanceListResponse(
        items=[_build_grievance_response(g) for g in items],
        page=page,
        page_size=page_size,
        total=total,
        total_pages=math.ceil(total / page_size) if total else 1,
    )


# ─── GET /grievances/assigned (Staff assigned queue) ──────────────────────────

@router.get("/assigned", response_model=GrievanceListResponse)
def list_assigned_grievances(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=50),
    status: Optional[str] = Query(default=None),
    priority: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(require_role(["staff", "hod"])),
):
    """Staff or HOD views grievances assigned specifically to them."""
    staff = db.query(Staff).filter(Staff.user_id == current_user.id).first()
    if not staff:
        raise APIException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="STAFF_PROFILE_NOT_FOUND",
            message="Staff profile not found.",
        )

    query = (
        db.query(Grievance)
        .options(
            joinedload(Grievance.category),
            joinedload(Grievance.department),
            joinedload(Grievance.student).joinedload(Student.user),
            joinedload(Grievance.assigned_staff).joinedload(Staff.user),
            joinedload(Grievance.updates).joinedload(GrievanceUpdate.updater).joinedload(User.role),
            joinedload(Grievance.sla_events).joinedload(SLAEvent.sla_policy),
        )
        .filter(Grievance.assigned_staff_id == staff.id)
    )

    filters = []
    if status:
        filters.append(Grievance.status == status.lower())
    if priority:
        filters.append(Grievance.priority == priority.lower())
    if search:
        search_pattern = f"%{search}%"
        filters.append(or_(
            Grievance.title.ilike(search_pattern),
            Grievance.ticket_number.ilike(search_pattern),
        ))

    if filters:
        query = query.filter(and_(*filters))

    query = query.order_by(desc(Grievance.created_at))

    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()

    return GrievanceListResponse(
        items=[_build_grievance_response(g) for g in items],
        page=page,
        page_size=page_size,
        total=total,
        total_pages=math.ceil(total / page_size) if total else 1,
    )


# ─── GET /grievances (Admin / HOD / Staff Directory) ─────────────────────────

@router.get("", response_model=GrievanceListResponse)
def list_all_grievances(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status: Optional[str] = Query(default=None),
    priority: Optional[str] = Query(default=None),
    department_id: Optional[str] = Query(default=None),
    category_id: Optional[str] = Query(default=None),
    assigned_staff_id: Optional[str] = Query(default=None),
    sla_status: Optional[str] = Query(default=None, description="on_track / warning / breached / completed"),
    search: Optional[str] = Query(default=None),
    date_from: Optional[str] = Query(default=None),
    date_to: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(require_role(["admin", "hod", "staff"])),
):
    """
    Admin/HOD/Staff directory listing.
    - HOD is automatically scoped to their department.
    """
    caller_role = current_user.role.name
    query = (
        db.query(Grievance)
        .options(
            joinedload(Grievance.category),
            joinedload(Grievance.department),
            joinedload(Grievance.student).joinedload(Student.user),
            joinedload(Grievance.assigned_staff).joinedload(Staff.user),
            joinedload(Grievance.updates).joinedload(GrievanceUpdate.updater).joinedload(User.role),
            joinedload(Grievance.sla_events).joinedload(SLAEvent.sla_policy),
        )
    )

    filters = []

    # HOD department scoping
    if caller_role == "hod":
        staff_prof = current_user.staff_profile or db.query(Staff).filter(Staff.user_id == current_user.id).first()
        if staff_prof:
            filters.append(Grievance.department_id == staff_prof.department_id)

    # Department filter (Admin only)
    if department_id and caller_role == "admin":
        try:
            filters.append(Grievance.department_id == uuid.UUID(department_id))
        except ValueError:
            pass

    # Status & Priority
    if status:
        filters.append(Grievance.status == status.lower())
    if priority:
        filters.append(Grievance.priority == priority.lower())

    # Category
    if category_id:
        try:
            filters.append(Grievance.category_id == uuid.UUID(category_id))
        except ValueError:
            pass

    # Assigned staff
    if assigned_staff_id:
        try:
            filters.append(Grievance.assigned_staff_id == uuid.UUID(assigned_staff_id))
        except ValueError:
            pass

    # Full text search on ticket #, title, description
    if search:
        search_pattern = f"%{search}%"
        filters.append(or_(
            Grievance.ticket_number.ilike(search_pattern),
            Grievance.title.ilike(search_pattern),
            Grievance.description.ilike(search_pattern),
        ))

    # Date range
    if date_from:
        try:
            filters.append(Grievance.created_at >= datetime.fromisoformat(date_from))
        except ValueError:
            pass
    if date_to:
        try:
            filters.append(Grievance.created_at <= datetime.fromisoformat(date_to + "T23:59:59"))
        except ValueError:
            pass

    # SLA status filter (joins SLAEvent)
    if sla_status:
        query = query.join(Grievance.sla_events).filter(SLAEvent.status == sla_status.lower())

    if filters:
        query = query.filter(and_(*filters))

    query = query.order_by(desc(Grievance.created_at))

    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()

    return GrievanceListResponse(
        items=[_build_grievance_response(g) for g in items],
        page=page,
        page_size=page_size,
        total=total,
        total_pages=math.ceil(total / page_size) if total else 1,
    )


# ─── GET /grievances/{id} ─────────────────────────────────────────────────────

@router.get("/{grievance_id}", response_model=GrievanceResponse)
def get_grievance_detail(
    grievance_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Get detailed single grievance with history updates and SLA timers.
    Enforces privacy: Student can only view their own grievance.
    """
    try:
        gid = uuid.UUID(grievance_id)
    except ValueError:
        raise APIException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="INVALID_ID",
            message="Invalid grievance ID format.",
        )

    grievance = (
        db.query(Grievance)
        .options(
            joinedload(Grievance.category),
            joinedload(Grievance.department),
            joinedload(Grievance.student).joinedload(Student.user),
            joinedload(Grievance.assigned_staff).joinedload(Staff.user),
            joinedload(Grievance.updates).joinedload(GrievanceUpdate.updater).joinedload(User.role),
            joinedload(Grievance.sla_events).joinedload(SLAEvent.sla_policy),
        )
        .filter(Grievance.id == gid)
        .first()
    )

    if not grievance:
        raise APIException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="GRIEVANCE_NOT_FOUND",
            message="The requested grievance does not exist.",
        )

    # Role-based access check
    caller_role = current_user.role.name
    if caller_role == "student":
        student = db.query(Student).filter(Student.user_id == current_user.id).first()
        if not student or grievance.student_id != student.id:
            raise APIException(
                status_code=status.HTTP_403_FORBIDDEN,
                code="PERMISSION_DENIED",
                message="You are not authorized to view this grievance.",
            )
    elif caller_role == "hod":
        staff = db.query(Staff).filter(Staff.user_id == current_user.id).first()
        if staff and grievance.department_id != staff.department_id:
            raise APIException(
                status_code=status.HTTP_403_FORBIDDEN,
                code="PERMISSION_DENIED",
                message="You can only view grievances belonging to your department.",
            )

    return _build_grievance_response(grievance)


# ─── PATCH /grievances/{id}/status (Section 7 Transition Rules) ───────────────

@router.patch("/{grievance_id}/status", response_model=GrievanceResponse)
def update_grievance_status(
    grievance_id: str,
    payload: GrievanceStatusUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Enforces Section 7 exact state transition matrix.
    Transitions:
      - open        -> in_progress (Assigned Staff or Admin)
      - in_progress -> resolved    (Assigned Staff or Admin)
      - resolved    -> closed      (Student owner or Admin)
      - resolved    -> reopened    (Student owner only -> starts new SLA cycle)
      - reopened    -> in_progress (Assigned Staff or Admin)
      - closed      -> anything    (REJECTED: 409 Conflict)
    """
    try:
        gid = uuid.UUID(grievance_id)
    except ValueError:
        raise APIException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="INVALID_ID",
            message="Invalid grievance ID format.",
        )

    grievance = db.query(Grievance).filter(Grievance.id == gid).first()
    if not grievance:
        raise APIException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="GRIEVANCE_NOT_FOUND",
            message="The requested grievance does not exist.",
        )

    old_status = grievance.status
    new_status = payload.status.lower()
    caller_role = current_user.role.name

    # Check if closed — closed is final in v1 (Section 7)
    if old_status == "closed":
        raise APIException(
            status_code=status.HTTP_409_CONFLICT,
            code="INVALID_TRANSITION",
            message="Grievance is closed and cannot be modified further.",
        )

    # Valid transitions matrix: (old_status, new_status) -> allowed roles / conditions
    # Helper to check if caller is student owner
    student_record = db.query(Student).filter(Student.user_id == current_user.id).first() if caller_role == "student" else None
    is_owner = (student_record is not None) and (grievance.student_id == student_record.id)

    # Helper to check staff permissions
    staff_record = db.query(Staff).filter(Staff.user_id == current_user.id).first() if caller_role in ("staff", "hod") else None
    is_assigned_staff = (staff_record is not None) and (grievance.assigned_staff_id == staff_record.id)
    is_department_hod = (caller_role == "hod") and (staff_record is not None) and (grievance.department_id == staff_record.department_id)
    is_admin = caller_role == "admin"

    # Transition 1: open -> in_progress (Assigned Staff, HOD, or Admin)
    if old_status == "open" and new_status == "in_progress":
        if not (is_assigned_staff or is_department_hod or is_admin):
            # If staff in department starts it, auto-assign
            if caller_role in ("staff", "hod") and staff_record and staff_record.department_id == grievance.department_id:
                grievance.assigned_staff_id = staff_record.id
            else:
                raise APIException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    code="PERMISSION_DENIED",
                    message="Only assigned staff, department HOD, or Admin can move ticket to in_progress.",
                )

    # Transition 2: in_progress -> resolved (Assigned Staff, HOD, or Admin)
    elif old_status == "in_progress" and new_status == "resolved":
        if not (is_assigned_staff or is_department_hod or is_admin):
            raise APIException(
                status_code=status.HTTP_403_FORBIDDEN,
                code="PERMISSION_DENIED",
                message="Only assigned staff, department HOD, or Admin can mark ticket as resolved.",
            )
        grievance.resolved_at = datetime.now(timezone.utc)
        complete_sla_event(db, grievance.id, grievance.resolved_at)

    # Transition 3: resolved -> closed (Student owner or Admin)
    elif old_status == "resolved" and new_status == "closed":
        if not (is_owner or is_admin):
            raise APIException(
                status_code=status.HTTP_403_FORBIDDEN,
                code="PERMISSION_DENIED",
                message="Only the student who raised the grievance or an Admin can close the ticket.",
            )
        grievance.closed_at = datetime.now(timezone.utc)

    # Transition 4: resolved -> reopened (Student owner ONLY — Section 7 & 8.3)
    elif old_status == "resolved" and new_status == "reopened":
        if not is_owner:
            raise APIException(
                status_code=status.HTTP_403_FORBIDDEN,
                code="PERMISSION_DENIED",
                message="Only the student who raised the grievance can reopen it.",
            )
        grievance.resolved_at = None
        # Start new SLA event cycle (Section 8.3)
        reopen_sla_event(db, grievance.id, grievance.priority)

    # Transition 5: reopened -> in_progress (Assigned Staff, HOD, or Admin)
    elif old_status == "reopened" and new_status == "in_progress":
        if not (is_assigned_staff or is_department_hod or is_admin):
            raise APIException(
                status_code=status.HTTP_403_FORBIDDEN,
                code="PERMISSION_DENIED",
                message="Only assigned staff, department HOD, or Admin can move reopened ticket to in_progress.",
            )

    # Any other transition is forbidden
    else:
        raise APIException(
            status_code=status.HTTP_409_CONFLICT,
            code="INVALID_STATUS_TRANSITION",
            message=f"Transition from '{old_status}' to '{new_status}' is invalid per Section 7 rules.",
        )

    # Update grievance status
    grievance.status = new_status
    grievance.updated_at = datetime.now(timezone.utc)

    # Log update history
    update_log = GrievanceUpdate(
        id=uuid.uuid4(),
        grievance_id=grievance.id,
        updated_by=current_user.id,
        old_status=old_status,
        new_status=new_status,
        comment=payload.comment or f"Status changed from {old_status} to {new_status}.",
    )
    db.add(update_log)

    db.commit()

    # Re-fetch full grievance
    grievance = (
        db.query(Grievance)
        .options(
            joinedload(Grievance.category),
            joinedload(Grievance.department),
            joinedload(Grievance.student).joinedload(Student.user),
            joinedload(Grievance.assigned_staff).joinedload(Staff.user),
            joinedload(Grievance.updates).joinedload(GrievanceUpdate.updater).joinedload(User.role),
            joinedload(Grievance.sla_events).joinedload(SLAEvent.sla_policy),
        )
        .filter(Grievance.id == gid)
        .first()
    )

    logger.info(f"Grievance {grievance.ticket_number} transitioned {old_status} -> {new_status} by {current_user.email}")
    return _build_grievance_response(grievance)


# ─── PATCH /grievances/{id}/assign (Admin / HOD assignment) ───────────────────

@router.patch("/{grievance_id}/assign", response_model=GrievanceResponse)
def assign_grievance_staff(
    grievance_id: str,
    payload: GrievanceAssign,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(["admin", "hod"])),
):
    """Assign or reassign a grievance to a staff member."""
    try:
        gid = uuid.UUID(grievance_id)
        staff_id = uuid.UUID(payload.assigned_staff_id)
    except ValueError:
        raise APIException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="INVALID_ID",
            message="Invalid UUID format for grievance or staff ID.",
        )

    grievance = db.query(Grievance).filter(Grievance.id == gid).first()
    if not grievance:
        raise APIException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="GRIEVANCE_NOT_FOUND",
            message="The requested grievance does not exist.",
        )

    if grievance.status == "closed":
        raise APIException(
            status_code=status.HTTP_409_CONFLICT,
            code="GRIEVANCE_CLOSED",
            message="Cannot reassign a closed grievance.",
        )

    # Validate staff
    staff = db.query(Staff).options(joinedload(Staff.user)).filter(Staff.id == staff_id).first()
    if not staff:
        raise APIException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="STAFF_NOT_FOUND",
            message="The selected staff member does not exist.",
        )

    # If HOD, staff must belong to same department
    caller_role = current_user.role.name
    if caller_role == "hod":
        hod_staff = db.query(Staff).filter(Staff.user_id == current_user.id).first()
        if hod_staff and (grievance.department_id != hod_staff.department_id or staff.department_id != hod_staff.department_id):
            raise APIException(
                status_code=status.HTTP_403_FORBIDDEN,
                code="PERMISSION_DENIED",
                message="HOD can only assign staff within their own department.",
            )

    old_staff_id = grievance.assigned_staff_id
    grievance.assigned_staff_id = staff.id
    grievance.updated_at = datetime.now(timezone.utc)

    staff_name = staff.user.full_name if staff.user else staff.employee_id
    comment = payload.comment or f"Assigned to {staff_name} ({staff.designation or 'Staff'})."

    update_log = GrievanceUpdate(
        id=uuid.uuid4(),
        grievance_id=grievance.id,
        updated_by=current_user.id,
        old_status=grievance.status,
        new_status=grievance.status,
        comment=comment,
    )
    db.add(update_log)
    db.commit()

    # Re-fetch
    grievance = (
        db.query(Grievance)
        .options(
            joinedload(Grievance.category),
            joinedload(Grievance.department),
            joinedload(Grievance.student).joinedload(Student.user),
            joinedload(Grievance.assigned_staff).joinedload(Staff.user),
            joinedload(Grievance.updates).joinedload(GrievanceUpdate.updater).joinedload(User.role),
            joinedload(Grievance.sla_events).joinedload(SLAEvent.sla_policy),
        )
        .filter(Grievance.id == gid)
        .first()
    )

    logger.info(f"Grievance {grievance.ticket_number} assigned to {staff_name} by {current_user.email}")
    return _build_grievance_response(grievance)
