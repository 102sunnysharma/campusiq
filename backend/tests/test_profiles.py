import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def get_student_headers():
    res = client.post("/auth/login", json={"email": "student.cse@krmu.edu.in", "password": "Student@123"})
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def get_staff_headers():
    res = client.post("/auth/login", json={"email": "staff.cse@krmu.edu.in", "password": "Staff@123"})
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def get_admin_headers():
    res = client.post("/auth/login", json={"email": "admin@krmu.edu.in", "password": "Admin@123"})
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def test_get_and_update_my_student_profile():
    headers = get_student_headers()

    # 1. Get profile
    get_res = client.get("/students/me", headers=headers)
    assert get_res.status_code == 200
    data = get_res.json()
    assert data["student_id"] == "KRMU2026-CSE-001"
    assert data["course_name"] == "Computer Science Engineering"

    # 2. Update profile
    update_res = client.put("/students/me", json={
        "roll_number": "2026CSE001-UPDATED",
        "semester": 7,
        "room_number": "304-B"
    }, headers=headers)
    assert update_res.status_code == 200
    up_data = update_res.json()
    assert up_data["roll_number"] == "2026CSE001-UPDATED"
    assert up_data["semester"] == 7
    assert up_data["room_number"] == "304-B"

def test_get_and_update_my_staff_profile():
    headers = get_staff_headers()

    # 1. Get staff profile
    get_res = client.get("/staff/me", headers=headers)
    assert get_res.status_code == 200
    data = get_res.json()
    assert data["employee_id"] == "EMP-CSE-02"

    # 2. Update staff profile
    update_res = client.put("/staff/me", json={
        "designation": "Associate Professor"
    }, headers=headers)
    assert update_res.status_code == 200
    assert update_res.json()["designation"] == "Associate Professor"

def test_admin_list_and_update_students():
    admin_headers = get_admin_headers()

    # List students
    list_res = client.get("/students?page=1&page_size=10", headers=admin_headers)
    assert list_res.status_code == 200
    list_data = list_res.json()
    assert "items" in list_data
    assert list_data["total"] >= 1

    student_id = list_data["items"][0]["id"]

    # Admin updates student profile
    up_res = client.put(f"/students/{student_id}", json={
        "program": "B.Tech Honours"
    }, headers=admin_headers)
    assert up_res.status_code == 200
    assert up_res.json()["program"] == "B.Tech Honours"

def test_admin_list_staff():
    admin_headers = get_admin_headers()
    list_res = client.get("/staff?page=1&page_size=10", headers=admin_headers)
    assert list_res.status_code == 200
    assert list_res.json()["total"] >= 1
