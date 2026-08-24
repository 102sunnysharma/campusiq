import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from '../components/Navbar';
import api from '../services/api';
import {
  Shield, Search, Filter, RefreshCw, Calendar, User,
  FileText, Activity, X, ChevronRight, Eye, Layers, Loader2
} from 'lucide-react';

export function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filters
  const [entityType, setEntityType] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `/audit-logs?page=${page}&page_size=20`;
      if (entityType) url += `&entity_type=${entityType}`;
      if (actionFilter) url += `&action=${actionFilter}`;

      const res = await api.get(url);
      setLogs(res.data.items || []);
      setTotal(res.data.total || 0);
      setTotalPages(res.data.total_pages || 1);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  }, [page, entityType, actionFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-slate-900 via-purple-950/30 to-slate-900 border border-slate-800 p-6 sm:p-8 rounded-3xl backdrop-blur-xl shadow-2xl">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-semibold uppercase tracking-wider mb-3">
              <Shield className="w-3.5 h-3.5" />
              <span>Immutable System Audit Trail</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Security & Audit Logs</h1>
            <p className="text-slate-400 text-sm mt-1">
              Complete chronological ledger of critical administrative and lifecycle mutations
            </p>
          </div>

          <button
            onClick={fetchLogs}
            className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl border border-slate-700 transition-colors self-start sm:self-auto"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Filters Bar */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={entityType}
              onChange={(e) => { setEntityType(e.target.value); setPage(1); }}
              className="bg-slate-950 border border-slate-700/80 text-xs text-slate-200 rounded-xl py-2 px-3 focus:outline-none focus:border-purple-500"
            >
              <option value="">All Entity Types</option>
              <option value="grievance">Grievance</option>
              <option value="user">User</option>
              <option value="feedback">Feedback</option>
              <option value="department">Department</option>
            </select>

            <select
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
              className="bg-slate-950 border border-slate-700/80 text-xs text-slate-200 rounded-xl py-2 px-3 focus:outline-none focus:border-purple-500"
            >
              <option value="">All Actions</option>
              <option value="grievance_created">Grievance Created</option>
              <option value="grievance_status_updated">Status Updated</option>
              <option value="grievance_assigned">Staff Assigned</option>
              <option value="user_role_changed">Role Changed</option>
              <option value="password_reset_by_admin">Password Reset</option>
            </select>
          </div>

          <div className="text-xs text-slate-400">
            Total Logged Events: <strong className="text-purple-300">{total}</strong>
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          {loading ? (
            <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
              <span>Loading audit trail...</span>
            </div>
          ) : error ? (
            <div className="p-6 text-center text-rose-400 text-xs">{error}</div>
          ) : logs.length === 0 ? (
            <div className="p-16 text-center text-slate-400 text-xs">No audit logs matching filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3.5 px-4 font-semibold">Timestamp</th>
                    <th className="py-3.5 px-4 font-semibold">Action</th>
                    <th className="py-3.5 px-4 font-semibold">Entity Type</th>
                    <th className="py-3.5 px-4 font-semibold">Actor / User</th>
                    <th className="py-3.5 px-4 font-semibold">IP Address</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">
                        {new Date(log.created_at).toLocaleString('en-IN', {
                          dateStyle: 'short',
                          timeStyle: 'medium',
                        })}
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-purple-300">
                        {log.action}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] uppercase">
                          {log.entity_type}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div>
                          <span className="font-medium text-slate-200">{log.actor_name || 'System / Direct'}</span>
                          {log.actor_email && (
                            <span className="text-[10px] text-slate-500 block">{log.actor_email}</span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                        {log.ip_address || '—'}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700"
                          title="Inspect JSON Mutation Payload"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
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

      {/* Payload Inspector Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4" onClick={() => setSelectedLog(null)}>
          <div
            className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <Shield className="w-4 h-4 text-purple-400" />
                  <span>Audit Event: {selectedLog.action}</span>
                </h3>
                <p className="text-xs text-slate-400 font-mono">Entity ID: {selectedLog.entity_id}</p>
              </div>
              <button onClick={() => setSelectedLog(null)} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {selectedLog.old_values && (
                <div>
                  <h4 className="font-semibold text-slate-400 uppercase tracking-wider mb-1">Old Values</h4>
                  <pre className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-rose-300 font-mono text-[11px] overflow-x-auto">
                    {JSON.stringify(selectedLog.old_values, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.new_values && (
                <div>
                  <h4 className="font-semibold text-slate-400 uppercase tracking-wider mb-1">New Values</h4>
                  <pre className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-emerald-300 font-mono text-[11px] overflow-x-auto">
                    {JSON.stringify(selectedLog.new_values, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
