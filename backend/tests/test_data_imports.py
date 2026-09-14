"""
Tests — Data Import Module (Phase 9, Section 10 & 13)

Covers:
  1. Template download for all 5 supported data types (and rejection of invalid types).
  2. Upload & validation for valid CSV/Excel data.
  3. Upload with mixed valid and invalid rows (fault-tolerance: valid accepted, invalid skipped with reasons).
  4. Confirm import commits valid rows to target tables (Feedback, Transport, Facility).
  5. Error reporting in data_imports table.
  6. Idempotency / state guard: already completed import cannot be re-confirmed (409 Conflict).
  7. History listing with pagination (Section 14.3) and detailed report by ID.
  8. Strict RBAC: only Admin allowed; Student, Staff, and HOD receive 403 Forbidden.
"""

import io
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


# ─── Auth Helpers ─────────────────────────────────────────────────────────────

def get_admin_headers():
    res = client.post("/auth/login", json={"email": "admin@krmu.edu.in", "password": "Admin@123"})
    assert res.status_code == 200, f"Admin login failed: {res.text}"
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def get_hod_headers():
    res = client.post("/auth/login", json={"email": "hod.cse@krmu.edu.in", "password": "Hod@123"})
    assert res.status_code == 200, f"HOD login failed: {res.text}"
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def get_staff_headers():
    res = client.post("/auth/login", json={"email": "staff.cse@krmu.edu.in", "password": "Staff@123"})
    assert res.status_code == 200, f"Staff login failed: {res.text}"
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def get_student_headers():
    res = client.post("/auth/login", json={"email": "student.cse@krmu.edu.in", "password": "Student@123"})
    assert res.status_code == 200, f"Student login failed: {res.text}"
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


# ─── Test 1: Templates Download ───────────────────────────────────────────────

def test_template_download_all_5_types():
    """Admin can download CSV templates for all 5 supported types."""
    headers = get_admin_headers()
    types = ["attendance", "exam_schedule", "facility_usage", "feedback", "transport"]

    for dt in types:
        res = client.get(f"/data-imports/templates/{dt}", headers=headers)
        assert res.status_code == 200
        assert "text/csv" in res.headers.get("content-type", "")
        assert len(res.text) > 20

    # Invalid data type returns 400
    res = client.get("/data-imports/templates/unknown_type", headers=headers)
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "INVALID_DATA_TYPE"


# ─── Test 2: Upload Mixed Feedback CSV (Fault Tolerance) ───────────────────────

