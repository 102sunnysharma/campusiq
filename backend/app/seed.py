import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import logging
from sqlalchemy.orm import Session
from app.database import SessionLocal, engine, Base
from app.models import Role, Department, SLAPolicy, User, Student, Staff, Category, Facility, TransportRoute, TransportStop
from app.core.security import hash_password

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("seed")

def seed_data():
    db: Session = SessionLocal()
    try:
        logger.info("Seeding initial database records...")

        # 1. Seed Roles
        roles_data = [
            {"name": "student", "description": "Student role - submit feedback & grievances"},
            {"name": "staff", "description": "Staff role - resolve assigned grievances"},
            {"name": "hod", "description": "Head of Department role - department oversight"},
            {"name": "admin", "description": "System Administrator - full administrative access"}
        ]
        roles_dict = {}
        for r in roles_data:
            existing = db.query(Role).filter(Role.name == r["name"]).first()
            if not existing:
                role = Role(name=r["name"], description=r["description"])
                db.add(role)
                db.flush()
                roles_dict[r["name"]] = role
                logger.info(f"Added role: {r['name']}")
            else:
                roles_dict[r["name"]] = existing

        # 2. Seed Sample Departments
        departments_data = [
            {
                "code": "CSE",
                "name": "Computer Science & Engineering",
                "description": "Department of Computer Science & Engineering"
            },
            {
                "code": "MGMT",
                "name": "Management Studies",
                "description": "School of Management & Business Studies"
            },
            {
                "code": "TRANS",
                "name": "Transport & Logistics",
                "description": "Campus Transport and Operations"
            },
            {
                "code": "HOSTEL",
                "name": "Hostel & Facilities",
                "description": "Hostel and Campus Infrastructure Management"
            }
        ]
        depts_dict = {}
        for d in departments_data:
            existing = db.query(Department).filter(Department.code == d["code"]).first()
            if not existing:
                dept = Department(code=d["code"], name=d["name"], description=d["description"], is_active=True)
                db.add(dept)
                db.flush()
                depts_dict[d["code"]] = dept
                logger.info(f"Added department: {d['code']} - {d['name']}")
            else:
                depts_dict[d["code"]] = existing

        # 3. Seed Default SLA Policies (Section 8.1)
        sla_data = [
            {"priority": "urgent", "duration_minutes": 240, "warning_percentage": 80},
            {"priority": "high", "duration_minutes": 1440, "warning_percentage": 80},
            {"priority": "medium", "duration_minutes": 4320, "warning_percentage": 80},
            {"priority": "low", "duration_minutes": 7200, "warning_percentage": 80}
        ]
        for s in sla_data:
            existing = db.query(SLAPolicy).filter(SLAPolicy.priority == s["priority"]).first()
            if not existing:
                policy = SLAPolicy(
                    priority=s["priority"],
                    duration_minutes=s["duration_minutes"],
                    warning_percentage=s["warning_percentage"],
                    is_active=True
                )
                db.add(policy)
                logger.info(f"Added SLA policy: {s['priority']} ({s['duration_minutes']}m)")

        # 4. Seed Categories per Department
        cse_dept = depts_dict["CSE"]
        mgmt_dept = depts_dict["MGMT"]
        trans_dept = depts_dict["TRANS"]
        hostel_dept = depts_dict["HOSTEL"]

        categories_data = [
            {"name": "Academic & Curriculum", "description": "Syllabus, lectures, assignment submissions", "dept": cse_dept},
            {"name": "Lab Equipment & Software", "description": "Compilers, IDEs, computer lab hardware", "dept": cse_dept},
            {"name": "Management & Internships", "description": "Corporate mentorship, placement drives", "dept": mgmt_dept},
            {"name": "Bus Schedule & Timing", "description": "Bus routes, timing delays, driver conduct", "dept": trans_dept},
            {"name": "Hostel Maintenance & Mess", "description": "Room repairs, electricity, mess food quality", "dept": hostel_dept},
        ]
        for c in categories_data:
            existing_cat = db.query(Category).filter(Category.name == c["name"], Category.department_id == c["dept"].id).first()
            if not existing_cat:
                cat = Category(name=c["name"], description=c["description"], department_id=c["dept"].id, is_active=True)
                db.add(cat)
                logger.info(f"Added category: {c['name']}")

        # 5. Seed Facilities
        facilities_data = [
            {"name": "Advanced AI & Robotics Lab", "type": "Laboratory", "location": "Block A, Room 302", "dept": cse_dept, "capacity": 60},
            {"name": "Central Computing Center", "type": "Laboratory", "location": "Block A, Room 105", "dept": cse_dept, "capacity": 120},
            {"name": "Executive Seminar Hall", "type": "Auditorium", "location": "Block B, Floor 2", "dept": mgmt_dept, "capacity": 250},
            {"name": "Central Campus Library", "type": "Library", "location": "Central Block", "dept": cse_dept, "capacity": 500},
            {"name": "Boys Hostel Block 1", "type": "Residence", "location": "Hostel Complex North", "dept": hostel_dept, "capacity": 400},
        ]
        for f in facilities_data:
            existing_fac = db.query(Facility).filter(Facility.name == f["name"]).first()
            if not existing_fac:
                fac = Facility(
                    name=f["name"],
                    type=f["type"],
                    location=f["location"],
                    department_id=f["dept"].id,
                    capacity=f["capacity"],
                    is_active=True
                )
                db.add(fac)
                logger.info(f"Added facility: {f['name']}")

        # 6. Seed Transport Routes & GPS Stops
        routes_data = [
            {
                "number": "R-101",
                "name": "Cyber City - Subhash Chowk - KRMU Campus",
                "description": "Express Route covering Cyber City, Huda City Centre, Subhash Chowk, and KRMU Campus",
                "stops": [
                    {"name": "Cyber City Metro Station", "lat": 28.4950, "lng": 77.0890, "seq": 1},
                    {"name": "Millennium City Centre (Huda)", "lat": 28.4595, "lng": 77.0725, "seq": 2},
                    {"name": "Subhash Chowk Flyover", "lat": 28.4328, "lng": 77.0435, "seq": 3},
                    {"name": "Badshahpur Bus Stop", "lat": 28.3610, "lng": 77.0512, "seq": 4},
                    {"name": "Sohna Road Checkpost", "lat": 28.3245, "lng": 77.0421, "seq": 5},
                    {"name": "KRM University Main Gate", "lat": 28.2435, "lng": 77.0658, "seq": 6},
                ]
            },
            {
                "number": "R-102",
                "name": "Rajiv Chowk Gurgaon - KRMU Campus",
                "description": "Direct route starting at Rajiv Chowk Gurgaon",
                "stops": [
                    {"name": "Rajiv Chowk Gurgaon", "lat": 28.4592, "lng": 77.0325, "seq": 1},
                    {"name": "Islampur Mor", "lat": 28.4380, "lng": 77.0410, "seq": 2},
                    {"name": "Vatika Chowk", "lat": 28.4012, "lng": 77.0460, "seq": 3},
                    {"name": "Bhondsi Police Camp", "lat": 28.3390, "lng": 77.0485, "seq": 4},
                    {"name": "KRM University Main Gate", "lat": 28.2435, "lng": 77.0658, "seq": 5},
                ]
            }
        ]
        for r_info in routes_data:
            existing_r = db.query(TransportRoute).filter(TransportRoute.route_number == r_info["number"]).first()
            if not existing_r:
                route = TransportRoute(
                    route_number=r_info["number"],
                    route_name=r_info["name"],
                    description=r_info["description"],
                    is_active=True
                )
                db.add(route)
                db.flush()

                for st in r_info["stops"]:
                    stop = TransportStop(
                        route_id=route.id,
                        name=st["name"],
                        latitude=st["lat"],
                        longitude=st["lng"],
                        sequence=st["seq"]
                    )
                    db.add(stop)
                logger.info(f"Added transport route: {r_info['number']} with {len(r_info['stops'])} stops")

        # 7. Seed Default Users for Testing
        default_users = [
            {
                "email": "admin@krmu.edu.in",
                "password": "Admin@123",
                "full_name": "System Administrator",
                "role_name": "admin",
                "phone": "+91 9876543210"
            },
            {
                "email": "hod.cse@krmu.edu.in",
                "password": "Hod@123",
                "full_name": "Dr. Rajesh Kumar (HOD CSE)",
                "role_name": "hod",
                "phone": "+91 9876543211",
                "employee_id": "EMP-HOD-CSE-01",
                "designation": "Head of Department"
            },
            {
                "email": "staff.cse@krmu.edu.in",
                "password": "Staff@123",
                "full_name": "Prof. Anita Sharma",
                "role_name": "staff",
                "phone": "+91 9876543212",
                "employee_id": "EMP-CSE-02",
                "designation": "Assistant Professor"
            },
            {
                "email": "student.cse@krmu.edu.in",
                "password": "Student@123",
                "full_name": "Sunny Sharma",
                "role_name": "student",
                "phone": "+91 9876543213",
                "student_id": "KRMU2026-CSE-001",
                "roll_number": "2026CSE001",
                "program": "B.Tech",
                "course_name": "Computer Science Engineering",
                "semester": 6
            }
        ]

        for u_data in default_users:
            existing_user = db.query(User).filter(User.email == u_data["email"]).first()
            if not existing_user:
                role_obj = roles_dict[u_data["role_name"]]
                user = User(
                    email=u_data["email"],
                    password_hash=hash_password(u_data["password"]),
                    full_name=u_data["full_name"],
                    phone=u_data.get("phone"),
                    role_id=role_obj.id,
                    is_active=True,
                    is_verified=True
                )
                db.add(user)
                db.flush()

                if u_data["role_name"] == "student" and cse_dept:
                    student_prof = Student(
                        user_id=user.id,
                        student_id=u_data["student_id"],
                        roll_number=u_data["roll_number"],
                        department_id=cse_dept.id,
                        semester=u_data["semester"],
                        program=u_data["program"],
                        course_name=u_data["course_name"]
                    )
                    db.add(student_prof)

                elif u_data["role_name"] in ["staff", "hod"] and cse_dept:
                    staff_prof = Staff(
                        user_id=user.id,
                        employee_id=u_data["employee_id"],
                        department_id=cse_dept.id,
                        designation=u_data["designation"]
                    )
                    db.add(staff_prof)
                    db.flush()
                    if u_data["role_name"] == "hod":
                        cse_dept.hod_staff_id = staff_prof.id

                logger.info(f"Seeded user: {u_data['email']} ({u_data['role_name']})")

        db.commit()
        logger.info("Seeding completed successfully!")
    except Exception as e:
        db.rollback()
        logger.error(f"Error during seeding: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()
