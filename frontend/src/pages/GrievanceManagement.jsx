import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';
import api from '../services/api';
import {
  Shield, AlertTriangle, Search, Filter, RefreshCw, Clock,
  CheckCircle2, XCircle, AlertCircle, ChevronRight, ChevronLeft,
  X, UserCheck, Play, Check, RotateCcw, Loader2, User,
  Building2, Tag, Layers, ArrowUpRight, Eye
} from 'lucide-react';

const priorityConfig = {
  urgent: { label: 'Urgent', sla: '4h', color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/30' },
  high:   { label: 'High',   sla: '24h', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30' },
  medium: { label: 'Medium', sla: '3d', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' },
  low:    { label: 'Low',    sla: '5d', color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/30' },
};

const statusConfig = {
  open:        { label: 'Open', color: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/30' },
  in_progress: { label: 'In Progress', color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/30' },
  resolved:    { label: 'Resolved', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
  closed:      { label: 'Closed', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/30' },
  reopened:    { label: 'Reopened', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' },
};

const slaStatusConfig = {
  on_track:  { label: 'On Track', color: 'text-emerald-400', bar: 'bg-emerald-500' },
  warning:   { label: 'Warning', color: 'text-amber-400', bar: 'bg-amber-500' },
  breached:  { label: 'Breached', color: 'text-rose-400', bar: 'bg-rose-500' },
  completed: { label: 'Completed', color: 'text-purple-400', bar: 'bg-purple-500' },
};

// ─── Staff Assignment Modal ───────────────────────────────────────────────────

function AssignStaffModal({ grievance, staffList, onClose, onSuccess }) {
  const [selectedStaffId, setSelectedStaffId] = useState(grievance?.assigned_staff_id || '');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!grievance) return null;

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!selectedStaffId) return;
    setSubmitting(true);
    setError('');
    try {
      await api.patch(`/grievances/${grievance.id}/assign`, {
        assigned_staff_id: selectedStaffId,
        comment: comment || undefined,
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to assign staff.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white flex items-center space-x-2">
            <UserCheck className="w-5 h-5 text-indigo-400" />
            <span>Assign Grievance Staff</span>
          </h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-400">
          Ticket: <strong className="text-indigo-300 font-mono">{grievance.ticket_number}</strong> — {grievance.title}
        </p>

        {error && <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs">{error}</div>}

        <form onSubmit={handleAssign} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Select Staff Member
            </label>
            <select
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              required
              className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 px-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="">— Select Staff —</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.user?.full_name || s.employee_id} ({s.designation || 'Staff'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Assignment Note (Optional)
            </label>
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="e.g. Please inspect hardware today"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 px-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !selectedStaffId}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Confirm Assignment</span>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Status Transition Modal ──────────────────────────────────────────────────

function StatusUpdateModal({ grievance, targetStatus, onClose, onSuccess }) {
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!grievance || !targetStatus) return null;

  const targetLabel = statusConfig[targetStatus]?.label || targetStatus;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.patch(`/grievances/${grievance.id}/status`, {
        status: targetStatus,
        comment: comment || undefined,
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error?.message || `Failed to update status to ${targetStatus}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white flex items-center space-x-2">
            <Play className="w-5 h-5 text-emerald-400" />
            <span>Update Status → {targetLabel}</span>
          </h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-400">
          Ticket: <strong className="text-indigo-300 font-mono">{grievance.ticket_number}</strong>
        </p>

        {error && <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Action Remarks / Resolution Details
            </label>
            <textarea
              rows={3}
              required={targetStatus === 'resolved'}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={
                targetStatus === 'resolved'
                  ? 'Describe the solution implemented...'
                  : 'Add notes about investigation or next steps...'
              }
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 resize-none"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Confirm Status Update</span>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Detail View Modal ─────────────────────────────────────────────────────────

function GrievanceDetailModal({ grievance, onClose }) {
  if (!grievance) return null;

  const statusInfo = statusConfig[grievance.status] || statusConfig.open;
  const prioInfo = priorityConfig[grievance.priority] || priorityConfig.medium;
  const slaInfo = grievance.current_sla ? (slaStatusConfig[grievance.current_sla.status] || slaStatusConfig.on_track) : null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
              <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-950 text-indigo-300 border border-slate-800">
                {grievance.ticket_number}
              </span>
              <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${statusInfo.bg} ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
              <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${prioInfo.bg} ${prioInfo.color}`}>
                {prioInfo.label}
              </span>
            </div>
            <h3 className="text-lg font-bold text-white mt-2">{grievance.title}</h3>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/60 p-4 rounded-2xl border border-slate-800 text-xs">
          <div>
            <span className="text-slate-500 block">Student</span>
            <span className="font-semibold text-slate-200">{grievance.student?.user_full_name || 'N/A'}</span>
            <span className="text-[10px] text-slate-500 block font-mono">{grievance.student?.student_id}</span>
          </div>
          <div>
            <span className="text-slate-500 block">Department</span>
            <span className="font-semibold text-slate-200">{grievance.department?.name || 'N/A'}</span>
          </div>
          <div>
            <span className="text-slate-500 block">Assigned Staff</span>
            <span className="font-semibold text-slate-200">{grievance.assigned_staff?.user_full_name || 'Unassigned'}</span>
          </div>
          <div>
            <span className="text-slate-500 block">Date Filed</span>
            <span className="font-semibold text-slate-200">
              {new Date(grievance.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Complaint Content</h4>
          <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800 text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
            {grievance.description}
          </div>
        </div>

        {grievance.current_sla && (
          <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-200 flex items-center space-x-1.5">
                <Clock className="w-4 h-4 text-indigo-400" />
                <span>SLA Resolution Progress</span>
              </span>
              <span className={`font-bold ${slaInfo?.color}`}>{slaInfo?.label}</span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div className={`h-full ${slaInfo?.bar}`} style={{ width: `${grievance.current_sla.percentage_elapsed || 0}%` }} />
            </div>
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>{grievance.current_sla.percentage_elapsed}% Elapsed</span>
              <span>
                {grievance.current_sla.completed_at
                  ? 'Completed'
                  : `${grievance.current_sla.time_remaining_minutes} mins remaining`}
              </span>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>Updates & Resolution History</span>
          </h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {grievance.updates?.map((up) => (
              <div key={up.id} className="bg-slate-950/40 p-3 rounded-xl border border-slate-800 text-xs space-y-1">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span className="font-semibold text-slate-300">{up.updater_name} ({up.updater_role})</span>
                  <span>{new Date(up.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</span>
                </div>
                <div className="text-slate-300">{up.comment || `Status: ${up.new_status}`}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main GrievanceManagement Page ───────────────────────────────────────────

export function GrievanceManagement() {
  const { user } = useAuth();
  const callerRole = user?.role?.name || 'staff';

  const [grievances, setGrievances] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Pagination & Filters
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [slaFilter, setSlaFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [assigningGrievance, setAssigningGrievance] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(null); // { grievance, targetStatus }
  const [viewingGrievance, setViewingGrievance] = useState(null);

  // Metric stats
  const [metrics, setMetrics] = useState({ total: 0, open: 0, in_progress: 0, warning: 0, breached: 0, resolved: 0 });

  const fetchDependencies = useCallback(async () => {
    try {
      const [deptRes, catRes, staffRes] = await Promise.all([
        api.get('/departments?page=1&page_size=100'),
        api.get('/categories?page=1&page_size=200'),
        api.get('/staff?page=1&page_size=200'),
      ]);
      setDepartments(deptRes.data.items || []);
      setCategories(catRes.data.items || []);
      setStaffList(staffRes.data.items || []);
    } catch (e) {
      console.warn('Failed to load dependencies:', e);
    }
  }, []);

  const fetchGrievances = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `/grievances?page=${page}&page_size=15`;
      if (statusFilter) url += `&status=${statusFilter}`;
      if (priorityFilter) url += `&priority=${priorityFilter}`;
      if (deptFilter && callerRole === 'admin') url += `&department_id=${deptFilter}`;
      if (slaFilter) url += `&sla_status=${slaFilter}`;
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;

      const res = await api.get(url);
      const items = res.data.items || [];
      setGrievances(items);
      setTotal(res.data.total || 0);
      setTotalPages(res.data.total_pages || 1);

      // Compute quick stats
      const op = items.filter((g) => g.status === 'open').length;
      const inp = items.filter((g) => g.status === 'in_progress' || g.status === 'reopened').length;
      const resCount = items.filter((g) => g.status === 'resolved' || g.status === 'closed').length;
      const warnCount = items.filter((g) => g.current_sla?.status === 'warning').length;
      const breachCount = items.filter((g) => g.current_sla?.status === 'breached').length;

      setMetrics({
        total: res.data.total || 0,
        open: op,
        in_progress: inp,
        warning: warnCount,
        breached: breachCount,
        resolved: resCount,
      });
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load grievance queue.');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, priorityFilter, deptFilter, slaFilter, searchQuery, callerRole]);

  useEffect(() => {
    fetchDependencies();
  }, [fetchDependencies]);

  useEffect(() => {
    fetchGrievances();
  }, [fetchGrievances]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950/30 to-slate-900 border border-slate-800 p-6 sm:p-8 rounded-3xl backdrop-blur-xl shadow-2xl">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-3">
              <Shield className="w-3.5 h-3.5" />
              <span>Operational Grievance Center</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Grievance & SLA Management</h1>
            <p className="text-slate-400 text-sm mt-1">
              Investigate tickets, assign staff, enforce SLA resolution deadlines, and maintain resolution audits
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => fetchGrievances()}
              className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl border border-slate-700 transition-colors"
              title="Refresh Records"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Metric Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg">
            <div className="text-[11px] text-slate-400 uppercase font-semibold">Total Tickets</div>
            <div className="text-2xl font-bold text-white mt-1">{total}</div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg">
            <div className="text-[11px] text-sky-400 uppercase font-semibold">Open</div>
            <div className="text-2xl font-bold text-sky-400 mt-1">{metrics.open}</div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg">
            <div className="text-[11px] text-indigo-400 uppercase font-semibold">In Progress</div>
            <div className="text-2xl font-bold text-indigo-400 mt-1">{metrics.in_progress}</div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg">
            <div className="text-[11px] text-amber-400 uppercase font-semibold">SLA Warning</div>
            <div className="text-2xl font-bold text-amber-400 mt-1">{metrics.warning}</div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg">
            <div className="text-[11px] text-rose-400 uppercase font-semibold">SLA Breached</div>
            <div className="text-2xl font-bold text-rose-400 mt-1">{metrics.breached}</div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-lg">
            <div className="text-[11px] text-emerald-400 uppercase font-semibold">Resolved</div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">{metrics.resolved}</div>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row gap-3 justify-between items-center">
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              placeholder="Search ticket #, title, description..."
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl py-2 pl-10 pr-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            {callerRole === 'admin' && (
              <select
                value={deptFilter}
                onChange={(e) => { setDeptFilter(e.target.value); setPage(1); }}
                className="bg-slate-950 border border-slate-700/80 text-xs text-slate-200 rounded-xl py-2 px-3 focus:outline-none focus:border-indigo-500"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            )}

            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="bg-slate-950 border border-slate-700/80 text-xs text-slate-200 rounded-xl py-2 px-3 focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
              <option value="reopened">Reopened</option>
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}
              className="bg-slate-950 border border-slate-700/80 text-xs text-slate-200 rounded-xl py-2 px-3 focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <select
              value={slaFilter}
              onChange={(e) => { setSlaFilter(e.target.value); setPage(1); }}
              className="bg-slate-950 border border-slate-700/80 text-xs text-slate-200 rounded-xl py-2 px-3 focus:outline-none focus:border-indigo-500"
            >
              <option value="">All SLA States</option>
              <option value="on_track">On Track</option>
              <option value="warning">Warning (80%+)</option>
              <option value="breached">Breached</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        {/* Table View */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          {loading ? (
            <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
              <span>Loading Grievance Queue...</span>
            </div>
          ) : error ? (
            <div className="p-6 text-center text-rose-400 text-xs">{error}</div>
          ) : grievances.length === 0 ? (
            <div className="p-16 text-center text-slate-400">No grievances matching current filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3.5 px-4 font-semibold">Ticket & Title</th>
                    <th className="py-3.5 px-4 font-semibold">Student</th>
                    <th className="py-3.5 px-4 font-semibold">Priority / Status</th>
                    <th className="py-3.5 px-4 font-semibold">SLA Status</th>
                    <th className="py-3.5 px-4 font-semibold">Assigned Staff</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {grievances.map((g) => {
                    const statusInfo = statusConfig[g.status] || statusConfig.open;
                    const prioInfo = priorityConfig[g.priority] || priorityConfig.medium;
                    const slaInfo = g.current_sla ? (slaStatusConfig[g.current_sla.status] || slaStatusConfig.on_track) : null;

                    return (
                      <tr key={g.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-4 max-w-xs">
                          <div className="font-mono text-[11px] font-bold text-indigo-300">{g.ticket_number}</div>
                          <div className="font-semibold text-slate-100 truncate">{g.title}</div>
                          <div className="text-[11px] text-slate-400">{g.category?.name}</div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-medium text-slate-200">{g.student?.user_full_name || 'N/A'}</div>
                          <div className="text-[11px] text-slate-500 font-mono">{g.student?.student_id}</div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex flex-col space-y-1">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase w-max border ${prioInfo.bg} ${prioInfo.color}`}>
                              {prioInfo.label}
                            </span>
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase w-max border ${statusInfo.bg} ${statusInfo.color}`}>
                              {statusInfo.label}
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          {g.current_sla ? (
                            <div className="space-y-1">
                              <span className={`font-semibold ${slaInfo?.color}`}>{slaInfo?.label}</span>
                              <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div className={`h-full ${slaInfo?.bar}`} style={{ width: `${g.current_sla.percentage_elapsed || 0}%` }} />
                              </div>
                              <span className="text-[10px] text-slate-500 block">
                                {g.current_sla.completed_at ? 'Completed' : `${g.current_sla.time_remaining_minutes}m left`}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-500 italic">—</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          {g.assigned_staff ? (
                            <div>
                              <span className="font-medium text-slate-200">{g.assigned_staff.user_full_name}</span>
                              <span className="text-[10px] text-slate-500 block">{g.assigned_staff.designation}</span>
                            </div>
                          ) : (
                            <span className="text-amber-400/80 font-medium italic">Unassigned</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            {/* Workflow action buttons */}
                            {g.status === 'open' && (
                              <button
                                onClick={() => setUpdatingStatus({ grievance: g, targetStatus: 'in_progress' })}
                                className="px-2.5 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs font-semibold flex items-center space-x-1"
                                title="Start Work"
                              >
                                <Play className="w-3 h-3" />
                                <span>Start</span>
                              </button>
                            )}

                            {g.status === 'in_progress' && (
                              <button
                                onClick={() => setUpdatingStatus({ grievance: g, targetStatus: 'resolved' })}
                                className="px-2.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-semibold flex items-center space-x-1"
                                title="Resolve"
                              >
                                <Check className="w-3 h-3" />
                                <span>Resolve</span>
                              </button>
                            )}

                            {g.status === 'reopened' && (
                              <button
                                onClick={() => setUpdatingStatus({ grievance: g, targetStatus: 'in_progress' })}
                                className="px-2.5 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-semibold flex items-center space-x-1"
                                title="Resume Work"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Resume</span>
                              </button>
                            )}

                            {(callerRole === 'admin' || callerRole === 'hod') && g.status !== 'closed' && (
                              <button
                                onClick={() => setAssigningGrievance(g)}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors"
                                title="Assign Staff"
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              onClick={() => setViewingGrievance(g)}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors"
                              title="View Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
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
      </main>

      {/* Modals */}
      <AssignStaffModal
        grievance={assigningGrievance}
        staffList={staffList}
        onClose={() => setAssigningGrievance(null)}
        onSuccess={fetchGrievances}
      />

      <StatusUpdateModal
        grievance={updatingStatus?.grievance}
        targetStatus={updatingStatus?.targetStatus}
        onClose={() => setUpdatingStatus(null)}
        onSuccess={fetchGrievances}
      />

      <GrievanceDetailModal
        grievance={viewingGrievance}
        onClose={() => setViewingGrievance(null)}
      />
    </div>
  );
}
