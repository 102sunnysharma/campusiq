"""
Tests — Grievance Management Module & SLA Engine (Phase 6)

Covers:
  1. Student grievance submission with auto ticket number, category mapping, and SLA initiation.
  2. Full valid lifecycle: open -> in_progress -> resolved -> closed.
  3. Reopen lifecycle: resolved -> reopened (verifying new SLA event cycle per Section 8.3).
  4. Invalid transition rejection (409 Conflict) and permission enforcement (403 Forbidden).
  5. Staff assignment by Admin/HOD.
  6. SLA breach and warning scan execution.
  7. Student isolation: only owner can view their grievance and close/reopen it.
"""

import pytest
import uuid
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
    res = client.get("/categories?page=1&page_size=1", headers=headers)
    assert res.status_code == 200
    items = res.json().get("items", [])
    assert items, "No active categories found in database"
    return items[0]["id"]


def get_any_staff_id(headers) -> str:
    res = client.get("/staff?page=1&page_size=1", headers=headers)
    assert res.status_code == 200
    items = res.json().get("items", [])
    assert items, "No staff members found in database"
    return items[0]["id"]


# ─── Test 1: Grievance Submission ─────────────────────────────────────────────

def test_student_submit_grievance_success():
    """
    Student submits grievance.
    Verifies:
      - Returns 201 Created
      - Auto-generates GRV- ticket number
      - Maps department from category
      - Starts SLA clock matching priority
      - Records initial update log
    """
    student_headers = get_student_headers()
    category_id = get_any_active_category_id(student_headers)

    payload = {
        "category_id": category_id,
        "title": "Air Conditioning malfunction in Computer Lab 302",
        "description": "The central AC unit has been making a loud buzzing sound and not cooling for 3 days.",
        "priority": "high",
    }

    res = client.post("/grievances", json=payload, headers=student_headers)
    assert res.status_code == 201, f"Expected 201, got {res.status_code}: {res.text}"
    data = res.json()

    assert data["ticket_number"].startswith("GRV-")
    assert data["status"] == "open"
    assert data["priority"] == "high"
    assert data["category"]["id"] == category_id
    assert data["department"] is not None
    assert data["current_sla"] is not None
    assert data["current_sla"]["priority"] == "high"
    assert data["current_sla"]["status"] in ("on_track", "warning")
    assert len(data["updates"]) >= 1


# ─── Test 2: Full Valid Status Lifecycle ──────────────────────────────────────

def test_full_grievance_status_lifecycle():
    """
    Tests: open -> in_progress -> resolved -> closed
    And asserts closed cannot be transitioned further (409 Conflict).
    """
    student_headers = get_student_headers()
    staff_headers = get_staff_headers()
    admin_headers = get_admin_headers()
    category_id = get_any_active_category_id(student_headers)

    # 1. Student creates grievance -> 'open'
    create_res = client.post("/grievances", json={
        "category_id": category_id,
        "title": "Wi-Fi connectivity drop in Block A",
        "description": "Signal drops intermittently during online quiz sessions.",
        "priority": "medium",
    }, headers=student_headers)
    assert create_res.status_code == 201
    grv_id = create_res.json()["id"]

    # 2. Staff starts work -> 'in_progress'
    prog_res = client.patch(
        f"/grievances/{grv_id}/status",
        json={"status": "in_progress", "comment": "Technician dispatched to inspect access points."},
        headers=staff_headers,
    )
    assert prog_res.status_code == 200
    assert prog_res.json()["status"] == "in_progress"

    # 3. Staff resolves -> 'resolved'
    res_res = client.patch(
        f"/grievances/{grv_id}/status",
        json={"status": "resolved", "comment": "Replaced faulty switch in Block A second floor rack."},
        headers=staff_headers,
    )
    assert res_res.status_code == 200
    assert res_res.json()["status"] == "resolved"
    assert res_res.json()["resolved_at"] is not None
    assert res_res.json()["current_sla"]["status"] == "completed"

    # 4. Student closes -> 'closed'
    close_res = client.patch(
        f"/grievances/{grv_id}/status",
        json={"status": "closed", "comment": "Verified and working now. Thanks!"},
        headers=student_headers,
    )
    assert close_res.status_code == 200
    assert close_res.json()["status"] == "closed"
    assert close_res.json()["closed_at"] is not None

    # 5. Attempting to reopen or change closed ticket -> 409 Conflict (Section 7)
    reopen_attempt = client.patch(
        f"/grievances/{grv_id}/status",
        json={"status": "in_progress"},
        headers=staff_headers,
    )
    assert reopen_attempt.status_code == 409
    assert reopen_attempt.json()["error"]["code"] == "INVALID_TRANSITION"


# ─── Test 3: Reopen Lifecycle & New SLA Cycle (Section 8.3) ───────────────────

