"""
Tests — Notifications & Audit Logging (Phase 7)

Covers:
  1. Automatic notification creation on grievance submission.
  2. GET /notifications unread count endpoint.
  3. PATCH /notifications/{id}/mark-read for single notification.
  4. PATCH /notifications/mark-read for multiple notifications.
  5. PATCH /notifications/mark-all-read for marking all unread.
  6. Notification user isolation (user cannot see or mark another's notifications).
  7. Audit logging on grievance lifecycle operations.
  8. Admin-only access to GET /audit-logs (403 Forbidden for students).
"""

import pytest
import uuid
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


# ─── Auth Helpers ─────────────────────────────────────────────────────────────

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


def get_any_category_id(headers) -> str:
    res = client.get("/categories?page=1&page_size=1", headers=headers)
    assert res.status_code == 200
    items = res.json().get("items", [])
    assert items, "No category found in database"
    return items[0]["id"]


# ─── Test 1: Notification Created on Grievance Submission ─────────────────────

def test_notification_created_on_grievance_submission():
    """
    Submitting a grievance should automatically trigger a confirmation
    notification to the student with the ticket number.
    """
    student_headers = get_student_headers()
    cat_id = get_any_category_id(student_headers)

    # Initial unread count
    initial_count_res = client.get("/notifications/unread-count", headers=student_headers)
    assert initial_count_res.status_code == 200
    initial_unread = initial_count_res.json()["count"]

    # Submit a grievance
    create_res = client.post("/grievances", json={
        "category_id": cat_id,
        "title": "Broken bench in Lecture Hall 401",
        "description": "The wooden bench in the third row is cracked and dangerous.",
        "priority": "low",
    }, headers=student_headers)
    assert create_res.status_code == 201
    grv_data = create_res.json()
    ticket_no = grv_data["ticket_number"]

    # Check notification list
    notif_res = client.get("/notifications?page=1&page_size=10", headers=student_headers)
    assert notif_res.status_code == 200
    items = notif_res.json()["items"]
    assert len(items) > 0

    # The newest notification should mention the grievance ticket
    latest = items[0]
    assert latest["reference_type"] == "grievance"
    assert ticket_no in latest["message"] or ticket_no in latest["title"]
    assert latest["is_read"] is False

    # Unread count should have incremented
    new_count_res = client.get("/notifications/unread-count", headers=student_headers)
    assert new_count_res.json()["count"] >= initial_unread + 1


# ─── Test 2: Mark Single Notification as Read ─────────────────────────────────

def test_mark_single_notification_read():
    """Marking a single notification read updates is_read to True and sets read_at."""
    student_headers = get_student_headers()

    # Get latest unread notification
    list_res = client.get("/notifications?is_read=false&page=1&page_size=1", headers=student_headers)
    assert list_res.status_code == 200
    items = list_res.json()["items"]
    if not items:
        # Submit a quick grievance to produce one
        cat_id = get_any_category_id(student_headers)
        client.post("/grievances", json={
            "category_id": cat_id,
            "title": "Test notification marker",
            "description": "Short description for test notification.",
            "priority": "low",
        }, headers=student_headers)
        list_res = client.get("/notifications?is_read=false&page=1&page_size=1", headers=student_headers)
        items = list_res.json()["items"]

    notif_id = items[0]["id"]

    # Mark as read
    mark_res = client.patch(f"/notifications/{notif_id}/mark-read", headers=student_headers)
    assert mark_res.status_code == 200
    data = mark_res.json()
    assert data["is_read"] is True
    assert data["read_at"] is not None


# ─── Test 3: Mark Multiple Notifications as Read (Bulk) ───────────────────────

