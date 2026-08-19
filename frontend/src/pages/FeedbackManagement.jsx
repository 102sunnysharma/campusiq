import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from '../components/Navbar';
import api from '../services/api';
import {
  BarChart3, Search, SlidersHorizontal, Star, TrendingUp, TrendingDown,
  Minus, AlertCircle, RefreshCw, ChevronLeft, ChevronRight,
  X, EyeOff, Eye, Hash, Tag, Building2, Calendar, Loader2,
  InboxIcon, CheckCircle2, XCircle, Clock, Filter, ChevronDown, ChevronUp,
  Sparkles, MessageSquare
} from 'lucide-react';

// ─── Config ───────────────────────────────────────────────────────────────────

const sentimentConfig = {
  positive: { label: 'Positive', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', Icon: TrendingUp },
  neutral:  { label: 'Neutral',  color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/30',    Icon: Minus },
  negative: { label: 'Negative', color: 'text-rose-400',    bg: 'bg-rose-500/10 border-rose-500/30',     Icon: TrendingDown },
};

const severityConfig = {
  critical: { label: 'Critical', color: 'text-rose-300',   bg: 'bg-rose-500/20 border-rose-500/40' },
  high:     { label: 'High',     color: 'text-orange-300', bg: 'bg-orange-500/20 border-orange-500/40' },
  medium:   { label: 'Medium',   color: 'text-yellow-300', bg: 'bg-yellow-500/20 border-yellow-500/40' },
  low:      { label: 'Low',      color: 'text-slate-400',  bg: 'bg-slate-500/10 border-slate-500/20' },
};

const statusConfig = {
  submitted:       { label: 'Queued', color: 'text-sky-400',     bg: 'bg-sky-500/10 border-sky-500/30',     Icon: Clock },
  analyzed:        { label: 'Done',   color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', Icon: CheckCircle2 },
  analysis_failed: { label: 'Failed', color: 'text-rose-400',    bg: 'bg-rose-500/10 border-rose-500/30',    Icon: XCircle },
};

function StarDisplay({ value }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(s => (
        <Star key={s} className={`w-3.5 h-3.5 ${s <= value ? 'text-amber-400 fill-amber-400' : 'text-slate-600'}`} />
      ))}
    </div>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

function DetailModal({ fb, onClose }) {
  const analysis = fb.analysis;
  const sentCfg = analysis?.sentiment ? sentimentConfig[analysis.sentiment] : null;
  const sevCfg = analysis?.severity ? severityConfig[analysis.severity] : null;
  const SentIcon = sentCfg?.Icon;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Feedback Detail</h3>
              <p className="text-xs text-slate-500">{new Date(fb.created_at).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
              })}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Meta row */}
          <div className="flex flex-wrap gap-2">
            {/* Status */}
            {(() => { const cfg = statusConfig[fb.status] || statusConfig.submitted; const SI = cfg.Icon; return (
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.color}`}>
                <SI className="w-3.5 h-3.5" />{cfg.label}
              </span>
            )})()}
            {/* Sentiment */}
            {sentCfg && SentIcon && (
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${sentCfg.bg} ${sentCfg.color}`}>
                <SentIcon className="w-3.5 h-3.5" />{sentCfg.label}
              </span>
            )}
            {/* Severity */}
            {sevCfg && (
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${sevCfg.bg} ${sevCfg.color}`}>
                {sevCfg.label} Severity
              </span>
            )}
            {/* Anonymous */}
            {fb.is_anonymous && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border bg-slate-800 border-slate-700 text-slate-400">
                <EyeOff className="w-3 h-3" /> Anonymous
              </span>
            )}
          </div>

          {/* Student info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Student</p>
              <p className="text-sm font-semibold text-slate-200 flex items-center gap-1">
                {fb.is_anonymous ? (
                  <><EyeOff className="w-3.5 h-3.5 text-slate-500" /> Anonymous</>
                ) : (
                  fb.student?.user_full_name || '—'
                )}
              </p>
              {!fb.is_anonymous && fb.student?.student_id && (
                <p className="text-xs text-slate-500">{fb.student.student_id}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Category</p>
              <p className="text-sm font-semibold text-slate-200">{fb.category?.name || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Rating</p>
              <StarDisplay value={fb.rating} />
            </div>
            {analysis?.confidence_score != null && (
              <div>
                <p className="text-xs text-slate-500 mb-0.5">NLP Confidence</p>
                <p className="text-sm font-semibold text-slate-200">{Number(analysis.confidence_score).toFixed(1)}%</p>
              </div>
            )}
          </div>

          {/* Content */}
          <div>
            <p className="text-xs text-slate-500 mb-1.5">Feedback Content</p>
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
              <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{fb.content}</p>
            </div>
          </div>

          {/* NLP Results */}
          {analysis?.analysis_status === 'COMPLETED' && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> NLP Analysis
              </p>

              {analysis.category_prediction && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Predicted Category</p>
                  <span className="px-2.5 py-1 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-semibold">
                    {analysis.category_prediction}
                  </span>
                </div>
              )}

              {analysis.keywords && analysis.keywords.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 mb-1.5 flex items-center gap-1"><Hash className="w-3 h-3" /> Keywords</p>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.keywords.map((kw, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs">{kw}</span>
                    ))}
                  </div>
                </div>
              )}

              {analysis.topics && analysis.topics.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 mb-1.5 flex items-center gap-1"><BarChart3 className="w-3 h-3" /> Topics</p>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.topics.map((t, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-md bg-teal-500/10 border border-teal-500/20 text-teal-300 text-xs capitalize">{t}</span>
                    ))}
                  </div>
                </div>
              )}

              {analysis.language && (
                <p className="text-xs text-slate-500">
                  Language detected: <span className="text-slate-300 font-semibold uppercase">{analysis.language}</span>
                  &nbsp;·&nbsp; Model: <span className="text-slate-400">{analysis.model_name} v{analysis.model_version}</span>
                </p>
              )}
            </div>
          )}

          {analysis?.analysis_status === 'FAILED' && (
            <div className="flex items-center gap-2 text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">
              <XCircle className="w-4 h-4 flex-shrink-0" />
              <div>
                <p className="font-semibold">Analysis Failed</p>
                {analysis.error_message && <p className="text-xs mt-0.5 text-rose-500">{analysis.error_message}</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Summary Stats Bar ─────────────────────────────────────────────────────────

function StatPill({ label, value, color = 'text-white' }) {
  return (
    <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl px-4 py-3 flex flex-col items-center min-w-[90px]">
      <span className={`text-xl font-bold ${color}`}>{value}</span>
      <span className="text-xs text-slate-500 mt-0.5 text-center">{label}</span>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export function FeedbackManagement() {
  // Filters
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    category_id: '', department_id: '', sentiment: '', severity: '', rating: '', date_from: '', date_to: ''
  });
  const [showFilters, setShowFilters] = useState(false);

  // Data
  const [feedbacks, setFeedbacks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Stats derived from current page
  const [stats, setStats] = useState({ total: 0, positive: 0, negative: 0, neutral: 0, avgRating: 0 });

  // Detail modal
  const [selectedFb, setSelectedFb] = useState(null);

  const PAGE_SIZE = 20;

  const fetchDependencies = useCallback(async () => {
    try {
      const [catRes, deptRes] = await Promise.all([
        api.get('/categories?page=1&page_size=200'),
        api.get('/departments?page=1&page_size=100'),
      ]);
      setCategories(catRes.data.items || []);
      setDepartments(deptRes.data.items || []);
    } catch { /* non-fatal */ }
  }, []);

  const fetchFeedbacks = useCallback(async (p = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: p, page_size: PAGE_SIZE });
      if (search) params.set('search', search);
      Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });

      const res = await api.get(`/feedback?${params.toString()}`);
      const items = res.data.items || [];
      setFeedbacks(items);
      setTotal(res.data.total || 0);
      setTotalPages(res.data.total_pages || 1);

      // Compute quick stats from current page
      const pos = items.filter(f => f.analysis?.sentiment === 'positive').length;
      const neg = items.filter(f => f.analysis?.sentiment === 'negative').length;
      const neu = items.filter(f => f.analysis?.sentiment === 'neutral').length;
      const avg = items.length ? (items.reduce((s, f) => s + f.rating, 0) / items.length).toFixed(1) : 0;
      setStats({ total: res.data.total, positive: pos, negative: neg, neutral: neu, avgRating: avg });
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load feedback data.');
    } finally {
      setLoading(false);
    }
  }, [search, filters]);

  useEffect(() => { fetchDependencies(); }, [fetchDependencies]);
  useEffect(() => { fetchFeedbacks(page); }, [fetchFeedbacks, page]);

  const handleSearch = (e) => { e.preventDefault(); setPage(1); fetchFeedbacks(1); };
  const clearFilters = () => {
    setFilters({ category_id: '', department_id: '', sentiment: '', severity: '', rating: '', date_from: '', date_to: '' });
    setSearch('');
    setPage(1);
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length + (search ? 1 : 0);

  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar />
      {selectedFb && <DetailModal fb={selectedFb} onClose={() => setSelectedFb(null)} />}

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">

        {/* Page header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Feedback Management</h1>
              <p className="text-sm text-slate-400">Review and analyze student feedback with NLP insights</p>
            </div>
          </div>
          <button
            onClick={() => fetchFeedbacks(page)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-2 rounded-xl transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        {/* Stats pills */}
        <div className="flex flex-wrap gap-3">
          <StatPill label="Total Feedback" value={stats.total} color="text-indigo-300" />
          <StatPill label="Positive" value={stats.positive} color="text-emerald-400" />
          <StatPill label="Neutral" value={stats.neutral} color="text-amber-400" />
          <StatPill label="Negative" value={stats.negative} color="text-rose-400" />
          <StatPill label="Avg Rating ★" value={stats.avgRating} color="text-amber-300" />
        </div>

        {/* Search & Filter bar */}
        <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-4 space-y-3">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                id="feedback-search"
                type="text"
                placeholder="Search feedback content…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-700 hover:border-slate-600 focus:border-indigo-500 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Search
            </button>
            <button
              type="button"
              id="toggle-filters-btn"
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                showFilters || activeFilterCount > 0
                  ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-indigo-600 text-white text-xs">
                  {activeFilterCount}
                </span>
              )}
              {showFilters ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {activeFilterCount > 0 && (
              <button type="button" onClick={clearFilters} className="flex items-center gap-1 px-3 py-2.5 rounded-xl text-xs text-rose-400 border border-rose-500/30 hover:bg-rose-500/10 transition-all">
                <X className="w-3.5 h-3.5" /> Clear
              </button>
            )}
          </form>

          {/* Expanded filters */}
          {showFilters && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-slate-700/50">
              {/* Department */}
              <div>
                <label className="block text-xs text-slate-500 mb-1">Department</label>
                <select
                  value={filters.department_id}
                  onChange={e => setFilters(p => ({ ...p, department_id: e.target.value }))}
                  className="w-full bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">All Departments</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs text-slate-500 mb-1">Category</label>
                <select
                  value={filters.category_id}
                  onChange={e => setFilters(p => ({ ...p, category_id: e.target.value }))}
                  className="w-full bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">All Categories</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* Sentiment */}
              <div>
                <label className="block text-xs text-slate-500 mb-1">Sentiment</label>
                <select
                  value={filters.sentiment}
                  onChange={e => setFilters(p => ({ ...p, sentiment: e.target.value }))}
                  className="w-full bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">Any Sentiment</option>
                  <option value="positive">Positive</option>
                  <option value="neutral">Neutral</option>
                  <option value="negative">Negative</option>
                </select>
              </div>

              {/* Severity */}
              <div>
                <label className="block text-xs text-slate-500 mb-1">Severity</label>
                <select
                  value={filters.severity}
                  onChange={e => setFilters(p => ({ ...p, severity: e.target.value }))}
                  className="w-full bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">Any Severity</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>

              {/* Rating */}
              <div>
                <label className="block text-xs text-slate-500 mb-1">Rating</label>
                <select
                  value={filters.rating}
                  onChange={e => setFilters(p => ({ ...p, rating: e.target.value }))}
                  className="w-full bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">Any Rating</option>
                  {[5,4,3,2,1].map(r => <option key={r} value={r}>{'★'.repeat(r)} ({r} star)</option>)}
                </select>
              </div>

              {/* Date From */}
              <div>
                <label className="block text-xs text-slate-500 mb-1">Date From</label>
                <input
                  type="date"
                  value={filters.date_from}
                  onChange={e => setFilters(p => ({ ...p, date_from: e.target.value }))}
                  className="w-full bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Date To */}
              <div>
                <label className="block text-xs text-slate-500 mb-1">Date To</label>
                <input
                  type="date"
                  value={filters.date_to}
                  onChange={e => setFilters(p => ({ ...p, date_to: e.target.value }))}
                  className="w-full bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-end">
                <button
                  onClick={() => { setPage(1); fetchFeedbacks(1); }}
                  className="w-full px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5"
                >
                  <Filter className="w-3.5 h-3.5" /> Apply
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Table / Cards */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
            <p className="text-sm text-slate-400">Loading feedback…</p>
          </div>
        )}

        {!loading && error && (
          <div className="flex items-center gap-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl px-5 py-4">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-sm">Failed to load feedback</p>
              <p className="text-xs mt-0.5 text-rose-400">{error}</p>
            </div>
          </div>
        )}

        {!loading && !error && feedbacks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-800/60 border border-slate-700 flex items-center justify-center">
              <InboxIcon className="w-8 h-8 text-slate-500" />
            </div>
            <div>
              <p className="font-semibold text-slate-300">No feedback found</p>
              <p className="text-sm text-slate-500 mt-1">
                {activeFilterCount > 0 ? 'Try adjusting or clearing your filters.' : 'No feedback has been submitted yet.'}
              </p>
            </div>
          </div>
        )}

        {!loading && !error && feedbacks.length > 0 && (
          <>
            {/* Feedback table */}
            <div className="bg-slate-800/30 border border-slate-700/60 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700/60 bg-slate-800/60">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Student</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Category</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Rating</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Sentiment</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Severity</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/40">
                  {feedbacks.map(fb => {
                    const analysis = fb.analysis;
                    const sentCfg = analysis?.sentiment ? sentimentConfig[analysis.sentiment] : null;
                    const SentIcon = sentCfg?.Icon;
                    const sevCfg = analysis?.severity ? (severityConfig[analysis.severity] || severityConfig.low) : null;
                    const stCfg = statusConfig[fb.status] || statusConfig.submitted;
                    const StIcon = stCfg.Icon;

                    return (
                      <tr
                        key={fb.id}
                        onClick={() => setSelectedFb(fb)}
                        className="hover:bg-slate-700/30 cursor-pointer transition-colors group"
                      >
                        <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                          {new Date(fb.created_at).toLocaleDateString('en-IN', {
                            day: 'numeric', month: 'short', year: 'numeric'
                          })}
                        </td>
                        <td className="px-4 py-3">
                          {fb.is_anonymous ? (
                            <span className="flex items-center gap-1 text-slate-500 text-xs">
                              <EyeOff className="w-3.5 h-3.5" /> Anonymous
                            </span>
                          ) : (
                            <div>
                              <p className="text-slate-200 text-xs font-medium leading-tight">{fb.student?.user_full_name || '—'}</p>
                              <p className="text-slate-500 text-xs">{fb.student?.student_id}</p>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-slate-300 text-xs">{fb.category?.name || '—'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <StarDisplay value={fb.rating} />
                        </td>
                        <td className="px-4 py-3">
                          {sentCfg && SentIcon ? (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${sentCfg.bg} ${sentCfg.color}`}>
                              <SentIcon className="w-3 h-3" />{sentCfg.label}
                            </span>
                          ) : (
                            <span className="text-slate-600 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {sevCfg ? (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${sevCfg.bg} ${sevCfg.color}`}>
                              {sevCfg.label}
                            </span>
                          ) : (
                            <span className="text-slate-600 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${stCfg.bg} ${stCfg.color}`}>
                            <StIcon className="w-3 h-3" />{stCfg.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} of {total} entries
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-xs disabled:opacity-40 hover:border-slate-600 transition-all"
                >
                  <ChevronLeft className="w-4 h-4" /> Prev
                </button>
                {/* Page numbers */}
                <div className="flex gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pg = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                    if (pg < 1 || pg > totalPages) return null;
                    return (
                      <button
                        key={pg}
                        onClick={() => setPage(pg)}
                        className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all ${
                          pg === page
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-800 border border-slate-700 text-slate-400 hover:border-slate-600'
                        }`}
                      >
                        {pg}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-xs disabled:opacity-40 hover:border-slate-600 transition-all"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
