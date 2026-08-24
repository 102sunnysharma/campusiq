import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import api from '../services/api';
import {
  Bell, CheckCircle2, AlertTriangle, MessageSquare, ShieldAlert,
  Clock, Check, Filter, RefreshCw, RotateCcw, ArrowRight,
  ExternalLink, Layers, Loader2, Sparkles
} from 'lucide-react';

const typeConfig = {
  grievance_submitted:     { label: 'Grievance Filed', icon: AlertTriangle, color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/30' },
  grievance_assigned:      { label: 'Staff Assigned',  icon: AlertTriangle, color: 'text-sky-400',    bg: 'bg-sky-500/10 border-sky-500/30' },
  grievance_status_changed: { label: 'Status Update',   icon: Clock,         color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/30' },
  grievance_reopened:      { label: 'Ticket Reopened', icon: RotateCcw,     color: 'text-rose-400',   bg: 'bg-rose-500/10 border-rose-500/30' },
  sla_warning:             { label: 'SLA Warning',     icon: AlertTriangle, color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/30' },
  sla_breached:            { label: 'SLA Breached',    icon: ShieldAlert,   color: 'text-rose-400',   bg: 'bg-rose-500/10 border-rose-500/30' },
  feedback_analyzed:       { label: 'Feedback Analyzed',icon: MessageSquare,color: 'text-emerald-400',bg: 'bg-emerald-500/10 border-emerald-500/30' },
};

export function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filters
  const [readFilter, setReadFilter] = useState(''); // '' for all, 'false' for unread, 'true' for read
  const [typeFilter, setTypeFilter] = useState('');

  const navigate = useNavigate();

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `/notifications?page=${page}&page_size=15`;
      if (readFilter !== '') url += `&is_read=${readFilter}`;
      if (typeFilter) url += `&type=${typeFilter}`;

      const res = await api.get(url);
      setNotifications(res.data.items || []);
      setTotal(res.data.total || 0);
      setTotalPages(res.data.total_pages || 1);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  }, [page, readFilter, typeFilter]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkSingleRead = async (notif, e) => {
    e.stopPropagation();
    if (notif.is_read) return;
    try {
      await api.patch(`/notifications/${notif.id}/mark-read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
      );
    } catch (err) {
      console.warn('Failed to mark read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.patch('/notifications/mark-all-read');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (e) {
      console.warn('Failed to mark all as read:', e);
    }
  };

  const handleCardClick = async (notif) => {
    if (!notif.is_read) {
      try {
        await api.patch(`/notifications/${notif.id}/mark-read`);
      } catch (e) {}
    }
    if (notif.reference_type === 'grievance') {
      navigate('/grievances');
    } else if (notif.reference_type === 'feedback') {
      navigate('/feedback');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950/30 to-slate-900 border border-slate-800 p-6 sm:p-8 rounded-3xl backdrop-blur-xl shadow-2xl">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-3">
              <Bell className="w-3.5 h-3.5" />
              <span>Campus Notification Center</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Notifications & Alerts</h1>
            <p className="text-slate-400 text-sm mt-1">
              Real-time updates on your grievances, SLA milestones, and feedback analysis
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleMarkAllRead}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors"
            >
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Mark All as Read</span>
            </button>
            <button
              onClick={fetchNotifications}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filters Toolbar */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => { setReadFilter(''); setPage(1); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                readFilter === '' ? 'bg-indigo-600 text-white' : 'bg-slate-800/80 text-slate-400 hover:text-white'
              }`}
            >
              All Notifications ({total})
            </button>
            <button
              onClick={() => { setReadFilter('false'); setPage(1); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                readFilter === 'false' ? 'bg-indigo-600 text-white' : 'bg-slate-800/80 text-slate-400 hover:text-white'
              }`}
            >
              Unread Only
            </button>
            <button
              onClick={() => { setReadFilter('true'); setPage(1); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                readFilter === 'true' ? 'bg-indigo-600 text-white' : 'bg-slate-800/80 text-slate-400 hover:text-white'
              }`}
            >
              Read
            </button>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
              className="bg-slate-950 border border-slate-700/80 text-xs text-slate-200 rounded-xl py-2 px-3 focus:outline-none focus:border-indigo-500 w-full sm:w-auto"
            >
              <option value="">All Categories</option>
              <option value="grievance_submitted">Grievance Filed</option>
              <option value="grievance_assigned">Staff Assigned</option>
              <option value="grievance_status_changed">Status Updates</option>
              <option value="grievance_reopened">Tickets Reopened</option>
              <option value="sla_warning">SLA Warnings</option>
              <option value="sla_breached">SLA Breaches</option>
              <option value="feedback_analyzed">Feedback Insights</option>
            </select>
          </div>
        </div>

        {/* Notifications List */}
        {loading ? (
          <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
            <span>Loading notifications...</span>
          </div>
        ) : error ? (
          <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            {error}
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-16 text-center bg-slate-900/60 rounded-3xl border border-dashed border-slate-800 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto text-slate-500">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-300">No Notifications</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              You do not have any notifications in this view.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notif) => {
              const conf = typeConfig[notif.type] || { label: 'Notice', icon: Bell, color: 'text-slate-400', bg: 'bg-slate-800/80 border-slate-700' };
              const IconComponent = conf.icon;

              return (
                <div
                  key={notif.id}
                  onClick={() => handleCardClick(notif)}
                  className={`border rounded-2xl p-5 transition-all cursor-pointer group flex items-start space-x-4 shadow-lg ${
                    !notif.is_read
                      ? 'bg-slate-900 border-indigo-500/40 hover:border-indigo-500/80 shadow-indigo-500/5'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 opacity-80'
                  }`}
                >
                  <div className={`p-3 rounded-2xl border ${conf.bg} ${conf.color} shrink-0 mt-0.5 group-hover:scale-105 transition-transform`}>
                    <IconComponent className="w-5 h-5" />
                  </div>

                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-bold text-slate-100 group-hover:text-indigo-300 transition-colors">
                          {notif.title}
                        </span>
                        {!notif.is_read && (
                          <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0 animate-ping" />
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500">
                        {new Date(notif.created_at).toLocaleString('en-IN', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">{notif.message}</p>

                    <div className="pt-2 flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${conf.bg} ${conf.color}`}>
                          {conf.label}
                        </span>
                        {notif.reference_type && (
                          <span className="text-[11px] text-slate-500 uppercase tracking-wider">
                            Ref: {notif.reference_type}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-3">
                        {!notif.is_read && (
                          <button
                            onClick={(e) => handleMarkSingleRead(notif, e)}
                            className="text-[11px] text-slate-400 hover:text-emerald-400 flex items-center space-x-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Mark read</span>
                          </button>
                        )}
                        <span className="text-indigo-400 text-xs font-semibold flex items-center space-x-1 group-hover:translate-x-1 transition-transform">
                          <span>View Detail</span>
                          <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  </div>
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
    </div>
  );
}