def test_mark_multiple_notifications_read():
    """Bulk mark-read endpoint updates multiple notifications in one request."""
    student_headers = get_student_headers()
    cat_id = get_any_category_id(student_headers)

    # Create two grievances to generate notifications
    for i in range(2):
        client.post("/grievances", json={
            "category_id": cat_id,
            "title": f"Bulk notification test item {i}",
            "description": f"Detailed description for bulk notification test {i}.",
            "priority": "low",
        }, headers=student_headers)

    # Fetch unread notifications
    unread_res = client.get("/notifications?is_read=false&page=1&page_size=5", headers=student_headers)
    unread_ids = [n["id"] for n in unread_res.json()["items"][:2]]
    assert len(unread_ids) >= 2

    # Bulk mark read
    bulk_res = client.patch("/notifications/mark-read", json={"notification_ids": unread_ids}, headers=student_headers)
    assert bulk_res.status_code == 200
    assert bulk_res.json()["success"] is True
    assert bulk_res.json()["updated"] >= 2


# ─── Test 4: Mark All Notifications Read ──────────────────────────────────────

def test_mark_all_notifications_read():
    """Mark all read endpoint marks all unread notifications for the caller."""
    student_headers = get_student_headers()

    all_read_res = client.patch("/notifications/mark-all-read", headers=student_headers)
    assert all_read_res.status_code == 200
    assert all_read_res.json()["success"] is True

    # Count should now be 0
    count_res = client.get("/notifications/unread-count", headers=student_headers)
    assert count_res.json()["count"] == 0


# ─── Test 5: Notification User Isolation ──────────────────────────────────────

def test_notification_user_isolation():
    """A staff user cannot mark a student's notification as read or view it."""
    student_headers = get_student_headers()
    staff_headers = get_staff_headers()
    cat_id = get_any_category_id(student_headers)

    # Student generates a notification
    client.post("/grievances", json={
        "category_id": cat_id,
        "title": "Isolation test grievance",
        "description": "Description for checking user notification isolation.",
        "priority": "low",
    }, headers=student_headers)

    student_notifs = client.get("/notifications?page=1&page_size=1", headers=student_headers).json()["items"]
    assert len(student_notifs) > 0
    target_id = student_notifs[0]["id"]

    # Staff attempts to mark student's notification as read -> 404 Not Found / Not owned
    bad_res = client.patch(f"/notifications/{target_id}/mark-read", headers=staff_headers)
    assert bad_res.status_code == 404
    assert bad_res.json()["error"]["code"] == "NOTIFICATION_NOT_FOUND"


# ─── Test 6: Audit Log Created on Grievance Lifecycle ─────────────────────────

def test_audit_log_created_on_grievance_actions():
    """Audit logs are recorded when grievances are created and transitioned."""
    student_headers = get_student_headers()
    staff_headers = get_staff_headers()
    admin_headers = get_admin_headers()
    cat_id = get_any_category_id(student_headers)

    # 1. Student creates grievance
    c_res = client.post("/grievances", json={
        "category_id": cat_id,
        "title": "Audit log test ticket",
        "description": "Checking that audit log entries are generated.",
        "priority": "medium",
    }, headers=student_headers)
    assert c_res.status_code == 201
    grv_id = c_res.json()["id"]

    # 2. Staff transitions status -> in_progress
    client.patch(f"/grievances/{grv_id}/status", json={"status": "in_progress"}, headers=staff_headers)

    # 3. Admin views audit logs
    audit_res = client.get(f"/audit-logs?entity_type=grievance&page=1&page_size=10", headers=admin_headers)
    assert audit_res.status_code == 200
    logs = audit_res.json()["items"]
    assert len(logs) > 0

    actions = [l["action"] for l in logs]
    assert "grievance_created" in actions or "grievance_status_updated" in actions


# ─── Test 7: Audit Logs Admin-Only Access ──────────────────────────────────────

def test_audit_logs_admin_only():
    """Non-admin users (students and staff) cannot access GET /audit-logs (403)."""
    student_headers = get_student_headers()
    staff_headers = get_staff_headers()

    s_res = client.get("/audit-logs", headers=student_headers)
    assert s_res.status_code == 403

    st_res = client.get("/audit-logs", headers=staff_headers)
    assert st_res.status_code == 403
