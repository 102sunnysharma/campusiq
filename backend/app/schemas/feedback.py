"""
Pydantic Schemas — Feedback Module (Phase 5)

Covers:
  - FeedbackCreate      : student submission payload
  - FeedbackResponse    : single feedback with nested optional analysis
  - FeedbackListResponse: paginated wrapper
  - FeedbackAnalysisResponse: NLP analysis detail
"""

from __future__ import annotations
from typing import Optional, List, Any
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, field_validator


# ─── Analysis ─────────────────────────────────────────────────────────────────

class FeedbackAnalysisResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    feedback_id: str
    sentiment: Optional[str] = None           # positive / neutral / negative
    sentiment_score: Optional[float] = None
    category_prediction: Optional[str] = None
    severity: Optional[str] = None            # critical / high / medium / low
    confidence_score: Optional[float] = None
    language: Optional[str] = None
    keywords: Optional[List[str]] = None
    topics: Optional[List[str]] = None
    model_name: Optional[str] = None
    model_version: Optional[str] = None
    analysis_status: str                       # PENDING / COMPLETED / FAILED
    error_message: Optional[str] = None
    processed_at: Optional[datetime] = None


# ─── Category summary (embedded in response) ──────────────────────────────────

class CategorySummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    department_id: str


class StudentSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    student_id: str
    user_full_name: Optional[str] = None


# ─── Feedback Create ───────────────────────────────────────────────────────────

class FeedbackCreate(BaseModel):
    category_id: str = Field(..., description="UUID of the category for this feedback")
    content: str = Field(..., min_length=10, max_length=5000, description="Feedback text (10–5000 chars)")
    rating: int = Field(..., ge=1, le=5, description="Rating from 1 (worst) to 5 (best)")
    is_anonymous: bool = Field(default=False, description="Submit anonymously — hides student identity from non-admin viewers")

    @field_validator("content")
    @classmethod
    def content_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Feedback content cannot be blank.")
        return v.strip()


# ─── Feedback Response ────────────────────────────────────────────────────────

class FeedbackResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    student_id: str
    category_id: str
    content: str
    rating: int
    is_anonymous: bool
    status: str   # submitted / analyzed / analysis_failed
    created_at: datetime
    updated_at: datetime

    # Populated when include_details=True or when caller joins eagerly
    category: Optional[CategorySummary] = None
    student: Optional[StudentSummary] = None   # None when anonymous + non-admin caller
    analysis: Optional[FeedbackAnalysisResponse] = None


# ─── Feedback List (paginated) ────────────────────────────────────────────────

class FeedbackListResponse(BaseModel):
    items: List[FeedbackResponse]
    page: int
    page_size: int
    total: int
    total_pages: int
