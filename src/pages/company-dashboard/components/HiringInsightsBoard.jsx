import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const STAGE_DEFINITIONS = [
  { key: 'SCREENING', label: 'Screening', color: '#3b82f6' },
  { key: 'INTERVIEW', label: 'Interview', color: '#8b5cf6' },
  { key: 'FINAL', label: 'Final', color: '#f59e0b' },
  { key: 'HIRED', label: 'Hired', color: '#10b981' },
  { key: 'REJECTED', label: 'Archived', color: '#f43f5e' },
];

const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value?.toDate === 'function') {
    const parsed = value.toDate();
    return Number.isNaN(parsed?.getTime?.()) ? null : parsed;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const resolveInterviewTimestamp = (interview = {}) =>
  interview?.scheduledFor || interview?.endedAt || interview?.updatedAt || interview?.createdAt || null;

const getPipelineStage = (interview = {}) => {
  const code = String(interview?.pipelineStatus || interview?.status || '').trim().toUpperCase();
  if (code === 'HIRED') return 'HIRED';
  if (code === 'REJECTED' || code === 'NO_SHOW' || code === 'CANCELLED' || code === 'ARCHIVED') return 'REJECTED';
  if (code === 'FINAL' || code === 'OFFER') return 'FINAL';
  if (code === 'INTERVIEW' || code === 'IN_PROGRESS' || code === 'COMPLETED' || code === 'SCHEDULED') return 'INTERVIEW';
  return 'SCREENING';
};

const getScore = (interview = {}) => {
  const candidates = [
    interview?.overallScore,
    interview?.score,
    interview?.evaluation?.overallScore,
    interview?.analytics?.overallScore,
  ];

  for (const value of candidates) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 100) {
      return parsed;
    }
  }

  return null;
};

const toWeekStart = (date) => {
  const normalized = new Date(date);
  const day = (normalized.getDay() + 6) % 7;
  normalized.setHours(0, 0, 0, 0);
  normalized.setDate(normalized.getDate() - day);
  return normalized;
};

const buildVolumeSeries = (interviews = []) => {
  const safeInterviews = Array.isArray(interviews) ? interviews : [];
  const currentWeek = toWeekStart(new Date());
  const buckets = [];

  for (let index = 5; index >= 0; index -= 1) {
    const start = new Date(currentWeek);
    start.setDate(start.getDate() - (index * 7));
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    buckets.push({
      key: start.toISOString(),
      label: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      start,
      end,
      interviews: 0,
      completed: 0,
    });
  }

  safeInterviews.forEach((interview) => {
    const date = toDate(resolveInterviewTimestamp(interview));
    if (!date) return;
    const bucket = buckets.find((item) => date >= item.start && date < item.end);
    if (!bucket) return;
    bucket.interviews += 1;
    if (String(interview?.status || '').toUpperCase() === 'COMPLETED') {
      bucket.completed += 1;
    }
  });

  return buckets.map(({ key, label, interviews: interviewCount, completed }) => ({
    key,
    label,
    interviews: interviewCount,
    completed,
  }));
};

const VolumeTooltip = ({ active, payload, label }) => {
  if (!active || !Array.isArray(payload) || payload.length === 0) return null;
  const total = payload.find((entry) => entry?.dataKey === 'interviews')?.value ?? 0;
  const completed = payload.find((entry) => entry?.dataKey === 'completed')?.value ?? 0;

  return (
    <div className="rounded-xl border border-white/40 bg-slate-900 px-3 py-2 text-xs text-white shadow-lg">
      <p className="font-semibold">{label}</p>
      <p className="text-blue-300">Sessions: {total}</p>
      <p className="text-emerald-300">Completed: {completed}</p>
    </div>
  );
};

