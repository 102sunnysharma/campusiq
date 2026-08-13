import React, { useState, useEffect } from 'react';
import { Navbar } from '../components/Navbar';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Users, GraduationCap, Briefcase, Search, Filter, Edit2, Loader2,
  CheckCircle, AlertCircle, RefreshCw, Sparkles, ChevronLeft, ChevronRight, X
} from 'lucide-react';

export const ProfilesManagement = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('students'); // 'students' | 'staff'

  // Student directory state
  const [students, setStudents] = useState([]);
  const [studentPage, setStudentPage] = useState(1);
  const [studentTotalPages, setStudentTotalPages] = useState(1);
  const [studentTotal, setStudentTotal] = useState(0);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Staff directory state
  const [staffList, setStaffList] = useState([]);
  const [staffPage, setStaffPage] = useState(1);
  const [staffTotalPages, setStaffTotalPages] = useState(1);
  const [staffTotal, setStaffTotal] = useState(0);
  const [loadingStaff, setLoadingStaff] = useState(false);

  // Shared filters
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Edit Modal State (Admin only)
  const [editingStudent, setEditingStudent] = useState(null);
  const [editingStaff, setEditingStaff] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    if (activeTab === 'students') {
      fetchStudents();
    } else {
      fetchStaff();
    }
  }, [activeTab, studentPage, staffPage, selectedDept, searchQuery]);

  const fetchDepartments = async () => {
    try {
      const res = await api.get('/departments');
      setDepartments(res.data.items || []);
    } catch (err) {
      console.error('Failed to load departments:', err);
    }
  };

  const fetchStudents = async () => {
    setLoadingStudents(true);
    try {
      let url = `/students?page=${studentPage}&page_size=10`;
      if (selectedDept) url += `&department_id=${selectedDept}`;
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;

      const res = await api.get(url);
      setStudents(res.data.items || []);
      setStudentTotalPages(res.data.total_pages || 1);
      setStudentTotal(res.data.total || 0);
    } catch (err) {
      console.error('Failed to load students:', err);
    } finally {
      setLoadingStudents(false);
    }
  };

  const fetchStaff = async () => {
    setLoadingStaff(true);
    try {
      let url = `/staff?page=${staffPage}&page_size=10`;
      if (selectedDept) url += `&department_id=${selectedDept}`;
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;

      const res = await api.get(url);
      setStaffList(res.data.items || []);
      setStaffTotalPages(res.data.total_pages || 1);
      setStaffTotal(res.data.total || 0);
    } catch (err) {
      console.error('Failed to load staff list:', err);
    } finally {
      setLoadingStaff(false);
    }
  };

  // Admin Student Save
  const handleSaveStudent = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.put(`/students/${editingStudent.id}`, {
        full_name: editForm.full_name,
        phone: editForm.phone,
        roll_number: editForm.roll_number,
        program: editForm.program,
        course_name: editForm.course_name,
        semester: parseInt(editForm.semester),
        department_id: editForm.department_id,
      });

      setMessage(`Updated student profile for ${editingStudent.user?.full_name}`);
      setEditingStudent(null);
      fetchStudents();
    } catch (err) {
      console.error('Update student error:', err);
      setError(err.response?.data?.error?.message || 'Failed to update student profile.');
    } finally {
      setSaving(false);
    }
  };

  // Admin Staff Save
  const handleSaveStaff = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.put(`/staff/${editingStaff.id}`, {
        full_name: editForm.full_name,
        phone: editForm.phone,
        designation: editForm.designation,
        employee_id: editForm.employee_id,
        department_id: editForm.department_id,
      });

      setMessage(`Updated staff profile for ${editingStaff.user?.full_name}`);
      setEditingStaff(null);
      fetchStaff();
    } catch (err) {
      console.error('Update staff error:', err);
      setError(err.response?.data?.error?.message || 'Failed to update staff profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Campus Directory & Profiles</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
              Student & Staff Profile Directory
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Browse student academic records, staff designations, and department affiliations.
            </p>
          </div>
        </div>

        {/* Feedback Messages */}
        {message && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center justify-between">
            <span>{message}</span>
            <button onClick={() => setMessage('')} className="text-emerald-400">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-rose-400">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Directory Controls */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row gap-4 justify-between items-center">
          {/* Tabs */}
          <div className="flex items-center space-x-2 w-full md:w-auto">
            <button
              onClick={() => { setActiveTab('students'); setStudentPage(1); }}
              className={`flex-1 md:flex-none flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl font-semibold text-xs transition-all ${
                activeTab === 'students'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              <span>Students Directory ({studentTotal})</span>
            </button>

            <button
              onClick={() => { setActiveTab('staff'); setStaffPage(1); }}
              className={`flex-1 md:flex-none flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl font-semibold text-xs transition-all ${
                activeTab === 'staff'
                  ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Briefcase className="w-4 h-4" />
              <span>Staff Directory ({staffTotal})</span>
            </button>
          </div>

          {/* Search & Department Filters */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, ID, roll..."
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl py-2 pl-9 pr-3 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full sm:w-auto bg-slate-950 border border-slate-700/80 text-xs text-slate-200 rounded-xl py-2 px-3 focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
              ))}
            </select>
          </div>
        </div>

        {/* TAB 1: STUDENTS DIRECTORY */}
        {activeTab === 'students' && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            {loadingStudents ? (
              <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center space-y-3">
                <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
                <span>Fetching Student Records...</span>
              </div>
            ) : students.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                No student profiles found matching your search.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-3.5 px-4 font-semibold">Student ID & Name</th>
                      <th className="py-3.5 px-4 font-semibold">Program & Course</th>
                      <th className="py-3.5 px-4 font-semibold">Department</th>
                      <th className="py-3.5 px-4 font-semibold">Semester</th>
                      <th className="py-3.5 px-4 font-semibold">Roll Number</th>
                      {user?.role?.name === 'admin' && <th className="py-3.5 px-4 font-semibold text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {students.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-mono text-emerald-400 font-bold">{s.student_id}</div>
                          <div className="font-semibold text-slate-100">{s.user?.full_name}</div>
                          <div className="text-[11px] text-slate-400">{s.user?.email}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-slate-200">{s.program}</div>
                          <div className="text-slate-400 text-[11px]">{s.course_name}</div>
                        </td>
                        <td className="py-3.5 px-4 text-indigo-400 font-medium">
                          {s.department_name} ({s.department_code})
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-200">Sem {s.semester}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-400">{s.roll_number || 'N/A'}</td>
                        {user?.role?.name === 'admin' && (
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => {
                                setEditingStudent(s);
                                setEditForm({
                                  full_name: s.user?.full_name || '',
                                  phone: s.user?.phone || '',
                                  roll_number: s.roll_number || '',
                                  program: s.program || '',
                                  course_name: s.course_name || '',
                                  semester: s.semester || 1,
                                  department_id: s.department_id,
                                });
                              }}
                              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 rounded-lg font-medium inline-flex items-center space-x-1"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {studentTotalPages > 1 && (
              <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-between items-center text-xs">
                <button
                  disabled={studentPage <= 1}
                  onClick={() => setStudentPage((p) => p - 1)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg disabled:opacity-40"
                >
                  ← Previous
                </button>
                <span className="text-slate-400">
                  Page <strong className="text-slate-200">{studentPage}</strong> of <strong className="text-slate-200">{studentTotalPages}</strong>
                </span>
                <button
                  disabled={studentPage >= studentTotalPages}
                  onClick={() => setStudentPage((p) => p + 1)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: STAFF DIRECTORY */}
        {activeTab === 'staff' && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            {loadingStaff ? (
              <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center space-y-3">
                <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
                <span>Fetching Staff Records...</span>
              </div>
            ) : staffList.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                No staff profiles found matching your search.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-3.5 px-4 font-semibold">Employee ID & Name</th>
                      <th className="py-3.5 px-4 font-semibold">Designation</th>
                      <th className="py-3.5 px-4 font-semibold">Department</th>
                      <th className="py-3.5 px-4 font-semibold">Phone Contact</th>
                      {user?.role?.name === 'admin' && <th className="py-3.5 px-4 font-semibold text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {staffList.map((st) => (
                      <tr key={st.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-mono text-sky-400 font-bold">{st.employee_id}</div>
                          <div className="font-semibold text-slate-100">{st.user?.full_name}</div>
                          <div className="text-[11px] text-slate-400">{st.user?.email}</div>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-200">{st.designation}</td>
                        <td className="py-3.5 px-4 text-indigo-400 font-medium">
                          {st.department_name} ({st.department_code})
                        </td>
                        <td className="py-3.5 px-4 text-slate-400">{st.user?.phone || 'Not provided'}</td>
                        {user?.role?.name === 'admin' && (
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => {
                                setEditingStaff(st);
                                setEditForm({
                                  full_name: st.user?.full_name || '',
                                  phone: st.user?.phone || '',
                                  employee_id: st.employee_id,
                                  designation: st.designation || '',
                                  department_id: st.department_id,
                                });
                              }}
                              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 rounded-lg font-medium inline-flex items-center space-x-1"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {staffTotalPages > 1 && (
              <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-between items-center text-xs">
                <button
                  disabled={staffPage <= 1}
                  onClick={() => setStaffPage((p) => p - 1)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg disabled:opacity-40"
                >
                  ← Previous
                </button>
                <span className="text-slate-400">
                  Page <strong className="text-slate-200">{staffPage}</strong> of <strong className="text-slate-200">{staffTotalPages}</strong>
                </span>
                <button
                  disabled={staffPage >= staffTotalPages}
                  onClick={() => setStaffPage((p) => p + 1)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* EDIT STUDENT MODAL (ADMIN ONLY) */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-100">Edit Student Record ({editingStudent.student_id})</h3>
            <form onSubmit={handleSaveStudent} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 px-3 text-slate-100"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Department</label>
                <select
                  value={editForm.department_id}
                  onChange={(e) => setEditForm({ ...editForm, department_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 px-3 text-slate-100"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Program</label>
                  <input
                    type="text"
                    value={editForm.program}
                    onChange={(e) => setEditForm({ ...editForm, program: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 px-3 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Semester</label>
                  <input
                    type="number"
                    value={editForm.semester}
                    onChange={(e) => setEditForm({ ...editForm, semester: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 px-3 text-slate-100"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Course Name</label>
                <input
                  type="text"
                  value={editForm.course_name}
                  onChange={(e) => setEditForm({ ...editForm, course_name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 px-3 text-slate-100"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold flex items-center space-x-1.5"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Update Record</span>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT STAFF MODAL (ADMIN ONLY) */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-100">Edit Staff Record ({editingStaff.employee_id})</h3>
            <form onSubmit={handleSaveStaff} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 px-3 text-slate-100"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Designation</label>
                <input
                  type="text"
                  required
                  value={editForm.designation}
                  onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 px-3 text-slate-100"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Department</label>
                <select
                  value={editForm.department_id}
                  onChange={(e) => setEditForm({ ...editForm, department_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 px-3 text-slate-100"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-semibold flex items-center space-x-1.5"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Update Staff</span>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
