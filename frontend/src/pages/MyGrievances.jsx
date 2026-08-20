import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from '../components/Navbar';
import api from '../services/api';
import {
  AlertTriangle, Plus, Search, Filter, RefreshCw, Clock,
  CheckCircle2, XCircle, AlertCircle, ChevronRight, ChevronLeft,
  X, Send, ArrowRight, ShieldAlert, Sparkles, Building2, Tag,
  FileText, CornerDownRight, RotateCcw, Check, Loader2, User,
  Calendar, Layers, Activity
} from 'lucide-react';

const priorityConfig = {
  urgent: { label: 'Urgent', sla: '4 Hours', color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/30' },
  high:   { label: 'High',   sla: '24 Hours', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30' },
  medium: { label: 'Medium', sla: '3 Days', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' },
  low:    { label: 'Low',    sla: '5 Days', color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/30' },
};

const statusConfig = {
  open:        { label: 'Open', color: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/30' },
  in_progress: { label: 'In Progress', color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/30' },
  resolved:    { label: 'Resolved (Needs Review)', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
  closed:      { label: 'Closed', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/30' },
  reopened:    { label: 'Reopened', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' },
};

const slaStatusConfig = {
  on_track:  { label: 'SLA On Track', color: 'text-emerald-400', bar: 'bg-emerald-500' },
  warning:   { label: 'SLA Warning (80%+)', color: 'text-amber-400', bar: 'bg-amber-500' },
  breached:  { label: 'SLA Breached', color: 'text-rose-400', bar: 'bg-rose-500' },
  completed: { label: 'SLA Completed', color: 'text-purple-400', bar: 'bg-purple-500' },
};

// ─── Grievance Submission Modal ───────────────────────────────────────────────

function SubmitGrievanceModal({ isOpen, onClose, onSuccess, categories }) {
  const [form, setForm] = useState({
    category_id: '',
    title: '',
    description: '',
    priority: 'medium',
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  if (!isOpen) return null;

  const validate = () => {
    const errs = {};
    if (!form.category_id) errs.category_id = 'Please select a category.';
    if (!form.title.trim() || form.title.trim().length < 3)
      errs.title = 'Title must be at least 3 characters.';
    if (!form.description.trim() || form.description.trim().length < 10)
      errs.description = 'Description must be at least 10 characters.';
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setSubmitError('');
    setSubmitting(true);

    try {
      await api.post('/grievances', form);
      onSuccess();
      onClose();
      setForm({ category_id: '', title: '', description: '', priority: 'medium' });
    } catch (err) {
      setSubmitError(err.response?.data?.error?.message || 'Failed to submit grievance. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Report New Grievance</h3>
              <p className="text-xs text-slate-400">Your complaint will be assigned with a guaranteed SLA deadline</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {submitError && (
          <div className="m-6 mb-0 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Category <span className="text-rose-400">*</span>
            </label>
            <select
              value={form.category_id}
              onChange={(e) => setForm((p) => ({ ...p, category_id: e.target.value }))}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl py-2.5 px-4 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="">— Select Category (Auto-assigns Department) —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {errors.category_id && <p className="text-rose-400 text-xs mt-1">{errors.category_id}</p>}
          </div>

          {/* Title */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Grievance Title <span className="text-rose-400">*</span>
              </label>
              <span className="text-[11px] text-slate-500">{form.title.length}/200</span>
            </div>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="e.g., Computer Lab 302 AC not working properly"
              maxLength={200}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl py-2.5 px-4 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            {errors.title && <p className="text-rose-400 text-xs mt-1">{errors.title}</p>}
          </div>

          {/* Priority selection cards */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Select Priority (SLA Resolution Target)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {['low', 'medium', 'high', 'urgent'].map((pKey) => {
                const p = priorityConfig[pKey];
                const isSelected = form.priority === pKey;
                return (
                  <button
                    key={pKey}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, priority: pKey }))}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      isSelected
                        ? `${p.bg} border-indigo-500/80 shadow-lg`
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className={`text-xs font-bold ${p.color}`}>{p.label}</div>
                    <div className="text-[11px] text-slate-400 mt-1 flex items-center space-x-1">
                      <Clock className="w-3 h-3" />
                      <span>{p.sla}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Detailed Description <span className="text-rose-400">*</span>
              </label>
              <span className="text-[11px] text-slate-500">{form.description.length}/10000</span>
            </div>
            <textarea
              rows={4}
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Describe what happened, location, when it started, and impact..."
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-4 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
            />
            {errors.description && <p className="text-rose-400 text-xs mt-1">{errors.description}</p>}
          </div>

          <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center space-x-2 shadow-lg shadow-rose-500/20"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting Ticket...</span>
                </>
              ) : (
                <>
                  <span>File Grievance</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Grievance Detail & Resolution Review Modal ───────────────────────────────

function GrievanceDetailModal({ grievance, onClose, onActionSuccess }) {
  const [comment, setComment] = useState('');
  const [reopenReason, setReopenReason] = useState('');
  const [showReopenInput, setShowReopenInput] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!grievance) return null;

  const statusInfo = statusConfig[grievance.status] || statusConfig.open;
  const prioInfo = priorityConfig[grievance.priority] || priorityConfig.medium;
  const slaInfo = grievance.current_sla ? (slaStatusConfig[grievance.current_sla.status] || slaStatusConfig.on_track) : null;

  const handleStatusChange = async (targetStatus, actionComment) => {
    setSubmitting(true);
    setErrorMsg('');
    try {
      await api.patch(`/grievances/${grievance.id}/status`, {
        status: targetStatus,
        comment: actionComment || undefined,
      });
      onActionSuccess();
      onClose();
    } catch (err) {
      setErrorMsg(err.response?.data?.error?.message || `Failed to update status to ${targetStatus}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-start justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
              <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-800 text-indigo-300 border border-slate-700">
                {grievance.ticket_number}
              </span>
              <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${statusInfo.bg} ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
              <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${prioInfo.bg} ${prioInfo.color}`}>
                {prioInfo.label} Priority
              </span>
            </div>
            <h2 className="text-lg font-bold text-white mt-2">{grievance.title}</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mx-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="px-6 space-y-6">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/60 p-4 rounded-2xl border border-slate-800 text-xs">
            <div>
              <span className="text-slate-500 block">Department</span>
              <span className="font-semibold text-slate-200">{grievance.department?.name || 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Category</span>
              <span className="font-semibold text-slate-200">{grievance.category?.name || 'N/A'}</span>
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

          {/* Description */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Complaint Details</h4>
            <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800/80 text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
              {grievance.description}
            </div>
          </div>

          {/* SLA Tracking Bar */}
          {grievance.current_sla && (
            <div className="space-y-2 bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-indigo-400" />
                  <span className="font-semibold text-slate-200">SLA Resolution Timer</span>
                </div>
                <span className={`font-bold ${slaInfo?.color}`}>{slaInfo?.label}</span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full ${slaInfo?.bar} transition-all duration-500`}
                  style={{ width: `${grievance.current_sla.percentage_elapsed || 0}%` }}
                />
              </div>

              <div className="flex justify-between text-[11px] text-slate-400 pt-1">
                <span>Started: {new Date(grievance.current_sla.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <span>
                  {grievance.current_sla.completed_at ? (
                    <span className="text-purple-400 font-semibold">Completed</span>
                  ) : (
                    <span>
                      {grievance.current_sla.time_remaining_minutes > 0
                        ? `${grievance.current_sla.time_remaining_minutes} mins remaining`
                        : `${Math.abs(grievance.current_sla.time_remaining_minutes)} mins breached`}
                    </span>
                  )}
                </span>
                <span>Deadline: {new Date(grievance.current_sla.deadline_at).toLocaleDateString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          )}

          {/* Chronological History Updates */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>Activity & Update History</span>
            </h4>
            <div className="space-y-2.5">
              {grievance.updates && grievance.updates.length > 0 ? (
                grievance.updates.map((up) => (
                  <div key={up.id} className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-800 text-xs flex items-start space-x-3">
                    <div className="w-2 h-2 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between text-slate-400 text-[11px]">
                        <span className="font-semibold text-slate-300">
                          {up.updater_name} ({up.updater_role})
                        </span>
                        <span>{new Date(up.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</span>
                      </div>
                      <div className="text-slate-300">{up.comment || `Status changed to ${up.new_status}`}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-slate-500 text-xs italic">No updates logged yet.</div>
              )}
            </div>
          </div>

          {/* STUDENT RESOLUTION ACTION BANNER */}
          {grievance.status === 'resolved' && (
            <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-indigo-950/30 to-slate-900 border border-emerald-500/30 space-y-4">
              <div className="flex items-center space-x-2.5 text-emerald-400 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5" />
                <span>Resolution Proposed — Please Review</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Staff has resolved this grievance. Please confirm if the resolution is satisfactory to close the ticket, or reopen it with your comments.
              </p>

              {!showReopenInput ? (
                <div className="flex space-x-3 pt-2">
                  <button
                    onClick={() => handleStatusChange('closed', 'Student accepted resolution.')}
                    disabled={submitting}
                    className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors"
                  >
                    <Check className="w-4 h-4" />
                    <span>Accept & Close Ticket</span>
                  </button>
                  <button
                    onClick={() => setShowReopenInput(true)}
                    className="flex-1 py-2.5 px-4 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Reject & Reopen Ticket</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3 pt-2">
                  <textarea
                    rows={2}
                    value={reopenReason}
                    onChange={(e) => setReopenReason(e.target.value)}
                    placeholder="Reason why the issue is not resolved..."
                    className="w-full bg-slate-950 border border-amber-500/40 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
                  />
                  <div className="flex justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => setShowReopenInput(false)}
                      className="px-3 py-1.5 bg-slate-800 text-slate-400 rounded-lg text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatusChange('reopened', reopenReason || 'Student reopened ticket.')}
                      disabled={submitting}
                      className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold"
                    >
                      Confirm Reopen
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium"
          >
            Close Dialog
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Student MyGrievances Page ───────────────────────────────────────────

export function MyGrievances() {
  const [grievances, setGrievances] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [selectedGrievance, setSelectedGrievance] = useState(null);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await api.get('/categories?page=1&page_size=100');
      setCategories(res.data.items || []);
    } catch (e) {
      console.warn('Failed to load categories:', e);
    }
  }, []);

  const fetchGrievances = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `/grievances/mine?page=${page}&page_size=10`;
      if (statusFilter) url += `&status=${statusFilter}`;
      if (priorityFilter) url += `&priority=${priorityFilter}`;
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;

      const res = await api.get(url);
      setGrievances(res.data.items || []);
      setTotal(res.data.total || 0);
      setTotalPages(res.data.total_pages || 1);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load grievances history.');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, priorityFilter, searchQuery]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchGrievances();
  }, [fetchGrievances]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-rose-950/30 via-slate-900 to-indigo-950/30 border border-slate-800 p-6 sm:p-8 rounded-3xl backdrop-blur-xl shadow-2xl">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold uppercase tracking-wider mb-3">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>SLA-Protected Grievance Desk</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">My Grievances & Complaints</h1>
            <p className="text-slate-400 text-sm mt-1">
              File official campus complaints with guaranteed resolution deadlines and HOD escalation
            </p>
          </div>

          <button
            onClick={() => setIsSubmitOpen(true)}
            className="px-5 py-3.5 bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white rounded-2xl text-xs font-bold flex items-center justify-center space-x-2 shadow-lg shadow-rose-500/25 transition-all transform active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>File New Grievance</span>
          </button>
        </div>

        {/* Filters Bar */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              placeholder="Search by ticket # or title..."
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl py-2 pl-10 pr-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-slate-400" />
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
              <option value="urgent">Urgent (4h)</option>
              <option value="high">High (24h)</option>
              <option value="medium">Medium (3d)</option>
              <option value="low">Low (5d)</option>
            </select>

            <button
              onClick={fetchGrievances}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Grievance Cards List */}
        {loading ? (
          <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 text-rose-400 animate-spin" />
            <span>Loading Grievance Records...</span>
          </div>
        ) : error ? (
          <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : grievances.length === 0 ? (
          <div className="p-16 text-center bg-slate-900/60 rounded-3xl border border-dashed border-slate-800 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto text-slate-500">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-300">No Grievances Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              You have no active complaints filed. Click "File New Grievance" above if you need assistance.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {grievances.map((g) => {
              const statusInfo = statusConfig[g.status] || statusConfig.open;
              const prioInfo = priorityConfig[g.priority] || priorityConfig.medium;
              const slaInfo = g.current_sla ? (slaStatusConfig[g.current_sla.status] || slaStatusConfig.on_track) : null;

              return (
                <div
                  key={g.id}
                  onClick={() => setSelectedGrievance(g)}
                  className="bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-lg transition-all cursor-pointer group"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                    <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
                      <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-950 text-indigo-300 border border-slate-800">
                        {g.ticket_number}
                      </span>
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${statusInfo.bg} ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${prioInfo.bg} ${prioInfo.color}`}>
                        {prioInfo.label}
                      </span>
                      {g.department && (
                        <span className="text-xs text-slate-400 flex items-center space-x-1">
                          <Building2 className="w-3 h-3 text-slate-500" />
                          <span>{g.department.name}</span>
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-500">
                      Filed on {new Date(g.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>

                  <h3 className="text-sm font-bold text-slate-100 group-hover:text-indigo-300 transition-colors">
                    {g.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {g.description}
                  </p>

                  {/* SLA Bar in card */}
                  {g.current_sla && (
                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div className="flex items-center space-x-2">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span className={`font-semibold ${slaInfo?.color}`}>{slaInfo?.label}</span>
                        <span className="text-slate-500 text-[11px]">
                          ({g.current_sla.completed_at ? 'Resolved' : `${g.current_sla.time_remaining_minutes}m left`})
                        </span>
                      </div>

                      <div className="text-indigo-400 text-xs font-semibold flex items-center space-x-1 group-hover:translate-x-1 transition-transform">
                        <span>View Details & Timeline</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl flex justify-between items-center text-xs">
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
      </main>

      {/* Modals */}
      <SubmitGrievanceModal
        isOpen={isSubmitOpen}
        onClose={() => setIsSubmitOpen(false)}
        onSuccess={fetchGrievances}
        categories={categories}
      />

      <GrievanceDetailModal
        grievance={selectedGrievance}
        onClose={() => setSelectedGrievance(null)}
        onActionSuccess={fetchGrievances}
      />
    </div>
  );
}
