import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend,
} from 'recharts';
import Header from '../../components/ui/Header';
import UserContextNavigation from '../../components/ui/UserContextNavigation';
import Button from '../../components/ui/Button';
import Icon from '../../components/AppIcon';
import LoadingState from '../../components/ui/LoadingState';
import apiClient from '../../services/apiClient.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import MaintenanceBanner from '../../components/ui/MaintenanceBanner';
import { useMaintenanceMode } from '../../hooks/useMaintenanceMode';

const BENCHMARK_SCORE = 72;

const getScoreColor = (score) => {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#3b82f6';
  return '#f59e0b';
};

const getRoleBadgeColor = (idx) => {
  const colors = ['bg-blue-100 text-blue-700', 'bg-purple-100 text-purple-700', 'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700'];
  return colors[idx % colors.length];
};

const StatCard = ({ label, value, sub, icon, color = 'text-blue-600 dark:text-blue-400' }) => (
  <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4 shadow-lg">
    <div className="flex items-center gap-2 mb-2">
      <Icon name={icon} size={16} className={color} />
      <span className="text-xs text-gray-500 dark:text-slate-400">{label}</span>
    </div>
    <p className={`text-2xl font-bold ${color}`}>{value}</p>
    {sub && <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{sub}</p>}
  </div>
);

const CandidateAnalyticsPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { maintenanceMode } = useMaintenanceMode();
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('all');

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.interviews.getCandidateFullAnalytics();
      if (res?.success) {
        setAnalytics(res.analytics);
      } else {
        setError(res?.error || 'Failed to load analytics');
      }
    } catch {
      setError('Failed to load analytics data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  if (loading) {
    return <LoadingState title="Loading your analytics" message="Crunching your interview data…" variant="fullscreen" tone="primary" />;
  }

  const trend = analytics?.trend || [];
  const filteredTrend = timeRange === 'last5' ? trend.slice(-5)
    : timeRange === 'last10' ? trend.slice(-10)
    : trend;

  const skillAverages = analytics?.skillAverages || {};
  const roleBreakdown = analytics?.roleBreakdown || [];
  const weeklyFrequency = analytics?.weeklyFrequency || [];
  const totalSessions = analytics?.totalSessions || 0;
  const improvementDelta = analytics?.improvementDelta;

  const radarData = [
    { skill: 'Technical', score: skillAverages.technical ?? 0 },
    { skill: 'Communication', score: skillAverages.communication ?? 0 },
    { skill: 'Overall', score: skillAverages.overall ?? 0 },
  ];

  const overallAvg = skillAverages.overall ?? 0;
  const vsAvg = overallAvg - BENCHMARK_SCORE;

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute -top-24 right-0 h-80 w-80 bg-gradient-to-br from-blue-400/30 to-purple-500/20 blur-3xl" />
      </div>

      <Header userType="candidate" isAuthenticated onLogout={handleLogout} />
      {maintenanceMode && <MaintenanceBanner />}
      <div className="h-14 xs:h-16" />

      <div className="relative z-10">
        <div className="flex flex-col lg:flex-row">
          <UserContextNavigation
            userType="candidate"
            isCollapsed={isNavCollapsed}
            onToggleCollapse={() => setIsNavCollapsed(!isNavCollapsed)}
          />
          <main className={`flex-1 transition-all duration-300 pb-20 lg:pb-0 ${isNavCollapsed ? 'lg:ml-20' : 'lg:ml-72 xl:ml-80'}`}>
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="container-responsive py-6 xs:py-8 sm:py-10 space-y-6"
            >
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-xl xs:text-2xl sm:text-3xl font-bold text-gray-900 dark:text-slate-100">
                    My Analytics
                  </h1>
                  <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
                    Track your interview performance trends and skill gaps
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/candidate-dashboard')}
                  iconName="ArrowLeft"
                  iconPosition="left"
                >
                  Dashboard
                </Button>
              </div>

              {error && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-900/20 p-4 flex items-center gap-3">
                  <Icon name="AlertCircle" size={18} className="text-amber-500" />
                  <p className="text-sm text-amber-800 dark:text-amber-200">{error}</p>
                </div>
              )}

              {totalSessions === 0 && !error ? (
                <div className="text-center py-20">
                  <Icon name="BarChart2" size={48} className="mx-auto text-gray-300 dark:text-slate-600 mb-4" />
                  <h2 className="text-lg font-semibold text-gray-700 dark:text-slate-300 mb-2">No analytics yet</h2>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">Complete your first interview to start tracking progress.</p>
                  <Button onClick={() => navigate('/practice-interview-setup')} variant="primary" iconName="Play" iconPosition="left">
                    Start Practicing
                  </Button>
                </div>
              ) : (
                <>
                  {/* Stat Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatCard label="Total Sessions" value={totalSessions} icon="Activity" color="text-blue-600 dark:text-blue-400" />
                    <StatCard
                      label="Avg Score"
                      value={overallAvg ? `${overallAvg}%` : '—'}
                      sub={vsAvg !== 0 ? `${vsAvg > 0 ? '+' : ''}${vsAvg}% vs benchmark` : undefined}
                      icon="TrendingUp"
                      color={overallAvg >= 70 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}
                    />
                    <StatCard
                      label="Improvement"
                      value={improvementDelta != null ? `${improvementDelta > 0 ? '+' : ''}${improvementDelta}%` : '—'}
                      sub={improvementDelta != null ? 'first vs last session' : 'needs 2+ sessions'}
                      icon="ArrowUpRight"
                      color={improvementDelta > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-600 dark:text-slate-400'}
                    />
                    <StatCard
                      label="Roles Practiced"
                      value={roleBreakdown.length}
                      icon="Briefcase"
                      color="text-purple-600 dark:text-purple-400"
                    />
                  </div>

                  {/* Score Trend Chart */}
                  {filteredTrend.length >= 2 && (
                    <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4 sm:p-6 shadow-lg">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                          <Icon name="TrendingUp" size={16} className="text-blue-500" />
                          Score Trend
                        </h2>
                        <div className="flex gap-1.5">
                          {[['all', 'All'], ['last10', 'Last 10'], ['last5', 'Last 5']].map(([val, lbl]) => (
                            <button
                              key={val}
                              onClick={() => setTimeRange(val)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                                timeRange === val
                                  ? 'bg-blue-600 text-white'
                                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
                              }`}
                            >
                              {lbl}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="h-60">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={filteredTrend} margin={{ top: 4, right: 8, bottom: 4, left: -15 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-700" />
                            <XAxis dataKey="session" tick={{ fontSize: 11, fill: '#64748b' }} label={{ value: 'Session #', position: 'insideBottom', offset: -2, fontSize: 10, fill: '#94a3b8' }} />
                            <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                            <Tooltip
                              formatter={(value, name) => [`${value}%`, 'Score']}
                              labelFormatter={(label) => `Session ${label}`}
                              contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: 8, fontSize: 12 }}
                              labelStyle={{ color: '#f1f5f9' }}
                              itemStyle={{ color: '#93c5fd' }}
                            />
                            {/* Benchmark reference */}
                            <Line
                              dataKey={() => BENCHMARK_SCORE}
                              stroke="#94a3b8"
                              strokeDasharray="4 4"
                              dot={false}
                              strokeWidth={1}
                              name="Benchmark"
                            />
                            <Line
                              dataKey="score"
                              stroke="#3b82f6"
                              strokeWidth={2.5}
                              dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }}
                              activeDot={{ r: 6 }}
                              name="Your Score"
                            />
                            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* Skill Averages Radar */}
                  {radarData.some((d) => d.score > 0) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4 sm:p-6 shadow-lg">
                        <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                          <Icon name="Radar" size={16} className="text-purple-500" />
                          Skill Profile
                        </h2>
                        <div className="h-52">
                          <ResponsiveContainer width="100%" height="100%">
                            <RadarChart data={radarData}>
                              <PolarGrid stroke="#e2e8f0" />
                              <PolarAngleAxis dataKey="skill" tick={{ fontSize: 11, fill: '#64748b' }} />
                              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} />
                              <Radar dataKey="score" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.25} strokeWidth={2} name="Your Avg" />
                              <Tooltip formatter={(v) => [`${v}%`]} />
                            </RadarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Skill gap analysis */}
                      <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4 sm:p-6 shadow-lg">
                        <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                          <Icon name="Target" size={16} className="text-rose-500" />
                          Skill Gap Analysis
                        </h2>
                        <div className="space-y-4">
                          {[
                            { label: 'Technical Skills', score: skillAverages.technical ?? 0, benchmark: 75 },
                            { label: 'Communication', score: skillAverages.communication ?? 0, benchmark: 70 },
                            { label: 'Overall Performance', score: skillAverages.overall ?? 0, benchmark: BENCHMARK_SCORE },
                          ].map((item) => {
                            const gap = item.score - item.benchmark;
                            return (
                              <div key={item.label}>
                                <div className="flex justify-between text-sm mb-1.5">
                                  <span className="text-gray-700 dark:text-slate-300 font-medium">{item.label}</span>
                                  <span className={`text-xs font-semibold ${gap >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                    {gap >= 0 ? `+${gap}` : gap}% vs benchmark
                                  </span>
                                </div>
                                <div className="relative h-2 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all duration-700"
                                    style={{ width: `${item.score}%`, backgroundColor: getScoreColor(item.score) }}
                                  />
                                  {/* Benchmark marker */}
                                  <div
                                    className="absolute top-0 h-full w-0.5 bg-gray-400 dark:bg-slate-500"
                                    style={{ left: `${item.benchmark}%` }}
                                  />
                                </div>
                                <div className="flex justify-between text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                                  <span>Your avg: {item.score}%</span>
                                  <span>Benchmark: {item.benchmark}%</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Per-Role Breakdown */}
                  {roleBreakdown.length > 0 && (
                    <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4 sm:p-6 shadow-lg">
                      <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                        <Icon name="Briefcase" size={16} className="text-amber-500" />
                        Performance by Role
                      </h2>
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={roleBreakdown} margin={{ top: 4, right: 8, bottom: 30, left: -10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="role" tick={{ fontSize: 10, fill: '#64748b' }} angle={-20} textAnchor="end" interval={0} />
                            <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                            <Tooltip
                              formatter={(v, name) => [name === 'avgScore' ? `${v}%` : v, name === 'avgScore' ? 'Avg Score' : 'Sessions']}
                              contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: 8, fontSize: 12 }}
                            />
                            <Bar dataKey="avgScore" name="Avg Score" radius={[4, 4, 0, 0]}>
                              {roleBreakdown.map((entry, idx) => (
                                <Cell key={entry.role} fill={getScoreColor(entry.avgScore)} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {roleBreakdown.map((r, idx) => (
                          <span key={r.role} className={`text-xs px-2.5 py-1 rounded-full font-medium ${getRoleBadgeColor(idx)}`}>
                            {r.role} · {r.count} session{r.count !== 1 ? 's' : ''} · {r.avgScore}%
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Weekly Practice Frequency */}
                  {weeklyFrequency.length > 1 && (
                    <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4 sm:p-6 shadow-lg">
                      <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                        <Icon name="Calendar" size={16} className="text-indigo-500" />
                        Weekly Practice Frequency
                      </h2>
                      <div className="h-40">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={weeklyFrequency} margin={{ top: 4, right: 8, bottom: 4, left: -15 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="week" tick={{ fontSize: 9, fill: '#94a3b8' }} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                            <Tooltip formatter={(v) => [v, 'Sessions']} contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: 8, fontSize: 12 }} />
                            <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* CTA to practice */}
                  <div className="flex flex-wrap justify-center gap-3 pt-2">
                    <Button
                      onClick={() => navigate('/practice-interview-setup')}
                      variant="primary"
                      iconName="Play"
                      iconPosition="left"
                    >
                      Practice Now
                    </Button>
                    <Button
                      onClick={() => navigate('/candidate-dashboard')}
                      variant="outline"
                      iconName="LayoutDashboard"
                      iconPosition="left"
                    >
                      Dashboard
                    </Button>
                  </div>
                </>
              )}
            </motion.section>
          </main>
        </div>
      </div>
    </div>
  );
};

export default CandidateAnalyticsPage;
