import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  LineChart, Line, BarChart, Bar, ScatterChart, Scatter, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts';
import Header from '../../components/ui/Header';
import UserContextNavigation from '../../components/ui/UserContextNavigation';
import Button from '../../components/ui/Button';
import LoadingState from '../../components/ui/LoadingState';
import Icon from '../../components/AppIcon';
import apiClient from '../../services/apiClient.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

const hashId = (id) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return `P${Math.abs(hash).toString(36).slice(0, 8).toUpperCase()}`;
};

const anonymize = (interview) => ({
  participantId: hashId(interview.userId || interview.id || String(Math.random())),
  sessionNumber: null, // computed later
  date: interview.completedAt || interview.endedAt || interview.createdAt,
  overallScore: interview.overallScore ?? interview.evaluation?.overallScore ?? null,
  technicalScore: interview.evaluation?.technicalSkills?.score ?? null,
  communicationScore: interview.evaluation?.communicationSkills?.score ?? null,
  jobRole: interview.jobRole || 'General',
  interviewType: interview.type || interview.interviewType || 'Practice',
  duration: interview.duration || null,
  wpm: interview.voiceAnalysis?.wpm ?? null,
  fillerRate: interview.voiceAnalysis?.fillerRate ?? null,
  engagementScore: interview.emotionSummary?.avgEngagement ?? null,
  fluencyScore: interview.voiceAnalysis?.fluencyScore ?? null,
});

const computeMean = (arr) => {
  const valid = arr.filter((v) => v != null && !isNaN(v));
  if (valid.length === 0) return null;
  return Math.round(valid.reduce((s, v) => s + v, 0) / valid.length);
};

const computeStdDev = (arr) => {
  const valid = arr.filter((v) => v != null && !isNaN(v));
  if (valid.length < 2) return null;
  const mean = valid.reduce((s, v) => s + v, 0) / valid.length;
  const variance = valid.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / valid.length;
  return Math.round(Math.sqrt(variance) * 10) / 10;
};

