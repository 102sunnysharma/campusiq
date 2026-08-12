import uuid
from sqlalchemy import (
    Column, String, Text, Boolean, Integer, SmallInteger,
    Numeric, DateTime, Date, ForeignKey, func
)
from sqlalchemy.dialects.postgresql import UUID, JSONB, INET
from sqlalchemy.orm import relationship
from app.database import Base

# Table 01 - Roles
class Role(Base):
    __tablename__ = "roles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(50), unique=True, nullable=False)
    description = Column(Text, nullable=True)

    users = relationship("User", back_populates="role")


# Table 02 - Users
class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(Text, nullable=False)
    full_name = Column(String(255), nullable=False)
    phone = Column(String(20), nullable=True)
    role_id = Column(UUID(as_uuid=True), ForeignKey("roles.id", onupdate="CASCADE", ondelete="RESTRICT"), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    last_login_at = Column(DateTime(timezone=True), nullable=True)

    role = relationship("Role", back_populates="users")
    student_profile = relationship("Student", back_populates="user", uselist=False)
    staff_profile = relationship("Staff", back_populates="user", uselist=False, foreign_keys="Staff.user_id")
    notifications = relationship("Notification", back_populates="user")
    audit_logs = relationship("AuditLog", back_populates="user")
    grievance_updates = relationship("GrievanceUpdate", back_populates="updater")
    data_imports = relationship("DataImport", back_populates="uploader")


# Table 05 - Departments
class Department(Base):
    __tablename__ = "departments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), unique=True, nullable=False)
    code = Column(String(20), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    hod_staff_id = Column(
        UUID(as_uuid=True),
        ForeignKey("staff.id", onupdate="CASCADE", ondelete="RESTRICT", use_alter=True, name="fk_departments_hod_staff_id"),
        nullable=True
    )
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    hod = relationship("Staff", foreign_keys=[hod_staff_id], post_update=True)
    staff_members = relationship("Staff", back_populates="department", foreign_keys="Staff.department_id")
    students = relationship("Student", back_populates="department")
    categories = relationship("Category", back_populates="department")
    facilities = relationship("Facility", back_populates="department")
    grievances = relationship("Grievance", back_populates="department")
    operational_metrics = relationship("OperationalMetric", back_populates="department")


# Table 03 - Students
class Student(Base):
    __tablename__ = "students"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", onupdate="CASCADE", ondelete="RESTRICT"), unique=True, nullable=False)
    student_id = Column(String(50), unique=True, nullable=False)
    roll_number = Column(String(50), nullable=True)
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id", onupdate="CASCADE", ondelete="RESTRICT"), nullable=False)
    semester = Column(Integer, nullable=True)
    program = Column(String(100), nullable=True)
    course_name = Column(String(150), nullable=True)
    hostel_id = Column(UUID(as_uuid=True), nullable=True)
    room_number = Column(String(20), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", back_populates="student_profile")
    department = relationship("Department", back_populates="students")
    feedbacks = relationship("Feedback", back_populates="student")
    grievances = relationship("Grievance", back_populates="student")


# Table 04 - Staff
class Staff(Base):
    __tablename__ = "staff"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", onupdate="CASCADE", ondelete="RESTRICT"), unique=True, nullable=False)
    employee_id = Column(String(50), unique=True, nullable=False)
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id", onupdate="CASCADE", ondelete="RESTRICT"), nullable=False)
    designation = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", back_populates="staff_profile", foreign_keys=[user_id])
    department = relationship("Department", back_populates="staff_members", foreign_keys=[department_id])
    assigned_grievances = relationship("Grievance", back_populates="assigned_staff")


# Table 06 - Categories
class Category(Base):
    __tablename__ = "categories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id", onupdate="CASCADE", ondelete="RESTRICT"), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    department = relationship("Department", back_populates="categories")
    feedbacks = relationship("Feedback", back_populates="category")
    grievances = relationship("Grievance", back_populates="category")
    operational_metrics = relationship("OperationalMetric", back_populates="category")


# Table 07 - Feedback
class Feedback(Base):
    __tablename__ = "feedback"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id", onupdate="CASCADE", ondelete="RESTRICT"), nullable=False)
    category_id = Column(UUID(as_uuid=True), ForeignKey("categories.id", onupdate="CASCADE", ondelete="RESTRICT"), nullable=False)
    content = Column(Text, nullable=False)
    rating = Column(SmallInteger, nullable=False)
    is_anonymous = Column(Boolean, default=False, nullable=False)
    status = Column(String(20), default="submitted", nullable=False)  # submitted / analyzed / analysis_failed
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    student = relationship("Student", back_populates="feedbacks")
    category = relationship("Category", back_populates="feedbacks")
    analysis = relationship("FeedbackAnalysis", back_populates="feedback", uselist=False)


# Table 08 - Feedback Analysis
class FeedbackAnalysis(Base):
    __tablename__ = "feedback_analysis"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    feedback_id = Column(UUID(as_uuid=True), ForeignKey("feedback.id", onupdate="CASCADE", ondelete="RESTRICT"), unique=True, nullable=False)
    sentiment = Column(String(20), nullable=True)  # positive / neutral / negative
    sentiment_score = Column(Numeric(5, 2), nullable=True)
    category_prediction = Column(String(100), nullable=True)
    severity = Column(String(20), nullable=True)
    confidence_score = Column(Numeric(5, 2), nullable=True)
    language = Column(String(10), nullable=True)
    keywords = Column(JSONB, nullable=True)
    topics = Column(JSONB, nullable=True)
    model_name = Column(String(100), nullable=True)
    model_version = Column(String(50), nullable=True)
    analysis_status = Column(String(20), default="PENDING", nullable=False)  # PENDING / COMPLETED / FAILED
    error_message = Column(Text, nullable=True)
    processed_at = Column(DateTime(timezone=True), nullable=True)

    feedback = relationship("Feedback", back_populates="analysis")


# Table 09 - Grievances
class Grievance(Base):
    __tablename__ = "grievances"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_number = Column(String(30), unique=True, nullable=False)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id", onupdate="CASCADE", ondelete="RESTRICT"), nullable=False)
    category_id = Column(UUID(as_uuid=True), ForeignKey("categories.id", onupdate="CASCADE", ondelete="RESTRICT"), nullable=False)
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id", onupdate="CASCADE", ondelete="RESTRICT"), nullable=False)
    assigned_staff_id = Column(UUID(as_uuid=True), ForeignKey("staff.id", onupdate="CASCADE", ondelete="RESTRICT"), nullable=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    priority = Column(String(20), nullable=False)  # low / medium / high / urgent
    status = Column(String(20), default="open", nullable=False)  # open / in_progress / resolved / closed / reopened
    source = Column(String(30), default="web", nullable=False)  # web / admin_created
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    closed_at = Column(DateTime(timezone=True), nullable=True)

    student = relationship("Student", back_populates="grievances")
    category = relationship("Category", back_populates="grievances")
    department = relationship("Department", back_populates="grievances")
    assigned_staff = relationship("Staff", back_populates="assigned_grievances")
    updates = relationship("GrievanceUpdate", back_populates="grievance")
    sla_events = relationship("SLAEvent", back_populates="grievance")


# Table 10 - Grievance Updates
class GrievanceUpdate(Base):
    __tablename__ = "grievance_updates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    grievance_id = Column(UUID(as_uuid=True), ForeignKey("grievances.id", onupdate="CASCADE", ondelete="RESTRICT"), nullable=False)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id", onupdate="CASCADE", ondelete="RESTRICT"), nullable=False)
    old_status = Column(String(20), nullable=False)
    new_status = Column(String(20), nullable=False)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    grievance = relationship("Grievance", back_populates="updates")
    updater = relationship("User", back_populates="grievance_updates")


# Table 11 - SLA Policies
class SLAPolicy(Base):
    __tablename__ = "sla_policies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    priority = Column(String(20), unique=True, nullable=False)
    duration_minutes = Column(Integer, nullable=False)
    warning_percentage = Column(Integer, default=80, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    sla_events = relationship("SLAEvent", back_populates="sla_policy")


# Table 12 - SLA Events
class SLAEvent(Base):
    __tablename__ = "sla_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    grievance_id = Column(UUID(as_uuid=True), ForeignKey("grievances.id", onupdate="CASCADE", ondelete="RESTRICT"), nullable=False)
    sla_policy_id = Column(UUID(as_uuid=True), ForeignKey("sla_policies.id", onupdate="CASCADE", ondelete="RESTRICT"), nullable=False)
    started_at = Column(DateTime(timezone=True), nullable=False)
    deadline_at = Column(DateTime(timezone=True), nullable=False)
    warning_at = Column(DateTime(timezone=True), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(20), default="on_track", nullable=False)  # on_track / warning / breached / completed
    breached_at = Column(DateTime(timezone=True), nullable=True)

    grievance = relationship("Grievance", back_populates="sla_events")
    sla_policy = relationship("SLAPolicy", back_populates="sla_events")


# Table 13 - Notifications
class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", onupdate="CASCADE", ondelete="RESTRICT"), nullable=False)
    type = Column(String(50), nullable=False)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    reference_type = Column(String(50), nullable=True)
    reference_id = Column(UUID(as_uuid=True), nullable=True)
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    read_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="notifications")


# Table 14 - Audit Logs
class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", onupdate="CASCADE", ondelete="SET NULL"), nullable=True)
    action = Column(String(100), nullable=False)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(UUID(as_uuid=True), nullable=False)
    old_values = Column(JSONB, nullable=True)
    new_values = Column(JSONB, nullable=True)
    ip_address = Column(INET, nullable=True)
    user_agent = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="audit_logs")


