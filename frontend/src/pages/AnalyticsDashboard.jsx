import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import api from '../services/api';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  BarChart2, TrendingUp, AlertTriangle, CheckCircle2, Clock,
  RefreshCw, Star, Shield, Loader2, AlertCircle, ChevronDown,
  ChevronUp, Database, Info
} from 'lucide-react';

// Gap score color config
const GAP_BAND_CONFIG = {
  Low:      { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', dot: '#10b981' },
  Moderate: { text: 'text-yellow-400',  bg: 'bg-yellow-500/10',  border: 'border-yellow-500/30',  dot: '#eab308' },
  High:     { text: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   dot: '#f59e0b' },
  Critical: { text: 'text-rose-400',    bg: 'bg-rose-500/10',    border: 'border-rose-500/30',    dot: '#f43f5e' },
};

const PIE_COLORS = ['#6366f1','#22d3ee','#f59e0b','#10b981','#f43f5e','#a78bfa','#fb923c','#34d399','#e879f9','#60a5fa'];

const today = new Date();
const defaultDateFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
const defaultDateTo = today.toISOString().split('T')[0];

// KPI Card Component
function KpiCard({ icon: Icon, label, value, sub, color, loading }) {
  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 hover:border-slate-700 transition-colors`}>
      <div className="flex items-start justify-between">
        <div className={`p-2.5 rounded-xl ${color} bg-opacity-10`}>
          <Icon className={`w-5 h-5 ${color.replace('bg-', 'text-').replace('/10','')}`} />
        </div>
        <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">{label}</span>
      </div>
      {loading ? (
        <div className="h-8 bg-slate-800 rounded animate-pulse w-2/3" />
      ) : (
        <div>
          <div className="text-2xl font-extrabold text-white">{value ?? '—'}</div>
          {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
        </div>
      )}
    </div>
  );
}

export function AnalyticsDashboard() {
  const [summary, setSummary] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [trends, setTrends] = useState([]);
  const [recurringIssues, setRecurringIssues] = useState([]);
  const [loading, setLoading] = useState({ summary: true, depts: true, trends: true, issues: true });
  const [errors, setErrors] = useState({});
  const [dateFrom, setDateFrom] = useState(defaultDateFrom);
  const [dateTo, setDateTo] = useState(defaultDateTo);
  const [aggregating, setAggregating] = useState(false);
  const [aggregateMsg, setAggregateMsg] = useState('');
  const [showPowerBiGuide, setShowPowerBiGuide] = useState(false);
  const navigate = useNavigate();

  const dateParams = `?date_from=${dateFrom}&date_to=${dateTo}`;

  const fetchAll = useCallback(async () => {
    setLoading({ summary: true, depts: true, trends: true, issues: true });
    setErrors({});

    const run = async (key, fn) => {
      try {
        const data = await fn();
        return { key, data, error: null };
      } catch (err) {
        return { key, data: null, error: err.response?.data?.error?.message || `Failed to load ${key}` };
      }
    };

    const results = await Promise.all([
      run('summary', () => api.get(`/analytics/summary${dateParams}`).then(r => r.data)),
      run('depts',   () => api.get(`/analytics/departments${dateParams}`).then(r => r.data.items)),
      run('trends',  () => api.get(`/analytics/trends${dateParams}`).then(r => r.data.items)),
      run('issues',  () => api.get(`/analytics/recurring-issues${dateParams}&top_n=8`).then(r => r.data.items)),
    ]);

    const newErrors = {};
    for (const result of results) {
      if (result.error) {
        newErrors[result.key] = result.error;
      } else {
        if (result.key === 'summary') setSummary(result.data);
        if (result.key === 'depts')   setDepartments(result.data);
        if (result.key === 'trends')  setTrends(result.data);
        if (result.key === 'issues')  setRecurringIssues(result.data);
      }
    }
    setErrors(newErrors);
    setLoading({ summary: false, depts: false, trends: false, issues: false });
  }, [dateFrom, dateTo]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleAggregate = async () => {
    setAggregating(true);
    setAggregateMsg('');
    try {
      const res = await api.post('/analytics/aggregate', { target_date: defaultDateTo });
      setAggregateMsg(`✅ ${res.data.message}`);
      await fetchAll();
    } catch (err) {
      setAggregateMsg(`❌ ${err.response?.data?.error?.message || 'Aggregation failed'}`);
    } finally {
      setAggregating(false);
    }
  };

  const gapConf = (label) => GAP_BAND_CONFIG[label] || GAP_BAND_CONFIG.Low;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950/30 to-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-3">
                <BarChart2 className="w-3.5 h-3.5" />
                <span>Analytics & Power BI Dashboard</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Operational Intelligence</h1>
              <p className="text-slate-400 text-sm mt-1">Live metrics from the operational_metrics table · Aggregated daily</p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Date Filters */}
              <div className="flex items-center space-x-2 bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2">
                <span className="text-xs text-slate-400">From</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="bg-transparent text-xs text-slate-200 focus:outline-none"
                />
                <span className="text-xs text-slate-400">To</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="bg-transparent text-xs text-slate-200 focus:outline-none"
                />
              </div>

              <button
                onClick={fetchAll}
                className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-colors"
                title="Refresh all charts"
              >
                <RefreshCw className={`w-4 h-4 ${Object.values(loading).some(Boolean) ? 'animate-spin' : ''}`} />
              </button>

              <button
                onClick={handleAggregate}
                disabled={aggregating}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center space-x-2 transition-colors"
              >
                {aggregating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                <span>{aggregating ? 'Running...' : 'Run Today\'s Aggregation'}</span>
              </button>
            </div>
          </div>

          {aggregateMsg && (
            <div className={`mt-4 text-xs px-4 py-2.5 rounded-xl border ${
              aggregateMsg.startsWith('✅')
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}>
              {aggregateMsg}
            </div>
          )}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
          <KpiCard
            icon={TrendingUp} label="Total Feedback" color="bg-indigo-500"
            value={summary?.total_feedback?.toLocaleString()}
            sub={`${summary?.negative_feedback_pct ?? 0}% negative`}
            loading={loading.summary}
          />
          <KpiCard
            icon={AlertTriangle} label="Total Grievances" color="bg-amber-500"
            value={summary?.total_grievances?.toLocaleString()}
            sub={`${summary?.open_grievances} currently open`}
            loading={loading.summary}
          />
          <KpiCard
            icon={CheckCircle2} label="Resolved" color="bg-emerald-500"
            value={summary?.resolved_grievances?.toLocaleString()}
            sub={`of ${summary?.total_grievances} total`}
            loading={loading.summary}
          />
          <KpiCard
            icon={Shield} label="SLA Compliance" color="bg-sky-500"
            value={summary ? `${summary.sla_compliance_pct}%` : '—'}
            sub={`${summary?.sla_breaches} breaches`}
            loading={loading.summary}
          />
          <KpiCard
            icon={Clock} label="Avg Resolution" color="bg-purple-500"
            value={summary ? `${Math.round((summary.avg_resolution_minutes || 0) / 60)}h` : '—'}
            sub={`${summary?.avg_resolution_minutes ?? 0} min`}
            loading={loading.summary}
          />
          <KpiCard
            icon={Star} label="Satisfaction" color="bg-rose-500"
            value={summary ? `${summary.student_satisfaction}%` : '—'}
            sub={`Gap: ${summary?.overall_gap_score ?? 0} (${summary?.gap_score_label ?? '—'})`}
            loading={loading.summary}
          />
        </div>

        {/* Trend Chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-bold text-white">Volume Trends Over Time</h2>
              <p className="text-xs text-slate-400 mt-0.5">Feedback vs Grievances — aggregated by day</p>
            </div>
          </div>

          {loading.trends ? (
            <div className="h-56 flex items-center justify-center text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : errors.trends ? (
            <div className="h-56 flex items-center justify-center text-rose-400 text-xs">{errors.trends}</div>
          ) : trends.length === 0 ? (
            <div className="h-56 flex flex-col items-center justify-center text-slate-500 text-xs space-y-2">
              <BarChart2 className="w-8 h-8 text-slate-700" />
              <span>No trend data for selected range. Run aggregation first.</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={trends} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorFb" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorGrv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', color: '#e2e8f0', fontSize: '11px' }}
                />
                <Area type="monotone" dataKey="total_feedback" stroke="#6366f1" fill="url(#colorFb)" strokeWidth={2} name="Feedback" />
                <Area type="monotone" dataKey="total_grievances" stroke="#f59e0b" fill="url(#colorGrv)" strokeWidth={2} name="Grievances" />
                <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Department Table + Recurring Issues Chart */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">

          {/* Department Performance Table */}
          <div className="xl:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-5 border-b border-slate-800">
              <h2 className="text-base font-bold text-white">Department Performance</h2>
              <p className="text-xs text-slate-400 mt-0.5">Sorted by Gap Score · worst first</p>
            </div>

            {loading.depts ? (
              <div className="p-8 text-center text-slate-500"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
            ) : errors.depts ? (
              <div className="p-6 text-xs text-rose-400">{errors.depts}</div>
            ) : departments.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">No department data. Run aggregation.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Department</th>
                      <th className="py-3 px-4 font-semibold text-center">Grievances</th>
                      <th className="py-3 px-4 font-semibold text-center">SLA Breaches</th>
                      <th className="py-3 px-4 font-semibold text-center">Satisfaction</th>
                      <th className="py-3 px-4 font-semibold text-center">Gap Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {departments.map((dept, i) => {
                      const conf = gapConf(dept.gap_score_label);
                      return (
                        <tr key={dept.department_id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3 px-4 font-semibold text-slate-200">
                            <div className="flex items-center space-x-2">
                              <span className={`w-2 h-2 rounded-full ${conf.bg.replace('bg-','bg-').replace('/10','')}`}
                                style={{ backgroundColor: conf.dot }} />
                              <span>{dept.department_name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center text-slate-300">{dept.total_grievances}</td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-0.5 rounded-md font-semibold ${dept.sla_breaches > 0 ? 'text-rose-400 bg-rose-500/10' : 'text-emerald-400 bg-emerald-500/10'}`}>
                              {dept.sla_breaches}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center text-slate-300">{dept.student_satisfaction}%</td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${conf.bg} ${conf.text} ${conf.border}`}>
                              {dept.gap_score} · {dept.gap_score_label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recurring Issues Pie Chart */}
          <div className="xl:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="mb-4">
              <h2 className="text-base font-bold text-white">Recurring Issues</h2>
              <p className="text-xs text-slate-400 mt-0.5">Top categories by feedback + grievance volume</p>
            </div>

            {loading.issues ? (
              <div className="h-52 flex items-center justify-center text-slate-500"><Loader2 className="w-5 h-5 animate-spin" /></div>
            ) : errors.issues ? (
              <div className="h-52 flex items-center justify-center text-rose-400 text-xs">{errors.issues}</div>
            ) : recurringIssues.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-xs text-slate-500">No data for selected range.</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={recurringIssues}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="total_volume"
                      nameKey="category_name"
                    >
                      {recurringIssues.map((_, idx) => (
                        <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', color: '#e2e8f0', fontSize: '11px' }}
                      formatter={(value, name) => [`${value} issues`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-2 max-h-36 overflow-y-auto pr-1">
                  {recurringIssues.slice(0, 6).map((item, idx) => (
                    <div key={item.category_id} className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center space-x-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                        <span className="text-slate-300 truncate max-w-[120px]">{item.category_name}</span>
                      </div>
                      <span className="text-slate-400 font-semibold">{item.percentage}%</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Power BI Integration Guide */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <button
            onClick={() => setShowPowerBiGuide(!showPowerBiGuide)}
            className="w-full flex items-center justify-between p-5 hover:bg-slate-800/30 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-yellow-500/10 rounded-xl">
                <Database className="w-5 h-5 text-yellow-400" />
              </div>
              <div className="text-left">
                <div className="font-bold text-white text-sm">Power BI Integration Guide</div>
                <div className="text-xs text-slate-400">Connect Power BI directly to the operational_metrics PostgreSQL table</div>
              </div>
            </div>
            {showPowerBiGuide ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
          </button>

          {showPowerBiGuide && (
            <div className="px-6 pb-6 space-y-4 text-sm border-t border-slate-800 pt-5">
              <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4 text-xs text-yellow-300 space-y-1">
                <div className="font-bold text-yellow-400">How Power BI connects (no custom connector required)</div>
                <p>Power BI Desktop reads directly from the PostgreSQL <code className="font-mono bg-slate-800 px-1 rounded">operational_metrics</code> table using the built-in PostgreSQL connector.</p>
              </div>

              <div className="space-y-3 text-xs text-slate-300">
                <div>
                  <h4 className="font-semibold text-slate-200 mb-1">1. Install the PostgreSQL connector in Power BI Desktop</h4>
                  <p className="text-slate-400">Go to <strong>Home → Get Data → PostgreSQL database</strong>. Enter your server and database credentials from <code className="font-mono bg-slate-800 px-1 rounded">.env</code>.</p>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-200 mb-1">2. Select the operational_metrics table</h4>
                  <p className="text-slate-400">Navigate to the <code className="font-mono bg-slate-800 px-1 rounded">operational_metrics</code> table. It contains one row per (department, category, date) with all pre-computed KPIs.</p>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-200 mb-1">3. Available columns for Power BI visuals</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 mt-2">
                    {['metric_date','department_id','category_id','total_feedback','negative_feedback','total_grievances','resolved_grievances','sla_breaches','avg_resolution_minutes','student_satisfaction','gap_score'].map(col => (
                      <code key={col} className="bg-slate-800 text-indigo-300 px-2 py-0.5 rounded text-[10px] font-mono">{col}</code>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-200 mb-1">4. Key KPI measures to build in Power BI</h4>
                  <ul className="text-slate-400 space-y-0.5 list-disc list-inside">
                    <li>Negative Feedback % = <code className="font-mono bg-slate-800 px-1 rounded">SUM(negative_feedback)/SUM(total_feedback)*100</code></li>
                    <li>SLA Compliance % = <code className="font-mono bg-slate-800 px-1 rounded">(SUM(total_grievances)-SUM(sla_breaches))/SUM(total_grievances)*100</code></li>
                    <li>Avg Resolution (h) = <code className="font-mono bg-slate-800 px-1 rounded">AVERAGE(avg_resolution_minutes)/60</code></li>
                    <li>Operational Gap Score = <code className="font-mono bg-slate-800 px-1 rounded">AVERAGE(gap_score)</code></li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-200 mb-1">5. Ensure data is fresh</h4>
                  <p className="text-slate-400">This app runs the aggregation job automatically every 24 hours on startup. You can also trigger it manually from the "Run Today's Aggregation" button above, or call <code className="font-mono bg-slate-800 px-1 rounded">POST /analytics/aggregate</code> via the API.</p>
                </div>
              </div>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
