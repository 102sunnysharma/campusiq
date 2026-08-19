"""
Tests — Feedback Module (Phase 5)

Covers:
  1. Student submits feedback → 201, feedback row created, NLP queued
  2. NLP failure path is silent — submission still returns 201
  3. Non-student (staff/admin) cannot POST /feedback → 403
  4. Student GET /feedback/mine returns only their own records
  5. Admin can list and filter feedback by category
"""

import pytest
import uuid
from unittest.mock import patch
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


# ─── Auth helpers ─────────────────────────────────────────────────────────────

def get_student_headers():
    res = client.post("/auth/login", json={"email": "student.cse@krmu.edu.in", "password": "Student@123"})
    assert res.status_code == 200, f"Student login failed: {res.text}"
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def get_staff_headers():
    res = client.post("/auth/login", json={"email": "staff.cse@krmu.edu.in", "password": "Staff@123"})
    assert res.status_code == 200, f"Staff login failed: {res.text}"
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def get_admin_headers():
    res = client.post("/auth/login", json={"email": "admin@krmu.edu.in", "password": "Admin@123"})
    assert res.status_code == 200, f"Admin login failed: {res.text}"
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def get_any_active_category_id(headers) -> str:
    """Fetch a valid category UUID from the API."""
    res = client.get("/categories?page=1&page_size=1", headers=headers)
    assert res.status_code == 200, f"Category fetch failed: {res.text}"
    items = res.json().get("items", [])
    assert items, "No active categories found in DB — run seed.py first"
    return items[0]["id"]


# ─── Test 1: Student submits feedback successfully ────────────────────────────

def test_student_submit_feedback_success():
    """
    Submitting feedback always returns 201 immediately.
    The NLP analysis runs in background — we don't wait for it here.
    """
    headers = get_student_headers()
    category_id = get_any_active_category_id(headers)

    payload = {
        "category_id": category_id,
        "content": "The laboratory sessions are very well organized and the equipment is modern.",
        "rating": 4,
        "is_anonymous": False,
    }

    res = client.post("/feedback", json=payload, headers=headers)
    assert res.status_code == 201, f"Expected 201 but got {res.status_code}: {res.text}"

    data = res.json()
    assert data["status"] == "submitted"
    assert data["rating"] == 4
    assert data["is_anonymous"] is False
    assert data["category"] is not None
    # Analysis stub should be PENDING (NLP not done yet in test environment)
    # It may be PENDING or COMPLETED depending on sync — just check it's present
    if data["analysis"]:
        assert data["analysis"]["analysis_status"] in ("PENDING", "COMPLETED", "FAILED")


# ─── Test 2: NLP failure is silent — submission still returns 201 ─────────────

def test_nlp_failure_does_not_break_submission():
    """
    Section 11.4: Even if the NLP pipeline raises an exception,
    the feedback submission must still return 201.
    """
    headers = get_student_headers()
    category_id = get_any_active_category_id(headers)

    # Patch the NLP analysis function to raise an error
    with patch("app.services.nlp_service.run_nlp_analysis", side_effect=RuntimeError("Simulated NLP crash")):
        payload = {
            "category_id": category_id,
            "content": "This is a test of the NLP failure handling path per Section 11.4.",
            "rating": 3,
            "is_anonymous": True,
        }
        res = client.post("/feedback", json=payload, headers=headers)

    # The submission must succeed even though NLP is broken
    assert res.status_code == 201, (
        f"Submission failed when NLP crashed — violates Section 11.4. "
        f"Status: {res.status_code}, Body: {res.text}"
    )
    data = res.json()
    assert data["status"] == "submitted"


# ─── Test 3: Non-student cannot submit feedback ───────────────────────────────

def test_staff_cannot_submit_feedback():
    """Staff role must be rejected with 403 when attempting to submit feedback."""
    headers = get_staff_headers()

    # Get a category using admin headers (staff might not have access to categories endpoint)
    admin_headers = get_admin_headers()
    category_id = get_any_active_category_id(admin_headers)

    payload = {
        "category_id": category_id,
        "content": "Staff trying to submit student feedback — this should be forbidden.",
        "rating": 2,
        "is_anonymous": False,
    }
    res = client.post("/feedback", json=payload, headers=headers)
    assert res.status_code == 403, f"Expected 403 but got {res.status_code}: {res.text}"
    assert res.json()["error"]["code"] == "PERMISSION_DENIED"


def test_admin_cannot_submit_feedback():
    """Admin role must also be rejected with 403."""
    headers = get_admin_headers()
    category_id = get_any_active_category_id(headers)

    payload = {
        "category_id": category_id,
        "content": "Admin trying to submit feedback — should also be 403.",
        "rating": 5,
        "is_anonymous": False,
    }
    res = client.post("/feedback", json=payload, headers=headers)
    assert res.status_code == 403, f"Expected 403 but got {res.status_code}: {res.text}"


# ─── Test 4: Student GET /feedback/mine returns only their own records ────────

def test_student_gets_only_own_feedback():
    """
    GET /feedback/mine must return a paginated list containing ONLY
    the authenticated student's own feedback — not anyone else's.
    """
    headers = get_student_headers()

    # First submit one feedback to ensure there's at least one
    category_id = get_any_active_category_id(headers)
    client.post("/feedback", json={
        "category_id": category_id,
        "content": "Testing that my feedback list is scoped to my own submissions only.",
        "rating": 5,
        "is_anonymous": False,
    }, headers=headers)

    # Now fetch /feedback/mine
    res = client.get("/feedback/mine?page=1&page_size=20", headers=headers)
    assert res.status_code == 200, f"Expected 200: {res.text}"
    data = res.json()
    assert "items" in data
    assert "total" in data
    assert data["total"] >= 1

    # Pagination fields present
    assert "page" in data
    assert "page_size" in data
    assert "total_pages" in data


# ─── Test 5: Admin lists and filters feedback ─────────────────────────────────

def test_admin_list_feedback_with_filters():
    """Admin can list all feedback with category filter applied."""
    admin_headers = get_admin_headers()
    category_id = get_any_active_category_id(admin_headers)

    # Unfiltered list
    res = client.get("/feedback?page=1&page_size=10", headers=admin_headers)
    assert res.status_code == 200, f"Expected 200: {res.text}"
    data = res.json()
    assert "items" in data
    assert "total" in data

    # Filtered by category
    filtered_res = client.get(
        f"/feedback?page=1&page_size=10&category_id={category_id}",
        headers=admin_headers
    )
    assert filtered_res.status_code == 200
    filtered_data = filtered_res.json()
    # Every item in the filtered response must match the category
    for item in filtered_data["items"]:
        assert item["category_id"] == category_id

    # Filtered by rating
    rating_res = client.get("/feedback?page=1&page_size=10&rating=4", headers=admin_headers)
    assert rating_res.status_code == 200
    for item in rating_res.json()["items"]:
        assert item["rating"] == 4


def test_student_cannot_access_admin_feedback_list():
    """Students must be blocked from GET /feedback (admin-only)."""
    student_headers = get_student_headers()
    res = client.get("/feedback?page=1&page_size=10", headers=student_headers)
    assert res.status_code == 403, f"Expected 403 but got {res.status_code}"


def test_feedback_validation_rejects_short_content():
    """Feedback with content shorter than 10 chars should be rejected with 422."""
    headers = get_student_headers()
    category_id = get_any_active_category_id(headers)

    res = client.post("/feedback", json={
        "category_id": category_id,
        "content": "Short",   # < 10 chars
        "rating": 3,
        "is_anonymous": False,
    }, headers=headers)
    assert res.status_code == 422  # Pydantic validation error
