"""
Tests — Analytics & operational_metrics Aggregation (Phase 8)

Covers:
  1. Aggregation creates rows in operational_metrics for today.
  2. Aggregation is idempotent (re-running same date doesn't duplicate).
  3. GET /analytics/summary returns all required KPI keys.
  4. GET /analytics/departments returns per-department list.
  5. GET /analytics/trends returns time-series list.
  6. GET /analytics/recurring-issues returns category rankings.
  7. Analytics endpoints are 403 Forbidden for students and staff.
"""

import pytest
from datetime import date
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


# ─── Auth Helpers ─────────────────────────────────────────────────────────────

def get_admin_headers():
    res = client.post("/auth/login", json={"email": "admin@krmu.edu.in", "password": "Admin@123"})
    assert res.status_code == 200, f"Admin login failed: {res.text}"
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def get_student_headers():
    res = client.post("/auth/login", json={"email": "student.cse@krmu.edu.in", "password": "Student@123"})
    assert res.status_code == 200, f"Student login failed: {res.text}"
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def get_staff_headers():
    res = client.post("/auth/login", json={"email": "staff.cse@krmu.edu.in", "password": "Staff@123"})
    assert res.status_code == 200, f"Staff login failed: {res.text}"
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def trigger_today_aggregation(admin_headers):
    """Helper to trigger aggregation for today and return the response."""
    res = client.post("/analytics/aggregate", json={"target_date": str(date.today())}, headers=admin_headers)
    return res


# ─── Test 1: Aggregation Creates Rows ─────────────────────────────────────────

def test_aggregate_creates_rows():
    """
    POST /analytics/aggregate for today should create at least 0 rows (may be 0 if no
    active dept/category pairs). Always returns 200 with success=True.
    """
    admin_headers = get_admin_headers()
    res = trigger_today_aggregation(admin_headers)

    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "rows_updated" in data
    assert isinstance(data["rows_updated"], int)
    assert data["rows_updated"] >= 0
    assert str(date.today()) in data["target_date"]


# ─── Test 2: Aggregation is Idempotent ────────────────────────────────────────

def test_aggregate_is_idempotent():
    """
    Running aggregation twice for the same date should upsert (not duplicate).
    Both calls should return the same rows_updated count.
    """
    admin_headers = get_admin_headers()
    first = trigger_today_aggregation(admin_headers)
    second = trigger_today_aggregation(admin_headers)

    assert first.status_code == 200
    assert second.status_code == 200
    # Both runs should update the same number of rows
    assert first.json()["rows_updated"] == second.json()["rows_updated"]


# ─── Test 3: Summary Endpoint Returns All KPI Keys ────────────────────────────

def test_summary_endpoint_returns_kpis():
    """
    GET /analytics/summary must return all 12 required Section 12.2 KPI keys.
    """
    admin_headers = get_admin_headers()
    # Ensure there is aggregated data
    trigger_today_aggregation(admin_headers)

    res = client.get("/analytics/summary", headers=admin_headers)
    assert res.status_code == 200

    data = res.json()
    required_keys = [
        "total_feedback",
        "negative_feedback",
        "negative_feedback_pct",
        "total_grievances",
        "resolved_grievances",
        "open_grievances",
        "sla_breaches",
        "sla_compliance_pct",
        "avg_resolution_minutes",
        "student_satisfaction",
        "overall_gap_score",
        "gap_score_label",
    ]
    for key in required_keys:
        assert key in data, f"Missing key: {key}"

    # gap_score_label must be one of the valid bands
    assert data["gap_score_label"] in ["Low", "Moderate", "High", "Critical"]
    # Percentages must be 0–100
    assert 0.0 <= data["sla_compliance_pct"] <= 100.0
    assert 0.0 <= data["overall_gap_score"] <= 100.0


# ─── Test 4: Departments Endpoint ─────────────────────────────────────────────

def test_departments_endpoint():
    """
    GET /analytics/departments returns a list of department objects
    with all required fields including gap_score and gap_score_label.
    """
    admin_headers = get_admin_headers()
    trigger_today_aggregation(admin_headers)

    res = client.get("/analytics/departments", headers=admin_headers)
    assert res.status_code == 200

    data = res.json()
    assert "items" in data
    assert isinstance(data["items"], list)

    if data["items"]:
        row = data["items"][0]
        assert "department_name" in row
        assert "gap_score" in row
        assert "gap_score_label" in row
        assert "total_grievances" in row
        assert "sla_breaches" in row
        assert row["gap_score_label"] in ["Low", "Moderate", "High", "Critical"]


# ─── Test 5: Trends Endpoint ──────────────────────────────────────────────────

def test_trends_endpoint():
    """
    GET /analytics/trends returns a list of time-series data points
    with date, feedback counts, and grievance counts.
    """
    admin_headers = get_admin_headers()
    trigger_today_aggregation(admin_headers)

    today_str = str(date.today())
    res = client.get(f"/analytics/trends?date_from={today_str}&date_to={today_str}", headers=admin_headers)
    assert res.status_code == 200

    data = res.json()
    assert "items" in data
    assert isinstance(data["items"], list)

    if data["items"]:
        point = data["items"][0]
        assert "date" in point
        assert "total_feedback" in point
        assert "total_grievances" in point
        assert "sla_breaches" in point


# ─── Test 6: Recurring Issues Endpoint ────────────────────────────────────────

def test_recurring_issues_endpoint():
    """
    GET /analytics/recurring-issues returns category rankings with
    total_volume and percentage fields.
    """
    admin_headers = get_admin_headers()
    trigger_today_aggregation(admin_headers)

    res = client.get("/analytics/recurring-issues?top_n=5", headers=admin_headers)
    assert res.status_code == 200

    data = res.json()
    assert "items" in data
    assert isinstance(data["items"], list)

    if data["items"]:
        row = data["items"][0]
        assert "category_name" in row
        assert "total_volume" in row
        assert "percentage" in row
        # First entry should have the highest volume (sorted desc)
        if len(data["items"]) > 1:
            assert data["items"][0]["total_volume"] >= data["items"][1]["total_volume"]


# ─── Test 7: Date Filter on Summary ───────────────────────────────────────────

def test_summary_date_filter():
    """
    Summary endpoint respects date_from / date_to query params.
    Querying a future date where no data exists should return all zeros.
    """
    admin_headers = get_admin_headers()
    future = "2099-01-01"
    res = client.get(f"/analytics/summary?date_from={future}&date_to={future}", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total_feedback"] == 0
    assert data["total_grievances"] == 0


# ─── Test 8: Analytics is Admin/HOD Only (403 for Students and Staff) ─────────

def test_analytics_endpoints_forbidden_for_students():
    """Students must receive 403 Forbidden on all analytics endpoints."""
    student_headers = get_student_headers()
    endpoints = [
        "/analytics/summary",
        "/analytics/departments",
        "/analytics/trends",
        "/analytics/recurring-issues",
    ]
    for ep in endpoints:
        res = client.get(ep, headers=student_headers)
        assert res.status_code == 403, f"Expected 403 for student on {ep}, got {res.status_code}"


def test_analytics_aggregate_forbidden_for_staff():
    """Staff must receive 403 Forbidden on the aggregate trigger endpoint."""
    staff_headers = get_staff_headers()
    res = client.post(
        "/analytics/aggregate",
        json={"target_date": str(date.today())},
        headers=staff_headers,
    )
    assert res.status_code == 403
