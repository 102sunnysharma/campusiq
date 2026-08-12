import uuid
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_login_student():
    response = client.post("/auth/login", json={
        "email": "student.cse@krmu.edu.in",
        "password": "Student@123"
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["role"]["name"] == "student"
    assert data["user"]["student_profile"] is not None

def test_login_admin():
    response = client.post("/auth/login", json={
        "email": "admin@krmu.edu.in",
        "password": "Admin@123"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["user"]["role"]["name"] == "admin"

def test_login_invalid_password():
    response = client.post("/auth/login", json={
        "email": "student.cse@krmu.edu.in",
        "password": "WrongPassword123"
    })
    assert response.status_code == 401
    data = response.json()
    assert data["success"] is False
    assert data["error"]["code"] == "INVALID_CREDENTIALS"

def test_register_new_student():
    uid = uuid.uuid4().hex[:8]
    email = f"student_{uid}@krmu.edu.in"
    response = client.post("/auth/register", json={
        "email": email,
        "password": "TestPassword123",
        "full_name": "Test Student User",
        "role_name": "student"
    })
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert data["user"]["email"] == email
    assert data["user"]["role"]["name"] == "student"

def test_register_duplicate_email():
    response = client.post("/auth/register", json={
        "email": "student.cse@krmu.edu.in",
        "password": "TestPassword123",
        "full_name": "Duplicate User",
        "role_name": "student"
    })
    assert response.status_code == 409
    data = response.json()
    assert data["success"] is False
    assert data["error"]["code"] == "EMAIL_ALREADY_REGISTERED"

def test_get_current_user_profile():
    # 1. Login to get access token
    login_res = client.post("/auth/login", json={
        "email": "student.cse@krmu.edu.in",
        "password": "Student@123"
    })
    token = login_res.json()["access_token"]

    # 2. Get profile
    response = client.get("/users/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "student.cse@krmu.edu.in"
    assert data["role"]["name"] == "student"

def test_rbac_admin_user_listing():
    # 1. Login as Admin
    admin_login = client.post("/auth/login", json={
        "email": "admin@krmu.edu.in",
        "password": "Admin@123"
    })
    admin_token = admin_login.json()["access_token"]

    # Admin listing users -> should succeed
    admin_res = client.get("/users?page=1&page_size=10", headers={"Authorization": f"Bearer {admin_token}"})
    assert admin_res.status_code == 200
    admin_data = admin_res.json()
    assert "items" in admin_data
    assert admin_data["total"] >= 1

    # 2. Login as Student
    student_login = client.post("/auth/login", json={
        "email": "student.cse@krmu.edu.in",
        "password": "Student@123"
    })
    student_token = student_login.json()["access_token"]

    # Student attempting user listing -> should fail with 403 Forbidden
    student_res = client.get("/users?page=1&page_size=10", headers={"Authorization": f"Bearer {student_token}"})
    assert student_res.status_code == 403
    student_data = student_res.json()
    assert student_data["success"] is False
    assert student_data["error"]["code"] == "PERMISSION_DENIED"

def test_admin_password_reset():
    # Login as Admin
    admin_login = client.post("/auth/login", json={
        "email": "admin@krmu.edu.in",
        "password": "Admin@123"
    })
    admin_token = admin_login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Create dummy user to reset password for
    uid = uuid.uuid4().hex[:8]
    temp_email = f"reset_{uid}@krmu.edu.in"
    reg_res = client.post("/auth/register", json={
        "email": temp_email,
        "password": "InitialPassword123",
        "full_name": "Reset Test User",
        "role_name": "student"
    })
    assert reg_res.status_code == 201
    temp_user_id = reg_res.json()["user"]["id"]

    # Admin resets password
    reset_res = client.post(
        f"/users/{temp_user_id}/reset-password",
        json={"new_password": "NewSecretPassword123"},
        headers=admin_headers
    )
    assert reset_res.status_code == 200
    assert reset_res.json()["success"] is True

    # Verify login with new password works
    new_login_res = client.post("/auth/login", json={
        "email": temp_email,
        "password": "NewSecretPassword123"
    })
    assert new_login_res.status_code == 200
