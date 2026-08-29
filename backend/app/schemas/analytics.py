"""
Pydantic Schemas — Analytics (Phase 8, Section 12)
"""

from __future__ import annotations
from typing import Optional, List, Any, Dict
from datetime import date

from pydantic import BaseModel


class AggregateRequest(BaseModel):
    target_date: Optional[date] = None  # defaults to today if omitted


class AggregateResponse(BaseModel):
    success: bool
    rows_updated: int
    target_date: str
    message: str


class MetricsSummary(BaseModel):
    total_feedback: int
    negative_feedback: int
    negative_feedback_pct: float
    total_grievances: int
    resolved_grievances: int
    open_grievances: int
    sla_breaches: int
    sla_compliance_pct: float
    avg_resolution_minutes: int
    student_satisfaction: float
    overall_gap_score: float
    gap_score_label: str


class DepartmentMetricsRow(BaseModel):
    department_id: str
    department_name: str
    total_feedback: int
    negative_feedback: int
    negative_feedback_pct: float
    total_grievances: int
    resolved_grievances: int
    sla_breaches: int
    sla_compliance_pct: float
    avg_resolution_minutes: int
    student_satisfaction: float
    gap_score: float
    gap_score_label: str


class TrendDataPoint(BaseModel):
    date: str
    total_feedback: int
    negative_feedback: int
    total_grievances: int
    sla_breaches: int


class RecurringIssueRow(BaseModel):
    category_id: str
    category_name: str
    total_feedback: int
    total_grievances: int
    total_volume: int
    percentage: float


class DepartmentListResponse(BaseModel):
    items: List[DepartmentMetricsRow]


class TrendsResponse(BaseModel):
    items: List[TrendDataPoint]


class RecurringIssuesResponse(BaseModel):
    items: List[RecurringIssueRow]
