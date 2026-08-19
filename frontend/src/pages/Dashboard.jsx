import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';
import api from '../services/api';
import {
  Users, Shield, MessageSquare, AlertTriangle, CheckCircle, Clock,
  KeyRound, Search, Filter, Loader2, Sparkles, UserPlus, RefreshCw, GraduationCap
} from 'lucide-react';

export const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Admin user list state
  const [usersList, setUsersList] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [roleFilter, setRoleFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Admin password reset modal state
  const [selectedUser, setSelectedUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    if (user && user.role.name === 'admin') {
      fetchUsers();
    }
  }, [user, page, roleFilter, searchQuery]);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      let url = `/users?page=${page}&page_size=10`;
      if (roleFilter) url += `&role=${roleFilter}`;
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;

      const res = await api.get(url);
      setUsersList(res.data.items || []);
      setTotalPages(res.data.total_pages || 1);
      setTotalUsers(res.data.total || 0);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleAdminPasswordReset = async (e) => {
    e.preventDefault();
    if (!selectedUser || !newPassword) return;

    setResetLoading(true);
    setResetMessage('');
    try {
      await api.post(`/users/${selectedUser.id}/reset-password`, {
        new_password: newPassword,
      });
      setResetMessage(`Successfully reset password for ${selectedUser.email}`);
      setNewPassword('');
      setTimeout(() => {
        setSelectedUser(null);
        setResetMessage('');
      }, 2000);
    } catch (err) {
      console.error('Password reset failed:', err);
      setResetMessage('Failed to reset password.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Welcome Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-indigo-900/40 via-purple-900/30 to-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Role-Based Portal Access</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
                Welcome back, {user?.full_name}!
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                Connected to <span className="text-indigo-300 font-semibold">KRMU Campus Intelligence Platform</span> as{' '}
                <span className="uppercase text-indigo-400 font-bold">{user?.role?.name}</span>.
              </p>
            </div>

            <div className="flex items-center space-x-3">
              <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-4 text-right">
                <div className="text-xs text-slate-400 font-medium">Account Status</div>
                <div className="text-sm font-bold text-emerald-400 flex items-center space-x-1.5 justify-end">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Verified & Active</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ROLE SPECIFIC DASHBOARD CONTENT */}

        {/* 1. STUDENT VIEW */}
        {user?.role?.name === 'student' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Profile Card */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-lg">
                <div className="flex items-center space-x-3 text-emerald-400 mb-4">
                  <GraduationCap className="w-6 h-6" />
                  <h3 className="text-lg font-bold text-slate-100">Student Credentials</h3>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between py-1.5 border-b border-slate-800">
                    <span className="text-slate-400">Student ID:</span>
                    <span className="font-mono text-slate-200 font-semibold">{user.student_profile?.student_id || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-800">
                    <span className="text-slate-400">Roll Number:</span>
                    <span className="font-mono text-slate-200 font-semibold">{user.student_profile?.roll_number || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-800">
                    <span className="text-slate-400">Program:</span>
                    <span className="text-slate-200 font-medium">{user.student_profile?.program || 'B.Tech'}</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-400">Course:</span>
                    <span className="text-slate-200 font-medium">{user.student_profile?.course_name || 'Computer Science'}</span>
                  </div>
                </div>
              </div>

              {/* Action 1: Submit Feedback */}
              <div className="bg-gradient-to-br from-slate-900 to-indigo-950/40 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-6 shadow-lg transition-all group">
                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-100 mb-2">Submit Feedback</h3>
                <p className="text-slate-400 text-xs mb-4">
                  Share your experiences with campus facilities, faculty, or transport. NLP sentiment analysis will process it automatically.
                </p>
                <button
                  onClick={() => navigate('/feedback')}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Submit Feedback →
                </button>
              </div>

              {/* Action 2: File Grievance */}
              <div className="bg-gradient-to-br from-slate-900 to-rose-950/40 border border-slate-800 hover:border-rose-500/50 rounded-2xl p-6 shadow-lg transition-all group">
                <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-100 mb-2">Report a Grievance</h3>
                <p className="text-slate-400 text-xs mb-4">
                  Raise an urgent or standard complaint. SLA policies guarantee resolution deadlines with automatic HOD escalation.
                </p>
                <button className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg transition-colors">
                  Raise Grievance →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. STAFF & HOD VIEW */}
        {(user?.role?.name === 'staff' || user?.role?.name === 'hod') && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg">
                <div className="text-slate-400 text-xs font-semibold uppercase mb-1">Assigned Grievances</div>
                <div className="text-3xl font-extrabold text-sky-400">0</div>
                <div className="text-[11px] text-slate-500 mt-2">Active tickets needing resolution</div>
              </div>
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg">
                <div className="text-slate-400 text-xs font-semibold uppercase mb-1">SLA On Track</div>
                <div className="text-3xl font-extrabold text-emerald-400">0</div>
                <div className="text-[11px] text-slate-500 mt-2">Within deadline duration</div>
              </div>
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg">
                <div className="text-slate-400 text-xs font-semibold uppercase mb-1">SLA Warnings</div>
                <div className="text-3xl font-extrabold text-amber-400">0</div>
                <div className="text-[11px] text-slate-500 mt-2">80% duration elapsed</div>
              </div>
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg">
                <div className="text-slate-400 text-xs font-semibold uppercase mb-1">Resolved Tickets</div>
                <div className="text-3xl font-extrabold text-purple-400">0</div>
                <div className="text-[11px] text-slate-500 mt-2">Successfully closed</div>
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-slate-100 mb-4 flex items-center space-x-2">
                <Clock className="w-5 h-5 text-sky-400" />
                <span>My Assigned Work Queue (Phase 6 Integration)</span>
              </h3>
              <div className="p-8 text-center bg-slate-950/60 rounded-xl border border-dashed border-slate-800 text-slate-400 text-sm">
                No active grievances assigned currently. New tickets assigned to your department will appear here.
              </div>
            </div>
          </div>
        )}

        {/* 3. ADMIN VIEW (User & Role Management Table) */}
        {user?.role?.name === 'admin' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
                  <Shield className="w-5 h-5 text-purple-400" />
                  <span>User & RBAC Access Management</span>
                </h2>
                <p className="text-slate-400 text-xs mt-0.5">
                  Manage campus users, inspect assigned roles, and execute admin password resets.
                </p>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={fetchUsers}
                  className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-colors"
                  title="Refresh Users"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingUsers ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Filters Bar */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row gap-4 justify-between items-center">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                  placeholder="Search by name or email..."
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl py-2 pl-9 pr-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center space-x-3 w-full sm:w-auto">
                <Filter className="w-4 h-4 text-slate-400" />
                <select
                  value={roleFilter}
                  onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
                  className="bg-slate-950 border border-slate-700/80 text-xs text-slate-200 rounded-xl py-2 px-3 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">All Roles</option>
                  <option value="student">Students Only</option>
                  <option value="staff">Staff Only</option>
                  <option value="hod">HODs Only</option>
                  <option value="admin">Admins Only</option>
                </select>
                <span className="text-xs text-slate-400 whitespace-nowrap">
                  Total: <strong className="text-slate-200">{totalUsers}</strong>
                </span>
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              {loadingUsers ? (
                <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center space-y-3">
                  <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                  <span>Loading User Directory...</span>
                </div>
              ) : usersList.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  No users matching the search filter.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="py-3.5 px-4 font-semibold">User Details</th>
                        <th className="py-3.5 px-4 font-semibold">Role</th>
                        <th className="py-3.5 px-4 font-semibold">Profile Details</th>
                        <th className="py-3.5 px-4 font-semibold">Status</th>
                        <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {usersList.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-100">{u.full_name}</div>
                            <div className="text-[11px] text-slate-400">{u.email}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-indigo-300 border border-slate-700">
                              {u.role.name}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-400">
                            {u.student_profile && (
                              <div>
                                <span className="font-mono text-emerald-400">{u.student_profile.student_id}</span> • {u.student_profile.course_name}
                              </div>
                            )}
                            {u.staff_profile && (
                              <div>
                                <span className="font-mono text-sky-400">{u.staff_profile.employee_id}</span> • {u.staff_profile.designation}
                              </div>
                            )}
                            {!u.student_profile && !u.staff_profile && (
                              <span className="text-slate-500 italic">System Admin</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center space-x-1 text-emerald-400 font-medium">
                              <CheckCircle className="w-3.5 h-3.5" />
                              <span>Active</span>
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => setSelectedUser(u)}
                              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 rounded-lg font-medium inline-flex items-center space-x-1.5 transition-colors"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                              <span>Reset Password</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-between items-center text-xs">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg disabled:opacity-40"
                  >
                    ← Previous
                  </button>
                  <span className="text-slate-400">
                    Page <strong className="text-slate-200">{page}</strong> of <strong className="text-slate-200">{totalPages}</strong>
                  </span>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg disabled:opacity-40"
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Admin Reset Password Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-100 flex items-center space-x-2">
              <KeyRound className="w-5 h-5 text-purple-400" />
              <span>Admin Password Reset</span>
            </h3>
            <p className="text-xs text-slate-400">
              Reset password for user: <strong className="text-slate-200">{selectedUser.email}</strong> ({selectedUser.full_name}).
            </p>

            {resetMessage && (
              <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs">
                {resetMessage}
              </div>
            )}

            <form onSubmit={handleAdminPasswordReset} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 px-3 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5"
                >
                  {resetLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Update Password</span>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
