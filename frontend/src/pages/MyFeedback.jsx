import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from '../components/Navbar';
import api from '../services/api';
import {
  MessageSquarePlus, Star, Send, RefreshCw, AlertCircle,
  CheckCircle2, Clock, XCircle, ChevronLeft, ChevronRight,
  Tag, Eye, EyeOff, TrendingUp, TrendingDown, Minus,
  Loader2, InboxIcon, Sparkles, Hash, BarChart3
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sentimentConfig = {
  positive: { label: 'Positive', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', Icon: TrendingUp },
  neutral:  { label: 'Neutral',  color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/30',   Icon: Minus },
  negative: { label: 'Negative', color: 'text-rose-400',    bg: 'bg-rose-500/10 border-rose-500/30',    Icon: TrendingDown },
};

const severityConfig = {
  critical: { label: 'Critical', color: 'text-rose-300',   bg: 'bg-rose-500/20 border-rose-500/40' },
  high:     { label: 'High',     color: 'text-orange-300', bg: 'bg-orange-500/20 border-orange-500/40' },
  medium:   { label: 'Medium',   color: 'text-yellow-300', bg: 'bg-yellow-500/20 border-yellow-500/40' },
  low:      { label: 'Low',      color: 'text-slate-400',  bg: 'bg-slate-500/10 border-slate-500/20' },
};

const statusConfig = {
  submitted:       { label: 'Queued for Analysis', color: 'text-sky-400',   bg: 'bg-sky-500/10 border-sky-500/30',   Icon: Clock },
  analyzed:        { label: 'Analyzed',            color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', Icon: CheckCircle2 },
  analysis_failed: { label: 'Analysis Failed',     color: 'text-rose-400',  bg: 'bg-rose-500/10 border-rose-500/30',  Icon: XCircle },
};

function StarRating({ value, onChange, readonly = false }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => !readonly && onChange && onChange(star)}
          onMouseEnter={() => !readonly && setHover(star)}
          onMouseLeave={() => !readonly && setHover(0)}
          className={`transition-all duration-150 ${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'}`}
        >
          <Star
            className={`w-6 h-6 transition-colors duration-150 ${
              star <= (hover || value)
                ? 'text-amber-400 fill-amber-400'
                : 'text-slate-600'
            }`}
          />
        </button>
      ))}
    </div>
  );
}

// ─── Feedback Card ─────────────────────────────────────────────────────────────