# Table 15 - Facilities
class Facility(Base):
    __tablename__ = "facilities"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    type = Column(String(50), nullable=False)
    location = Column(String(255), nullable=False)
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id", onupdate="CASCADE", ondelete="RESTRICT"), nullable=False)
    capacity = Column(Integer, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    department = relationship("Department", back_populates="facilities")


# Table 16 - Transport Routes
class TransportRoute(Base):
    __tablename__ = "transport_routes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    route_name = Column(String(100), nullable=False)
    route_number = Column(String(50), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    stops = relationship("TransportStop", back_populates="route", cascade="all, delete-orphan")


# Table 17 - Transport Stops
class TransportStop(Base):
    __tablename__ = "transport_stops"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    route_id = Column(UUID(as_uuid=True), ForeignKey("transport_routes.id", onupdate="CASCADE", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    latitude = Column(Numeric(9, 6), nullable=False)
    longitude = Column(Numeric(9, 6), nullable=False)
    sequence = Column(Integer, nullable=False)

    route = relationship("TransportRoute", back_populates="stops")


# Table 18 - Data Imports
class DataImport(Base):
    __tablename__ = "data_imports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id", onupdate="CASCADE", ondelete="RESTRICT"), nullable=False)
    file_name = Column(String(255), nullable=False)
    data_type = Column(String(50), nullable=False)  # attendance / exam_schedule / facility_usage / feedback / transport
    status = Column(String(20), default="uploaded", nullable=False)  # uploaded / validating / preview_ready / importing / completed / failed
    total_records = Column(Integer, nullable=True)
    successful_records = Column(Integer, nullable=True)
    failed_records = Column(Integer, nullable=True)
    error_report = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    uploader = relationship("User", back_populates="data_imports")


# Table 19 - Operational Metrics
class OperationalMetric(Base):
    __tablename__ = "operational_metrics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id", onupdate="CASCADE", ondelete="RESTRICT"), nullable=False)
    category_id = Column(UUID(as_uuid=True), ForeignKey("categories.id", onupdate="CASCADE", ondelete="RESTRICT"), nullable=False)
    metric_date = Column(Date, nullable=False)
    total_feedback = Column(Integer, default=0, nullable=False)
    negative_feedback = Column(Integer, default=0, nullable=False)
    total_grievances = Column(Integer, default=0, nullable=False)
    resolved_grievances = Column(Integer, default=0, nullable=False)
    sla_breaches = Column(Integer, default=0, nullable=False)
    avg_resolution_minutes = Column(Integer, default=0, nullable=False)
    student_satisfaction = Column(Numeric(5, 2), default=0.00, nullable=False)
    gap_score = Column(Numeric(5, 2), default=0.00, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    department = relationship("Department", back_populates="operational_metrics")
    category = relationship("Category", back_populates="operational_metrics")
