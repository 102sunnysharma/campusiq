import React, { useState, useEffect } from 'react';
import { Navbar } from '../components/Navbar';
import api from '../services/api';
import {
  Building2, Layers, MapPin, Plus, Edit2, Power, CheckCircle,
  XCircle, Loader2, Search, Filter, AlertCircle, RefreshCw, X, Sparkles
} from 'lucide-react';

export const CampusManagement = () => {
  const [activeTab, setActiveTab] = useState('departments'); // 'departments' | 'categories' | 'facilities'

  // Departments State
  const [departments, setDepartments] = useState([]);
  const [loadingDepts, setLoadingDepts] = useState(false);

  // Categories State
  const [categories, setCategories] = useState([]);
  const [loadingCats, setLoadingCats] = useState(false);

  // Facilities State
  const [facilities, setFacilities] = useState([]);
  const [loadingFacs, setLoadingFacs] = useState(false);

  // Modal States
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [deptForm, setDeptForm] = useState({ name: '', code: '', description: '' });

  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [catForm, setCatForm] = useState({ name: '', description: '', department_id: '' });

  const [isFacModalOpen, setIsFacModalOpen] = useState(false);
  const [facForm, setFacForm] = useState({ name: '', type: 'Laboratory', location: '', capacity: '', department_id: '' });

  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchDepartments();
    fetchCategories();
    fetchFacilities();
  }, []);

  const fetchDepartments = async () => {
    setLoadingDepts(true);
    try {
      const res = await api.get('/departments?include_inactive=true');
      setDepartments(res.data.items || []);
    } catch (err) {
      console.error('Failed to fetch departments:', err);
    } finally {
      setLoadingDepts(false);
    }
  };

  const fetchCategories = async () => {
    setLoadingCats(true);
    try {
      const res = await api.get('/categories?include_inactive=true');
      setCategories(res.data.items || []);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    } finally {
      setLoadingCats(false);
    }
  };

  const fetchFacilities = async () => {
    setLoadingFacs(true);
    try {
      const res = await api.get('/facilities?include_inactive=true');
      setFacilities(res.data.items || []);
    } catch (err) {
      console.error('Failed to fetch facilities:', err);
    } finally {
      setLoadingFacs(false);
    }
  };

  // --- Department Handlers ---
  const handleSaveDepartment = async (e) => {
    e.preventDefault();
    setActionError('');
    setActionSuccess('');
    setSubmitting(true);

    try {
      if (editingDept) {
        await api.put(`/departments/${editingDept.id}`, {
          name: deptForm.name,
          code: deptForm.code,
          description: deptForm.description,
        });
        setActionSuccess(`Department '${deptForm.name}' updated successfully!`);
      } else {
        await api.post('/departments', {
          name: deptForm.name,
          code: deptForm.code,
          description: deptForm.description,
        });
        setActionSuccess(`Department '${deptForm.name}' created successfully!`);
      }
      setIsDeptModalOpen(false);
      setEditingDept(null);
      setDeptForm({ name: '', code: '', description: '' });
      fetchDepartments();
    } catch (err) {
      console.error('Department save error:', err);
      setActionError(err.response?.data?.error?.message || 'Failed to save department.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleDepartmentStatus = async (dept) => {
    try {
      if (dept.is_active) {
        await api.patch(`/departments/${dept.id}/deactivate`);
        setActionSuccess(`Deactivated department '${dept.name}'.`);
      } else {
        await api.patch(`/departments/${dept.id}/activate`);
        setActionSuccess(`Activated department '${dept.name}'.`);
      }
      fetchDepartments();
    } catch (err) {
      console.error('Toggle status error:', err);
      setActionError(err.response?.data?.error?.message || 'Failed to update department status.');
    }
  };

  // --- Category Handler ---
  const handleSaveCategory = async (e) => {
    e.preventDefault();
    setActionError('');
    setActionSuccess('');
    setSubmitting(true);

    try {
      await api.post('/categories', {
        name: catForm.name,
        description: catForm.description,
        department_id: catForm.department_id,
      });
      setActionSuccess(`Category '${catForm.name}' created successfully!`);
      setIsCatModalOpen(false);
      setCatForm({ name: '', description: '', department_id: '' });
      fetchCategories();
    } catch (err) {
      console.error('Category create error:', err);
      setActionError(err.response?.data?.error?.message || 'Failed to create category.');
    } finally {
      setSubmitting(false);
    }
  };

  // --- Facility Handler ---
  const handleSaveFacility = async (e) => {
    e.preventDefault();
    setActionError('');
    setActionSuccess('');
    setSubmitting(true);

    try {
      await api.post('/facilities', {
        name: facForm.name,
        type: facForm.type,
        location: facForm.location,
        capacity: facForm.capacity ? parseInt(facForm.capacity) : null,
        department_id: facForm.department_id,
      });
      setActionSuccess(`Facility '${facForm.name}' created successfully!`);
      setIsFacModalOpen(false);
      setFacForm({ name: '', type: 'Laboratory', location: '', capacity: '', department_id: '' });
      fetchFacilities();
    } catch (err) {
      console.error('Facility create error:', err);
      setActionError(err.response?.data?.error?.message || 'Failed to create facility.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Campus Architecture Management</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
              Campus Structure & Facilities
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Configure academic departments, grievance categories, and infrastructure facilities.
            </p>
          </div>
        </div>

        {/* Feedback Messages */}
        {actionSuccess && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <span>{actionSuccess}</span>
            </div>
            <button onClick={() => setActionSuccess('')} className="text-emerald-400 hover:text-emerald-200">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {actionError && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-rose-400" />
              <span>{actionError}</span>
            </div>
            <button onClick={() => setActionError('')} className="text-rose-400 hover:text-rose-200">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
          <button
            onClick={() => setActiveTab('departments')}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-semibold text-xs transition-all ${
              activeTab === 'departments'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Departments ({departments.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('categories')}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-semibold text-xs transition-all ${
              activeTab === 'categories'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Categories ({categories.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('facilities')}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-semibold text-xs transition-all ${
              activeTab === 'facilities'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Facilities ({facilities.length})</span>
          </button>
        </div>

        {/* TAB 1: DEPARTMENTS */}
        {activeTab === 'departments' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-100">Academic & Administrative Departments</h2>
              <button
                onClick={() => {
                  setEditingDept(null);
                  setDeptForm({ name: '', code: '', description: '' });
                  setIsDeptModalOpen(true);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl flex items-center space-x-2 shadow-lg shadow-indigo-600/20 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Add Department</span>
              </button>
            </div>

            {loadingDepts ? (
              <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center space-y-3">
                <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                <span>Loading Departments...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {departments.map((dept) => (
                  <div
                    key={dept.id}
                    className={`bg-slate-900/80 border rounded-2xl p-6 shadow-xl flex flex-col justify-between transition-all ${
                      dept.is_active ? 'border-slate-800 hover:border-slate-700' : 'border-slate-800/50 opacity-60'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-mono text-xs font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-lg">
                          {dept.code}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          dept.is_active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          {dept.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-slate-100 mb-1">{dept.name}</h3>
                      <p className="text-slate-400 text-xs line-clamp-2 mb-4">
                        {dept.description || 'No description provided.'}
                      </p>
                    </div>

                    <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs">
                      <button
                        onClick={() => {
                          setEditingDept(dept);
                          setDeptForm({ name: dept.name, code: dept.code, description: dept.description || '' });
                          setIsDeptModalOpen(true);
                        }}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium flex items-center space-x-1 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Edit</span>
                      </button>

                      <button
                        onClick={() => handleToggleDepartmentStatus(dept)}
                        className={`px-3 py-1.5 rounded-lg font-medium flex items-center space-x-1 transition-colors ${
                          dept.is_active
                            ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20'
                            : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20'
                        }`}
                      >
                        <Power className="w-3.5 h-3.5" />
                        <span>{dept.is_active ? 'Deactivate' : 'Activate'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CATEGORIES */}
        {activeTab === 'categories' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-100">Grievance & Feedback Categories</h2>
              <button
                onClick={() => {
                  setCatForm({ name: '', description: '', department_id: departments[0]?.id || '' });
                  setIsCatModalOpen(true);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl flex items-center space-x-2 shadow-lg shadow-indigo-600/20 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Add Category</span>
              </button>
            </div>

            {loadingCats ? (
              <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center space-y-3">
                <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                <span>Loading Categories...</span>
              </div>
            ) : (
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-3.5 px-4 font-semibold">Category Name</th>
                      <th className="py-3.5 px-4 font-semibold">Department</th>
                      <th className="py-3.5 px-4 font-semibold">Description</th>
                      <th className="py-3.5 px-4 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {categories.map((cat) => (
                      <tr key={cat.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-slate-100">{cat.name}</td>
                        <td className="py-3.5 px-4 text-indigo-400 font-medium">
                          {cat.department_name || 'Department'}
                        </td>
                        <td className="py-3.5 px-4 text-slate-400">{cat.description || 'N/A'}</td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            cat.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                          }`}>
                            {cat.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: FACILITIES */}
        {activeTab === 'facilities' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-100">Campus Infrastructure Facilities</h2>
              <button
                onClick={() => {
                  setFacForm({ name: '', type: 'Laboratory', location: '', capacity: '', department_id: departments[0]?.id || '' });
                  setIsFacModalOpen(true);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl flex items-center space-x-2 shadow-lg shadow-indigo-600/20 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Add Facility</span>
              </button>
            </div>

            {loadingFacs ? (
              <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center space-y-3">
                <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                <span>Loading Facilities...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {facilities.map((fac) => (
                  <div key={fac.id} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        {fac.type}
                      </span>
                      {fac.capacity && (
                        <span className="text-slate-400 text-xs font-mono">Capacity: {fac.capacity}</span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-slate-100">{fac.name}</h3>
                    <div className="text-xs text-slate-400 flex items-center space-x-1">
                      <MapPin className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span>{fac.location}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-800">
                      Managed by: <span className="text-slate-300 font-medium">{fac.department_name}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* DEPARTMENT MODAL */}
      {isDeptModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-100">
              {editingDept ? 'Edit Department' : 'Add New Department'}
            </h3>
            <form onSubmit={handleSaveDepartment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Department Code</label>
                <input
                  type="text"
                  required
                  value={deptForm.code}
                  onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })}
                  placeholder="e.g. CSE, MGMT, ECE"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 px-3 text-xs text-slate-100 font-mono uppercase focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Department Name</label>
                <input
                  type="text"
                  required
                  value={deptForm.name}
                  onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                  placeholder="Computer Science & Engineering"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 px-3 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Description</label>
                <textarea
                  value={deptForm.description}
                  onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
                  placeholder="Optional details..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 px-3 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 h-20"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDeptModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Save Department</span>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CATEGORY MODAL */}
      {isCatModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-100">Add New Category</h3>
            <form onSubmit={handleSaveCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Department</label>
                <select
                  required
                  value={catForm.department_id}
                  onChange={(e) => setCatForm({ ...catForm, department_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 px-3 text-xs text-slate-100"
                >
                  <option value="">Select Department</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Category Name</label>
                <input
                  type="text"
                  required
                  value={catForm.name}
                  onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                  placeholder="e.g. Lab Infrastructure"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 px-3 text-xs text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Description</label>
                <textarea
                  value={catForm.description}
                  onChange={(e) => setCatForm({ ...catForm, description: e.target.value })}
                  placeholder="Optional details..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 px-3 text-xs text-slate-100 h-20"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCatModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Save Category</span>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FACILITY MODAL */}
      {isFacModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-100">Add New Facility</h3>
            <form onSubmit={handleSaveFacility} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Department</label>
                <select
                  required
                  value={facForm.department_id}
                  onChange={(e) => setFacForm({ ...facForm, department_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 px-3 text-xs text-slate-100"
                >
                  <option value="">Select Department</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Facility Name</label>
                <input
                  type="text"
                  required
                  value={facForm.name}
                  onChange={(e) => setFacForm({ ...facForm, name: e.target.value })}
                  placeholder="e.g. Robotics & Automation Lab"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 px-3 text-xs text-slate-100"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Type</label>
                  <input
                    type="text"
                    required
                    value={facForm.type}
                    onChange={(e) => setFacForm({ ...facForm, type: e.target.value })}
                    placeholder="Laboratory / Library"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 px-3 text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Capacity</label>
                  <input
                    type="number"
                    value={facForm.capacity}
                    onChange={(e) => setFacForm({ ...facForm, capacity: e.target.value })}
                    placeholder="60"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 px-3 text-xs text-slate-100"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Location</label>
                <input
                  type="text"
                  required
                  value={facForm.location}
                  onChange={(e) => setFacForm({ ...facForm, location: e.target.value })}
                  placeholder="Block A, Room 302"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 px-3 text-xs text-slate-100"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFacModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Save Facility</span>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