function FeedbackCard({ fb }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = statusConfig[fb.status] || statusConfig.submitted;
  const StatusIcon = cfg.Icon;
  const analysis = fb.analysis;
  const sentCfg = analysis?.sentiment ? sentimentConfig[analysis.sentiment] : null;
  const SentIcon = sentCfg?.Icon;

  return (
    <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-5 hover:border-indigo-500/30 transition-all duration-200 group">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status */}
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.color}`}>
            <StatusIcon className="w-3.5 h-3.5" />
            {cfg.label}
          </span>

          {/* Sentiment badge */}
          {sentCfg && (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${sentCfg.bg} ${sentCfg.color}`}>
              <SentIcon className="w-3.5 h-3.5" />
              {sentCfg.label}
            </span>
          )}

          {/* Severity badge */}
          {analysis?.severity && (
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${(severityConfig[analysis.severity] || severityConfig.low).bg} ${(severityConfig[analysis.severity] || severityConfig.low).color}`}>
              {(severityConfig[analysis.severity] || severityConfig.low).label}
            </span>
          )}

          {/* Anonymous badge */}
          {fb.is_anonymous && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border bg-slate-700/50 border-slate-600 text-slate-400">
              <EyeOff className="w-3 h-3" /> Anonymous
            </span>
          )}
        </div>

        {/* Rating */}
        <div className="flex-shrink-0">
          <StarRating value={fb.rating} readonly />
        </div>
      </div>

      {/* Category */}
      {fb.category && (
        <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
          <Tag className="w-3.5 h-3.5" />
          <span>{fb.category.name}</span>
        </div>
      )}

      {/* Content */}
      <p className={`text-sm text-slate-300 leading-relaxed ${expanded ? '' : 'line-clamp-3'}`}>
        {fb.content}
      </p>
      {fb.content.length > 200 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-indigo-400 hover:text-indigo-300 mt-1 transition-colors"
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}

      {/* NLP Analysis detail */}
      {analysis && analysis.analysis_status === 'COMPLETED' && (
        <div className="mt-4 pt-4 border-t border-slate-700/50">
          {/* Keywords */}
          {analysis.keywords && analysis.keywords.length > 0 && (
            <div className="mb-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2">
                <Hash className="w-3.5 h-3.5" /> Keywords
              </div>
              <div className="flex flex-wrap gap-1.5">
                {analysis.keywords.map((kw, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs">
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Topics */}
          {analysis.topics && analysis.topics.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2">
                <BarChart3 className="w-3.5 h-3.5" /> Topics
              </div>
              <div className="flex flex-wrap gap-1.5">
                {analysis.topics.map((t, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs capitalize">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Failed analysis notice */}
      {analysis?.analysis_status === 'FAILED' && (
        <div className="mt-3 flex items-center gap-2 text-xs text-rose-400 bg-rose-500/5 border border-rose-500/20 rounded-lg px-3 py-2">
          <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
          Analysis could not be completed for this feedback.
        </div>
      )}

      {/* Footer */}
      <div className="mt-3 text-xs text-slate-500">
        {new Date(fb.created_at).toLocaleDateString('en-IN', {
          day: 'numeric', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        })}
      </div>
    </div>
  );
}

// ─── Submission Form ───────────────────────────────────────────────────────────

function FeedbackForm({ categories, onSuccess }) {
  const [form, setForm] = useState({ category_id: '', content: '', rating: 0, is_anonymous: false });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  const validate = () => {
    const e = {};
    if (!form.category_id) e.category_id = 'Please select a category.';
    if (!form.content.trim() || form.content.trim().length < 10)
      e.content = 'Feedback must be at least 10 characters.';
    if (form.content.length > 5000) e.content = 'Feedback cannot exceed 5000 characters.';
    if (form.rating === 0) e.rating = 'Please provide a rating.';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setSubmitting(true);
    try {
      await api.post('/feedback', form);
      setToast({ type: 'success', msg: 'Feedback submitted! Analysis will appear shortly.' });
      setForm({ category_id: '', content: '', rating: 0, is_anonymous: false });
      onSuccess();
      setTimeout(() => setToast(null), 4000);
    } catch (err) {
      const msg = err.response?.data?.error?.message || 'Failed to submit feedback. Please try again.';
      setToast({ type: 'error', msg });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-6">
      <h2 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
        <MessageSquarePlus className="w-5 h-5 text-indigo-400" />
        Submit New Feedback
      </h2>

      {/* Toast */}
      {toast && (
        <div className={`mb-4 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium border ${
          toast.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {/* Category */}
        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-1.5">
            Category <span className="text-rose-400">*</span>
          </label>
          <select
            id="feedback-category"
            value={form.category_id}
            onChange={e => setForm(p => ({ ...p, category_id: e.target.value }))}
            className={`w-full bg-slate-900/60 border rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${
              errors.category_id ? 'border-rose-500' : 'border-slate-700 hover:border-slate-600'
            }`}
          >
            <option value="">— Select a category —</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
          {errors.category_id && (
            <p className="text-rose-400 text-xs mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />{errors.category_id}
            </p>
          )}
        </div>

        {/* Rating */}
        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-1.5">
            Rating <span className="text-rose-400">*</span>
          </label>
          <StarRating value={form.rating} onChange={v => setForm(p => ({ ...p, rating: v }))} />
          {errors.rating && (
            <p className="text-rose-400 text-xs mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />{errors.rating}
            </p>
          )}
        </div>

        {/* Content */}
        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-1.5">
            Your Feedback <span className="text-rose-400">*</span>
          </label>
          <textarea
            id="feedback-content"
            value={form.content}
            onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
            placeholder="Share your experience, suggestions, or concerns in detail…"
            rows={5}
            className={`w-full bg-slate-900/60 border rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none transition-all ${
              errors.content ? 'border-rose-500' : 'border-slate-700 hover:border-slate-600'
            }`}
          />
          <div className="flex justify-between mt-1">
            {errors.content
              ? <p className="text-rose-400 text-xs flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.content}</p>
              : <span />
            }
            <span className={`text-xs ${form.content.length > 4800 ? 'text-rose-400' : 'text-slate-500'}`}>
              {form.content.length}/5000
            </span>
          </div>
        </div>

        {/* Anonymous toggle */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            id="anonymous-toggle"
            onClick={() => setForm(p => ({ ...p, is_anonymous: !p.is_anonymous }))}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none ${
              form.is_anonymous ? 'bg-indigo-600' : 'bg-slate-600'
            }`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
              form.is_anonymous ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
          <div>
            <div className="text-sm font-semibold text-slate-300 flex items-center gap-1.5">
              {form.is_anonymous ? <EyeOff className="w-3.5 h-3.5 text-indigo-400" /> : <Eye className="w-3.5 h-3.5 text-slate-400" />}
              Submit Anonymously
            </div>
            <p className="text-xs text-slate-500">
              {form.is_anonymous
                ? 'Your identity will be hidden from staff. Admin can still see it.'
                : 'Your name will be visible to staff and admin.'}
            </p>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          id="submit-feedback-btn"
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-lg shadow-indigo-500/20"
        >
          {submitting ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
          ) : (
            <><Send className="w-4 h-4" /> Submit Feedback</>
          )}
        </button>
      </form>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export function MyFeedback() {
  // Categories
  const [categories, setCategories] = useState([]);

  // Feedback list
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE = 10;

  // Refresh key to trigger reload after submission
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await api.get('/categories?page=1&page_size=100');
      setCategories(res.data.items || []);
    } catch {
      // non-fatal
    }
  }, []);

  const fetchFeedbacks = useCallback(async (p = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/feedback/mine?page=${p}&page_size=${PAGE_SIZE}`);
      setFeedbacks(res.data.items || []);
      setTotal(res.data.total || 0);
      setTotalPages(res.data.total_pages || 1);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load feedback history.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchFeedbacks(page);
  }, [fetchFeedbacks, page, refreshKey]);

  const handleNewSubmission = () => {
    setRefreshKey(k => k + 1);
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">

        {/* Page header */}
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <MessageSquarePlus className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">My Feedback</h1>
              <p className="text-sm text-slate-400">Share your campus experience and track your submissions</p>
            </div>
          </div>
        </div>

        {/* Submission Form */}
        <FeedbackForm categories={categories} onSuccess={handleNewSubmission} />

        {/* History Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              My Submissions
              {total > 0 && (
                <span className="ml-2 px-2.5 py-0.5 rounded-full bg-slate-700 text-slate-400 text-xs font-semibold">
                  {total}
                </span>
              )}
            </h2>
            <button
              onClick={() => { setPage(1); setRefreshKey(k => k + 1); }}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
              <p className="text-sm text-slate-400">Loading your feedback…</p>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="flex items-center gap-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl px-5 py-4">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-sm">Failed to load feedback</p>
                <p className="text-xs mt-0.5 text-rose-400">{error}</p>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && feedbacks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-800/60 border border-slate-700 flex items-center justify-center">
                <InboxIcon className="w-8 h-8 text-slate-500" />
              </div>
              <div>
                <p className="font-semibold text-slate-300">No feedback yet</p>
                <p className="text-sm text-slate-500 mt-1">Use the form above to share your first feedback.</p>
              </div>
            </div>
          )}

          {/* Feedback cards */}
          {!loading && !error && feedbacks.length > 0 && (
            <div className="space-y-4">
              {feedbacks.map(fb => <FeedbackCard key={fb.id} fb={fb} />)}
            </div>
          )}

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <span className="text-xs text-slate-500">Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-xs disabled:opacity-40 hover:border-slate-600 transition-all"
                >
                  <ChevronLeft className="w-4 h-4" /> Prev
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-xs disabled:opacity-40 hover:border-slate-600 transition-all"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