const HiringInsightsBoard = ({
  interviews = [],
  jobs = [],
  onCreateJob,
  onScheduleInterview,
  onOpenCandidates,
}) => {
  const safeInterviews = Array.isArray(interviews) ? interviews : [];
  const safeJobs = Array.isArray(jobs) ? jobs : [];
  const chartsEnabled = typeof window !== 'undefined' && typeof window.ResizeObserver !== 'undefined';

  const stageData = useMemo(() => {
    const counts = STAGE_DEFINITIONS.reduce((acc, stage) => {
      acc[stage.key] = 0;
      return acc;
    }, {});

    safeInterviews.forEach((interview) => {
      counts[getPipelineStage(interview)] += 1;
    });

    return STAGE_DEFINITIONS.map((stage) => ({
      ...stage,
      count: counts[stage.key] || 0,
    }));
  }, [safeInterviews]);

  const volumeSeries = useMemo(() => buildVolumeSeries(safeInterviews), [safeInterviews]);

  const hiredCount = stageData.find((item) => item.key === 'HIRED')?.count || 0;
  const completedCount = safeInterviews.filter(
    (interview) => String(interview?.status || '').toUpperCase() === 'COMPLETED',
  ).length;
  const avgScoreSamples = safeInterviews.map(getScore).filter((value) => value != null);
  const averageScore = avgScoreSamples.length > 0
    ? Math.round(avgScoreSamples.reduce((sum, value) => sum + value, 0) / avgScoreSamples.length)
    : null;
  const activeJobs = safeJobs.filter((job) => String(job?.status || '').toUpperCase() === 'PUBLISHED').length;
  const conversionRate = safeInterviews.length > 0 ? Math.round((hiredCount / safeInterviews.length) * 100) : 0;
  const hasData = safeInterviews.length > 0;

  return (
    <div className="rounded-2xl border border-white/30 dark:border-slate-700/50 bg-white/85 dark:bg-slate-800/85 p-3 sm:p-4 shadow-[0_20px_60px_rgba(15,23,42,0.12)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100">
            Hiring Insights
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400">
            Pipeline health, conversion trend, and interview velocity in one place.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          <div className="rounded-lg border border-slate-200/70 dark:border-slate-700/60 bg-slate-50/80 dark:bg-slate-900/40 px-2 py-1.5">
            <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-slate-400">Active Jobs</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{activeJobs}</p>
          </div>
          <div className="rounded-lg border border-slate-200/70 dark:border-slate-700/60 bg-slate-50/80 dark:bg-slate-900/40 px-2 py-1.5">
            <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-slate-400">Conversion</p>
            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{conversionRate}%</p>
          </div>
          <div className="rounded-lg border border-slate-200/70 dark:border-slate-700/60 bg-slate-50/80 dark:bg-slate-900/40 px-2 py-1.5">
            <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-slate-400">Avg Score</p>
            <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
              {averageScore != null ? `${averageScore}%` : '--'}
            </p>
          </div>
        </div>
      </div>

      {!hasData && (
        <div className="rounded-xl border border-dashed border-blue-200/70 dark:border-blue-700/40 bg-blue-50/60 dark:bg-blue-900/15 p-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/15 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 flex items-center justify-center">
              <Icon name="Sparkles" size={18} />
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Build a complete dashboard signal</h3>
              <ul className="space-y-1 text-xs sm:text-sm text-gray-600 dark:text-slate-300">
                <li>1. Publish an open role to attract qualified candidates.</li>
                <li>2. Move the first strong applicant into interviewing and monitor progression.</li>
                <li>3. Review completed sessions to unlock AI trend analytics.</li>
              </ul>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={onCreateJob}
                  className="rounded-full bg-gradient-to-r from-blue-600 to-purple-600 border-none text-white"
                >
                  Create Job
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onScheduleInterview}
                  className="rounded-full"
                >
                  Schedule Interview
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onOpenCandidates}
                  className="rounded-full text-gray-600 dark:text-slate-300"
                >
                  Open Candidates
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="rounded-xl border border-white/40 dark:border-slate-700/60 bg-white/70 dark:bg-slate-900/40 p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Interview Volume (6 weeks)</h3>
            <span className="text-xs text-gray-500 dark:text-slate-400">
              Completed: {completedCount}
            </span>
          </div>
          {chartsEnabled ? (
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={volumeSeries} margin={{ top: 8, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.04} />
                    </linearGradient>
                    <linearGradient id="completedGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                  <Tooltip content={<VolumeTooltip />} />
                  <Area type="monotone" dataKey="interviews" stroke="#3b82f6" strokeWidth={2.2} fill="url(#volumeGradient)" />
                  <Area type="monotone" dataKey="completed" stroke="#10b981" strokeWidth={2} fill="url(#completedGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-44 rounded-lg border border-dashed border-slate-300/70 dark:border-slate-600/60 bg-slate-50/70 dark:bg-slate-900/40 flex items-center justify-center px-4 text-center">
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Chart preview appears in the live dashboard client.
              </p>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-white/40 dark:border-slate-700/60 bg-white/70 dark:bg-slate-900/40 p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Pipeline Distribution</h3>
            <span className="text-xs text-gray-500 dark:text-slate-400">Live</span>
          </div>
          {chartsEnabled ? (
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stageData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} interval={0} angle={-18} textAnchor="end" height={40} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip
                    formatter={(value) => [value, 'Candidates']}
                    contentStyle={{ borderRadius: 10, border: '1px solid rgba(148,163,184,0.25)', fontSize: 12 }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {stageData.map((entry) => (
                      <Cell key={entry.key} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-44 rounded-lg border border-dashed border-slate-300/70 dark:border-slate-600/60 bg-slate-50/70 dark:bg-slate-900/40 flex items-center justify-center px-4 text-center">
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Pipeline chart is available in the live dashboard client.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HiringInsightsBoard;