def test_upload_mixed_feedback_csv():
    """
    Uploading a file with some invalid rows should flag the invalid rows with exact reasons,
    while marking the valid rows as ready for import.
    """
    headers = get_admin_headers()

    csv_content = (
        "roll_number,category_name,rating,content,is_anonymous\n"
        "KRMU2026-CSE-001,Hostel Maintenance & Mess,5,Valid feedback on hostel water coolers,false\n"
        "NONEXISTENT999,Hostel Maintenance & Mess,4,Invalid student roll number,false\n"
        "KRMU2026-CSE-001,Nonexistent Category,4,Invalid category name,false\n"
        "KRMU2026-CSE-001,Hostel Maintenance & Mess,10,Rating out of range,false\n"
    )

    files = {"file": ("test_feedback.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
    data = {"data_type": "feedback"}

    res = client.post("/data-imports/upload", files=files, data=data, headers=headers)
    assert res.status_code == 200
    res_data = res.json()

    assert res_data["data_type"] == "feedback"
    assert res_data["status"] == "preview_ready"
    assert res_data["total_records"] == 4
    assert res_data["valid_records_count"] == 1
    assert res_data["invalid_records_count"] == 3

    # Check error reasons
    errors = res_data["errors"]
    assert len(errors) == 3
    reasons_flat = " ".join([r for err in errors for r in err["reasons"]])
    assert "Student 'NONEXISTENT999' not found" in reasons_flat
    assert "Category 'Nonexistent Category' not found" in reasons_flat
    assert "Rating '10' must be an integer between 1 and 5" in reasons_flat


# ─── Test 3: Confirm Import and Verify Insertion ──────────────────────────────

def test_confirm_feedback_import():
    """
    Confirming an import in 'preview_ready' status commits the valid rows and
    marks the import as 'completed'.
    """
    headers = get_admin_headers()

    csv_content = (
        "roll_number,category_name,rating,content,is_anonymous\n"
        "KRMU2026-CSE-001,Hostel Maintenance & Mess,4,Imported test feedback row 1,false\n"
        "BAD_STUDENT,Hostel Maintenance & Mess,3,Rejected feedback row,false\n"
    )
    files = {"file": ("confirm_test.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
    data = {"data_type": "feedback"}

    # Upload
    upload_res = client.post("/data-imports/upload", files=files, data=data, headers=headers)
    assert upload_res.status_code == 200
    import_id = upload_res.json()["import_id"]

    # Confirm
    confirm_res = client.post(f"/data-imports/{import_id}/confirm", headers=headers)
    assert confirm_res.status_code == 200
    c_data = confirm_res.json()

    assert c_data["status"] == "completed"
    assert c_data["successful_records"] == 1
    assert c_data["failed_records"] == 1
    assert c_data["total_records"] == 2

    # Verify cannot re-confirm already completed import (409 Conflict)
    second_confirm = client.post(f"/data-imports/{import_id}/confirm", headers=headers)
    assert second_confirm.status_code == 409


# ─── Test 4: Transport Import (Route & Stops) ─────────────────────────────────

def test_transport_import_creates_route_and_stops():
    """
    Transport import should create the TransportRoute and associated TransportStops.
    """
    headers = get_admin_headers()
    route_no = "R-999"

    csv_content = (
        "route_number,route_name,stop_name,latitude,longitude,sequence,description\n"
        f"{route_no},Test Express Line,Sector 14,28.4500,77.0200,1,Starting point\n"
        f"{route_no},Test Express Line,Sector 29,28.4600,77.0300,2,Intermediate stop\n"
        f"{route_no},Test Express Line,Bad Stop,999.0,77.0400,3,Invalid latitude\n"
    )
    files = {"file": ("transport_test.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
    data = {"data_type": "transport"}

    upload_res = client.post("/data-imports/upload", files=files, data=data, headers=headers)
    assert upload_res.status_code == 200
    u_data = upload_res.json()
    assert u_data["valid_records_count"] == 2
    assert u_data["invalid_records_count"] == 1

    # Confirm
    import_id = u_data["import_id"]
    confirm_res = client.post(f"/data-imports/{import_id}/confirm", headers=headers)
    assert confirm_res.status_code == 200
    assert confirm_res.json()["successful_records"] == 2


# ─── Test 5: Facility Usage Import ────────────────────────────────────────────

def test_facility_import():
    """
    Facility usage import should validate department foreign keys and upsert facilities.
    """
    headers = get_admin_headers()

    csv_content = (
        "facility_name,department_code,type,location,capacity\n"
        "Robotics Innovation Lab,CSE,Lab,Block B 2nd Floor,40\n"
        "Invalid Dept Lab,XYZ_FAKE,Lab,Block B 1st Floor,30\n"
    )
    files = {"file": ("facilities_test.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
    data = {"data_type": "facility_usage"}

    upload_res = client.post("/data-imports/upload", files=files, data=data, headers=headers)
    assert upload_res.status_code == 200
    u_data = upload_res.json()
    assert u_data["valid_records_count"] == 1
    assert u_data["invalid_records_count"] == 1

    confirm_res = client.post(f"/data-imports/{u_data['import_id']}/confirm", headers=headers)
    assert confirm_res.status_code == 200
    assert confirm_res.json()["successful_records"] == 1


# ─── Test 6: Attendance & Exam Schedule Import ────────────────────────────────

def test_attendance_and_exam_schedule_import():
    """
    Attendance and Exam Schedule imports validate student/department keys and record runs.
    """
    headers = get_admin_headers()

    # Attendance
    att_csv = (
        "roll_number,department_code,course_name,date,status\n"
        "KRMU2026-CSE-001,CSE,Computer Networks,2026-09-10,Present\n"
    )
    files = {"file": ("att.csv", io.BytesIO(att_csv.encode("utf-8")), "text/csv")}
    res = client.post("/data-imports/upload", files=files, data={"data_type": "attendance"}, headers=headers)
    assert res.status_code == 200
    c_res = client.post(f"/data-imports/{res.json()['import_id']}/confirm", headers=headers)
    assert c_res.status_code == 200
    assert c_res.json()["successful_records"] == 1

    # Exam Schedule
    exam_csv = (
        "department_code,course_name,exam_date,start_time,end_time,room\n"
        "CSE,Operating Systems,2026-11-20,09:30,12:30,LH-102\n"
    )
    files2 = {"file": ("exam.csv", io.BytesIO(exam_csv.encode("utf-8")), "text/csv")}
    res2 = client.post("/data-imports/upload", files=files2, data={"data_type": "exam_schedule"}, headers=headers)
    assert res2.status_code == 200
    c_res2 = client.post(f"/data-imports/{res2.json()['import_id']}/confirm", headers=headers)
    assert c_res2.status_code == 200
    assert c_res2.json()["successful_records"] == 1


# ─── Test 7: History List and Detail Endpoint ─────────────────────────────────

def test_import_history_and_detail():
    """
    Admin can list past imports with standard pagination and inspect a single run.
    """
    headers = get_admin_headers()

    list_res = client.get("/data-imports?page=1&page_size=10", headers=headers)
    assert list_res.status_code == 200
    data = list_res.json()
    assert "items" in data
    assert "total" in data
    assert "page" in data
    assert data["page"] == 1
    assert isinstance(data["items"], list)
    assert len(data["items"]) > 0

    # Fetch detail of first item
    first_id = data["items"][0]["id"]
    detail_res = client.get(f"/data-imports/{first_id}", headers=headers)
    assert detail_res.status_code == 200
    d_data = detail_res.json()
    assert d_data["id"] == first_id
    assert "error_report" in d_data


# ─── Test 8: RBAC Protection (Admin Only) ─────────────────────────────────────

def test_data_imports_rbac_forbidden():
    """
    Non-admin users (Student, Staff, HOD) are rejected with 403 Forbidden.
    """
    non_admin_headers = [
        ("Student", get_student_headers()),
        ("Staff", get_staff_headers()),
        ("HOD", get_hod_headers()),
    ]

    for role_name, headers in non_admin_headers:
        # GET /data-imports
        res1 = client.get("/data-imports", headers=headers)
        assert res1.status_code == 403, f"{role_name} expected 403 on GET /data-imports, got {res1.status_code}"

        # GET /data-imports/templates/feedback
        res2 = client.get("/data-imports/templates/feedback", headers=headers)
        assert res2.status_code == 403, f"{role_name} expected 403 on templates, got {res2.status_code}"

        # POST /data-imports/upload
        csv_dummy = "a,b\n1,2\n"
        files = {"file": ("dummy.csv", io.BytesIO(csv_dummy.encode("utf-8")), "text/csv")}
        res3 = client.post("/data-imports/upload", files=files, data={"data_type": "feedback"}, headers=headers)
        assert res3.status_code == 403, f"{role_name} expected 403 on upload, got {res3.status_code}"