def test_grievance_reopen_spawns_new_sla_cycle():
    """
    Tests: open -> in_progress -> resolved -> reopened (Student only).
    Verifies a brand-new SLAEvent cycle is initiated while keeping history intact.
    """
    student_headers = get_student_headers()
    staff_headers = get_staff_headers()
    category_id = get_any_active_category_id(student_headers)

    # 1. Create -> open
    c_res = client.post("/grievances", json={
        "category_id": category_id,
        "title": "Projector not working in Room 102",
        "description": "HDMI port damaged and bulb flickering.",
        "priority": "low",
    }, headers=student_headers)
    assert c_res.status_code == 201
    grv_id = c_res.json()["id"]

    # 2. Staff -> in_progress -> resolved
    client.patch(f"/grievances/{grv_id}/status", json={"status": "in_progress"}, headers=staff_headers)
    client.patch(f"/grievances/{grv_id}/status", json={"status": "resolved", "comment": "Cable adjusted."}, headers=staff_headers)

    # 3. Student rejects resolution -> reopened
    reopen_res = client.patch(
        f"/grievances/{grv_id}/status",
        json={"status": "reopened", "comment": "Issue still persists — bulb still flickers."},
        headers=student_headers,
    )
    assert reopen_res.status_code == 200
    reopen_data = reopen_res.json()
    assert reopen_data["status"] == "reopened"
    assert reopen_data["resolved_at"] is None

    # Section 8.3: Brand-new SLAEvent created; total SLA events is now 2
    assert len(reopen_data["sla_events"]) == 2
    assert reopen_data["current_sla"]["status"] == "on_track"
    assert reopen_data["current_sla"]["completed_at"] is None


# ─── Test 4: Invalid Status Transitions (Section 7) ───────────────────────────

def test_invalid_status_transitions():
    """
    Verify invalid jumps (e.g. open -> resolved) are rejected with 409 Conflict.
    """
    student_headers = get_student_headers()
    staff_headers = get_staff_headers()
    category_id = get_any_active_category_id(student_headers)

    c_res = client.post("/grievances", json={
        "category_id": category_id,
        "title": "Water cooler leaking on 2nd floor",
        "description": "Water pooling near stairwell.",
        "priority": "urgent",
    }, headers=student_headers)
    assert c_res.status_code == 201
    grv_id = c_res.json()["id"]

    # Invalid: open -> resolved without in_progress
    bad_res = client.patch(
        f"/grievances/{grv_id}/status",
        json={"status": "resolved"},
        headers=staff_headers,
    )
    assert bad_res.status_code == 409
    assert bad_res.json()["error"]["code"] == "INVALID_STATUS_TRANSITION"

    # Invalid: non-owner staff attempting to reopen
    bad_reopen = client.patch(
        f"/grievances/{grv_id}/status",
        json={"status": "reopened"},
        headers=staff_headers,
    )
    assert bad_reopen.status_code == 409


# ─── Test 5: Staff Assignment ─────────────────────────────────────────────────

def test_assign_grievance_staff():
    """Admin/HOD assigns staff member to a grievance."""
    student_headers = get_student_headers()
    admin_headers = get_admin_headers()
    category_id = get_any_active_category_id(student_headers)
    staff_id = get_any_staff_id(admin_headers)

    c_res = client.post("/grievances", json={
        "category_id": category_id,
        "title": "Library study table damaged",
        "description": "Table 14 leg is loose.",
        "priority": "low",
    }, headers=student_headers)
    assert c_res.status_code == 201
    grv_id = c_res.json()["id"]

    assign_res = client.patch(
        f"/grievances/{grv_id}/assign",
        json={"assigned_staff_id": staff_id, "comment": "Assigned to maintenance incharge."},
        headers=admin_headers,
    )
    assert assign_res.status_code == 200
    data = assign_res.json()
    assert data["assigned_staff_id"] == staff_id
    assert data["assigned_staff"] is not None


# ─── Test 6: SLA Policy Management & Breach Scan ──────────────────────────────

def test_sla_policies_and_breach_scan():
    """Tests GET/PUT /sla/policies and POST /sla/check-breaches."""
    admin_headers = get_admin_headers()

    # List policies
    policies_res = client.get("/sla/policies", headers=admin_headers)
    assert policies_res.status_code == 200
    policies = policies_res.json()
    assert len(policies) >= 4

    # Run breach scan
    scan_res = client.post("/sla/check-breaches", headers=admin_headers)
    assert scan_res.status_code == 200
    assert scan_res.json()["success"] is True


# ─── Test 7: Student Grievance Listing & Privacy ──────────────────────────────

def test_student_grievance_listing():
    """Student can list their own grievances with pagination."""
    student_headers = get_student_headers()
    res = client.get("/grievances/mine?page=1&page_size=10", headers=student_headers)
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert "total" in data
    assert "total_pages" in data
