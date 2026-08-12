import uuid
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def get_admin_headers():
    res = client.post("/auth/login", json={"email": "admin@krmu.edu.in", "password": "Admin@123"})
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def get_student_headers():
    res = client.post("/auth/login", json={"email": "student.cse@krmu.edu.in", "password": "Student@123"})
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def test_list_departments():
    headers = get_student_headers()
    response = client.get("/departments", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert len(data["items"]) >= 1

def test_admin_create_update_deactivate_department():
    headers = get_admin_headers()
    uid = uuid.uuid4().hex[:6].upper()
    code = f"DEP-{uid}"
    name = f"Test Department {uid}"

    # 1. Create Department
    create_res = client.post("/departments", json={
        "name": name,
        "code": code,
        "description": "Department created for testing"
    }, headers=headers)
    assert create_res.status_code == 201
    dept_id = create_res.json()["id"]

    # 2. Update Department
    update_res = client.put(f"/departments/{dept_id}", json={
        "description": "Updated department description"
    }, headers=headers)
    assert update_res.status_code == 200
    assert update_res.json()["description"] == "Updated department description"

    # 3. Deactivate Department
    deact_res = client.patch(f"/departments/{dept_id}/deactivate", headers=headers)
    assert deact_res.status_code == 200
    assert deact_res.json()["is_active"] is False

    # 4. Activate Department
    act_res = client.patch(f"/departments/{dept_id}/activate", headers=headers)
    assert act_res.status_code == 200
    assert act_res.json()["is_active"] is True

def test_student_cannot_create_department():
    headers = get_student_headers()
    response = client.post("/departments", json={
        "name": "Forbidden Dept",
        "code": "FORBID",
        "description": "Should fail"
    }, headers=headers)
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "PERMISSION_DENIED"

def test_list_and_create_categories():
    headers = get_admin_headers()

    # Get a department ID
    dept_res = client.get("/departments", headers=headers)
    dept_id = dept_res.json()["items"][0]["id"]

    # Create category
    cat_name = f"Test Category {uuid.uuid4().hex[:6]}"
    create_res = client.post("/categories", json={
        "name": cat_name,
        "description": "Category for testing",
        "department_id": dept_id
    }, headers=headers)
    assert create_res.status_code == 201
    cat_id = create_res.json()["id"]

    # List categories
    list_res = client.get(f"/categories?department_id={dept_id}", headers=headers)
    assert list_res.status_code == 200
    assert any(c["id"] == cat_id for c in list_res.json()["items"])

def test_list_and_create_facilities():
    headers = get_admin_headers()
    dept_res = client.get("/departments", headers=headers)
    dept_id = dept_res.json()["items"][0]["id"]

    create_res = client.post("/facilities", json={
        "name": f"Test Lab {uuid.uuid4().hex[:4]}",
        "type": "Laboratory",
        "location": "Building C Room 101",
        "department_id": dept_id,
        "capacity": 50
    }, headers=headers)
    assert create_res.status_code == 201
    fac_id = create_res.json()["id"]

    list_res = client.get("/facilities", headers=headers)
    assert list_res.status_code == 200
    assert any(f["id"] == fac_id for f in list_res.json()["items"])

def test_transport_routes_and_stops():
    headers = get_admin_headers()

    # 1. Create Transport Route
    r_num = f"R-{uuid.uuid4().hex[:4].upper()}"
    route_res = client.post("/transport/routes", json={
        "route_name": "Test Express Route",
        "route_number": r_num,
        "description": "Test Route description",
        "stops": [
            {"name": "Stop A", "latitude": 28.4500, "longitude": 77.0500, "sequence": 1},
            {"name": "Stop B", "latitude": 28.3500, "longitude": 77.0600, "sequence": 2}
        ]
    }, headers=headers)
    assert route_res.status_code == 201
    route_data = route_res.json()
    route_id = route_data["id"]
    assert len(route_data["stops"]) == 2

    # 2. Add extra stop
    stop_res = client.post(f"/transport/routes/{route_id}/stops", json={
        "name": "Stop C (Campus)",
        "latitude": 28.2435,
        "longitude": 77.0658,
        "sequence": 3
    }, headers=headers)
    assert stop_res.status_code == 201

    # 3. List Routes
    list_res = client.get("/transport/routes", headers=headers)
    assert list_res.status_code == 200
    found_route = next(r for r in list_res.json()["items"] if r["id"] == route_id)
    assert len(found_route["stops"]) == 3
    # Check ordering of sequence
    assert [s["sequence"] for s in found_route["stops"]] == [1, 2, 3]