const exportCSV = (data, filename) => {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);
  const rows = data.map((row) => headers.map((h) => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const LongitudinalStudyPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rawData, setRawData] = useState([]);
  const [error, setError] = useState(null);
  const [cohortFilter, setCohortFilter] = useState('all');
  const [metricFilter, setMetricFilter] = useState('overallScore');

  const isAdmin = user?.accountType === 'ADMIN' || user?.accountType === 'SYSTEM_ADMIN';
  const userType = isAdmin ? 'admin' : 'company';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.analytics.getAdminInterviews?.() ||
                     await apiClient.analytics.getLongitudinalData?.() ||
                     null;
      if (result?.success) {
        setRawData(result.interviews || result.data || []);
      } else {
        // Fallback: load individual candidate analytics
        const analyticsResult = await apiClient.analytics.getCandidateFullAnalytics?.();
        if (analyticsResult?.success) {
          setRawData(analyticsResult.interviews || []);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load research data');
    } finally {
      setLoading(false);
    }
  };

  const anonymizedData = useMemo(() => {
    const d = rawData.map(anonymize);
    // Assign session numbers per participant
    const sessionMap = {};
    d.sort((a, b) => new Date(a.date) - new Date(b.date)).forEach((row) => {
      sessionMap[row.participantId] = (sessionMap[row.participantId] || 0) + 1;
      row.sessionNumber = sessionMap[row.participantId];
    });
    return d;
  }, [rawData]);

  const cohorts = useMemo(() => {
    const roleSet = new Set(anonymizedData.map((d) => d.jobRole));
    return ['all', ...Array.from(roleSet)];
  }, [anonymizedData]);

  const filteredData = useMemo(() => {
    if (cohortFilter === 'all') return anonymizedData;
    return anonymizedData.filter((d) => d.jobRole === cohortFilter);
  }, [anonymizedData, cohortFilter]);

  const stats = useMemo(() => {
    const values = filteredData.map((d) => d[metricFilter]).filter((v) => v != null);
    return {
      n: filteredData.length,
      mean: computeMean(values),
      stdDev: computeStdDev(values),
      min: values.length > 0 ? Math.min(...values) : null,
      max: values.length > 0 ? Math.max(...values) : null,
      median: values.length > 0
        ? [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
        : null,
    };
  }, [filteredData, metricFilter]);

  // Session progression: average score by session number
  const progressionData = useMemo(() => {
    const bySession = {};
    filteredData.forEach((d) => {
      if (d.sessionNumber && d[metricFilter] != null) {
        if (!bySession[d.sessionNumber]) bySession[d.sessionNumber] = [];
        bySession[d.sessionNumber].push(d[metricFilter]);
      }
    });
    return Object.entries(bySession)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([session, vals]) => ({
        session: `S${session}`,
        avg: computeMean(vals),
        count: vals.length,
      }))
      .slice(0, 10);
  }, [filteredData, metricFilter]);

  // Score distribution histogram
  const distributionData = useMemo(() => {
    const buckets = [
      { label: '0–20', min: 0, max: 20, count: 0 },
      { label: '21–40', min: 21, max: 40, count: 0 },
      { label: '41–60', min: 41, max: 60, count: 0 },
      { label: '61–80', min: 61, max: 80, count: 0 },
      { label: '81–100', min: 81, max: 100, count: 0 },
    ];
    filteredData.forEach((d) => {
      const v = d[metricFilter];
      if (v == null) return;
      const bucket = buckets.find((b) => v >= b.min && v <= b.max);
      if (bucket) bucket.count++;
    });
    return buckets;
  }, [filteredData, metricFilter]);

  // Scatter: session number vs score
  const scatterData = useMemo(() =>
    filteredData
      .filter((d) => d.sessionNumber && d[metricFilter] != null)
      .map((d) => ({ session: d.sessionNumber, score: d[metricFilter], id: d.participantId }))
  , [filteredData, metricFilter]);

  const METRIC_OPTIONS = [
    { value: 'overallScore', label: 'Overall Score' },
    { value: 'technicalScore', label: 'Technical Score' },
    { value: 'communicationScore', label: 'Communication Score' },
    { value: 'fluencyScore', label: 'Fluency Score' },
    { value: 'engagementScore', label: 'Engagement Score' },
  ];

  const handleExportCSV = () => exportCSV(filteredData, `longitudinal_study_${cohortFilter}_${new Date().toISOString().slice(0, 10)}.csv`);
  const handleExportJSON = () => {
    const json = JSON.stringify(filteredData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `longitudinal_study_${cohortFilter}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 transition-colors duration-300">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute -top-24 right-0 h-80 w-80 bg-gradient-to-br from-blue-400/30 to-purple-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-[-10%] h-[420px] w-[420px] bg-gradient-to-tr from-indigo-300/25 via-blue-200/20 to-transparent blur-[120px]" />
      </div>

      <Header userType={userType} isAuthenticated onLogout={async () => { await logout(); navigate('/login'); }} />
      <div className="h-14 xs:h-16" />

      <div className="relative z-10 flex flex-col lg:flex-row">
        <UserContextNavigation
          userType={userType}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />
        <main className={`flex-1 transition-all duration-300 pb-20 lg:pb-0 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72 xl:ml-80'}`}>
          <motion.section
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="container-responsive py-6 xs:py-8 sm:py-10 space-y-6"
          >
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg">
                  <Icon name="FlaskConical" size={22} color="white" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-slate-100">Longitudinal Study Tools</h1>
                  <p className="text-sm text-gray-500 dark:text-slate-400">Cohort analysis & anonymised research export for academic publication</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" iconName="Download" onClick={handleExportCSV}>CSV</Button>
                <Button variant="outline" size="sm" iconName="FileJson" onClick={handleExportJSON}>JSON</Button>
                <Button variant="ghost" size="sm" iconName="RefreshCw" onClick={loadData}>Refresh</Button>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Cohort (Role)</label>
                <select
                  value={cohortFilter}
                  onChange={(e) => setCohortFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {cohorts.map((c) => (
                    <option key={c} value={c}>{c === 'all' ? 'All Cohorts' : c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Metric</label>
                <select
                  value={metricFilter}
                  onChange={(e) => setMetricFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {METRIC_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {loading ? (
              <LoadingState title="Loading research data" message="Aggregating anonymised interview data..." variant="card" tone="primary" />
            ) : error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 dark:bg-red-900/10 p-4 text-sm text-red-700 dark:text-red-300">{error}</div>
            ) : (
              <>
                {/* Descriptive Statistics */}
                <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4 sm:p-6 shadow-lg">
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                    <Icon name="BarChart2" size={15} className="text-indigo-500" />
                    Descriptive Statistics – {METRIC_OPTIONS.find((m) => m.value === metricFilter)?.label}
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                    {[
                      { label: 'N (sessions)', value: stats.n },
                      { label: 'Mean', value: stats.mean ?? '—' },
                      { label: 'Median', value: stats.median ?? '—' },
                      { label: 'Std Dev', value: stats.stdDev ?? '—' },
                      { label: 'Min', value: stats.min ?? '—' },
                      { label: 'Max', value: stats.max ?? '—' },
                    ].map((s) => (
                      <div key={s.label} className="rounded-xl bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/30 p-3 text-center">
                        <p className="text-lg font-bold text-indigo-700 dark:text-indigo-300">{s.value}</p>
                        <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Session Progression Chart */}
                {progressionData.length > 0 && (
                  <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4 sm:p-6 shadow-lg">
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                      <Icon name="TrendingUp" size={15} className="text-blue-500" />
                      Score Progression by Session Number
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mb-3">Average {METRIC_OPTIONS.find((m) => m.value === metricFilter)?.label} across cohort by session number (practice frequency proxy).</p>
                    <div style={{ height: 240 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={progressionData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-100 dark:stroke-slate-700" />
                          <XAxis dataKey="session" tick={{ fontSize: 11 }} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(v) => [`${v}%`, 'Avg Score']} />
                          <Legend />
                          <Line type="monotone" dataKey="avg" name="Avg Score" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Score Distribution */}
                <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4 sm:p-6 shadow-lg">
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                    <Icon name="BarChart" size={15} className="text-purple-500" />
                    Score Distribution
                  </h2>
                  <div style={{ height: 200 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={distributionData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-gray-100 dark:stroke-slate-700" />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="count" name="Sessions" radius={[4, 4, 0, 0]}>
                          {distributionData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Scatter Plot */}
                {scatterData.length > 0 && (
                  <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4 sm:p-6 shadow-lg">
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                      <Icon name="ScatterChart" size={15} className="text-emerald-500" />
                      Session Number vs Score (Individual Data Points)
                    </h2>
                    <div style={{ height: 200 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-100 dark:stroke-slate-700" />
                          <XAxis dataKey="session" name="Session" type="number" tick={{ fontSize: 11 }} label={{ value: 'Session #', position: 'insideBottom', offset: -5, fontSize: 10 }} />
                          <YAxis dataKey="score" name="Score" domain={[0, 100]} tick={{ fontSize: 11 }} />
                          <Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(v, name) => [`${v}${name === 'Score' ? '%' : ''}`, name]} />
                          <Scatter name="Data Points" data={scatterData} fill="#8b5cf6" fillOpacity={0.7} r={4} />
                        </ScatterChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Anonymised Data Table */}
                <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 shadow-lg overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Anonymised Dataset ({filteredData.length} records)</h2>
                    <Button size="sm" variant="outline" iconName="Download" onClick={handleExportCSV}>Export</Button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 dark:bg-slate-700/30">
                        <tr>
                          {['Participant ID', 'Session #', 'Date', 'Role', 'Overall', 'Technical', 'Communication', 'Fluency', 'Engagement'].map((h) => (
                            <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 dark:text-slate-400 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                        {filteredData.slice(0, 50).map((row, i) => (
                          <tr key={i} className="hover:bg-gray-50 dark:hover:bg-slate-700/20">
                            <td className="px-3 py-2 font-mono text-gray-700 dark:text-slate-300">{row.participantId}</td>
                            <td className="px-3 py-2 text-gray-700 dark:text-slate-300">{row.sessionNumber ?? '—'}</td>
                            <td className="px-3 py-2 text-gray-500 dark:text-slate-400 whitespace-nowrap">{row.date ? new Date(row.date).toLocaleDateString() : '—'}</td>
                            <td className="px-3 py-2 text-gray-700 dark:text-slate-300 max-w-[100px] truncate">{row.jobRole}</td>
                            <td className="px-3 py-2 text-gray-700 dark:text-slate-300">{row.overallScore ?? '—'}</td>
                            <td className="px-3 py-2 text-gray-700 dark:text-slate-300">{row.technicalScore ?? '—'}</td>
                            <td className="px-3 py-2 text-gray-700 dark:text-slate-300">{row.communicationScore ?? '—'}</td>
                            <td className="px-3 py-2 text-gray-700 dark:text-slate-300">{row.fluencyScore ?? '—'}</td>
                            <td className="px-3 py-2 text-gray-700 dark:text-slate-300">{row.engagementScore ?? '—'}</td>
                          </tr>
                        ))}
                        {filteredData.length > 50 && (
                          <tr>
                            <td colSpan={9} className="px-3 py-2 text-center text-gray-400 dark:text-slate-500 italic">
                              Showing 50 of {filteredData.length} records. Export CSV for full dataset.
                            </td>
                          </tr>
                        )}
                        {filteredData.length === 0 && (
                          <tr>
                            <td colSpan={9} className="px-3 py-8 text-center text-gray-400 dark:text-slate-500">
                              No data available. Complete interview sessions to populate research data.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </motion.section>
        </main>
      </div>
    </div>
  );
};

export default LongitudinalStudyPage;
