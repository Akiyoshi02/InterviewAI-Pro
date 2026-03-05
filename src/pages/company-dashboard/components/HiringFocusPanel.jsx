import React, { useMemo } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

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
  interview?.scheduledFor || interview?.createdAt || interview?.updatedAt || null;

const startOfToday = () => {
  const value = new Date();
  value.setHours(0, 0, 0, 0);
  return value;
};

const HiringFocusPanel = ({
  interviews = [],
  jobs = [],
  pendingReviews = 0,
  onOpenInterviews,
  onOpenCandidates,
  onOpenJobs,
}) => {
  const safeInterviews = Array.isArray(interviews) ? interviews : [];
  const safeJobs = Array.isArray(jobs) ? jobs : [];

  const upcomingInterviews = useMemo(() => {
    const now = startOfToday();
    const fourteenDaysFromNow = new Date(now);
    fourteenDaysFromNow.setDate(fourteenDaysFromNow.getDate() + 14);

    return safeInterviews
      .map((interview) => ({
        interview,
        date: toDate(interview?.scheduledFor || resolveInterviewTimestamp(interview)),
      }))
      .filter((entry) => entry.date && entry.date >= now && entry.date <= fourteenDaysFromNow)
      .sort((left, right) => left.date.getTime() - right.date.getTime())
      .slice(0, 4);
  }, [safeInterviews]);

  const activeJobs = safeJobs.filter((job) => String(job?.status || '').toUpperCase() === 'PUBLISHED').length;
  const inProgressInterviews = safeInterviews.filter(
    (interview) => String(interview?.status || '').toUpperCase() === 'IN_PROGRESS',
  ).length;
  const completedInterviews = safeInterviews.filter(
    (interview) => String(interview?.status || '').toUpperCase() === 'COMPLETED',
  ).length;

  const hiringHealthScore = useMemo(() => {
    let score = 50;
    score += Math.min(activeJobs * 8, 20);
    score += Math.min(inProgressInterviews * 6, 18);
    score += Math.min(completedInterviews * 3, 15);
    score -= Math.min(pendingReviews * 5, 25);
    return Math.max(0, Math.min(100, score));
  }, [activeJobs, completedInterviews, inProgressInterviews, pendingReviews]);

  const healthTone = hiringHealthScore >= 75
    ? 'text-emerald-600 dark:text-emerald-400'
    : hiringHealthScore >= 50
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-rose-500 dark:text-rose-400';

  return (
    <div className="rounded-2xl border border-white/30 dark:border-slate-700/50 bg-white/85 dark:bg-slate-800/85 p-3 sm:p-4 shadow-[0_20px_60px_rgba(15,23,42,0.12)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100">Focus Dashboard</h2>
          <p className="text-xs text-gray-500 dark:text-slate-400">What needs attention in the next two weeks.</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-[0.16em] text-gray-400 dark:text-slate-500">Health</p>
          <p className={`text-xl font-semibold ${healthTone}`}>{hiringHealthScore}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-slate-200/70 dark:border-slate-700/60 bg-slate-50/80 dark:bg-slate-900/40 px-2 py-2 text-center">
          <p className="text-lg font-semibold text-blue-700 dark:text-blue-300">{activeJobs}</p>
          <p className="text-[11px] text-gray-500 dark:text-slate-400">Open Roles</p>
        </div>
        <div className="rounded-lg border border-slate-200/70 dark:border-slate-700/60 bg-slate-50/80 dark:bg-slate-900/40 px-2 py-2 text-center">
          <p className="text-lg font-semibold text-purple-600 dark:text-purple-300">{inProgressInterviews}</p>
          <p className="text-[11px] text-gray-500 dark:text-slate-400">Live Interviews</p>
        </div>
        <div className="rounded-lg border border-slate-200/70 dark:border-slate-700/60 bg-slate-50/80 dark:bg-slate-900/40 px-2 py-2 text-center">
          <p className={`text-lg font-semibold ${pendingReviews > 0 ? 'text-rose-500 dark:text-rose-300' : 'text-emerald-600 dark:text-emerald-300'}`}>
            {pendingReviews}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-slate-400">Pending Reviews</p>
        </div>
      </div>

      <div className="rounded-xl border border-white/40 dark:border-slate-700/60 bg-white/70 dark:bg-slate-900/40 p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Upcoming Interview Queue</h3>
          <Button
            size="sm"
            variant="ghost"
            iconName="ExternalLink"
            iconPosition="right"
            onClick={onOpenInterviews}
            className="rounded-full text-xs text-gray-500 dark:text-slate-400"
          >
            Open
          </Button>
        </div>

        {upcomingInterviews.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300/80 dark:border-slate-600/60 bg-slate-50/70 dark:bg-slate-900/40 p-3 text-center">
            <Icon name="CalendarDays" size={18} className="mx-auto text-slate-400 mb-1.5" />
            <p className="text-xs text-gray-500 dark:text-slate-400">No upcoming interviews in the next 14 days.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {upcomingInterviews.map(({ interview, date }) => (
              <div
                key={interview?.id || `${date?.toISOString?.()}`}
                className="flex items-center justify-between rounded-lg border border-white/40 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/70 px-2.5 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                    {interview?.candidate?.fullName || interview?.candidate?.email || 'Candidate'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
                    {interview?.jobRole || interview?.job?.title || 'Interview'}
                  </p>
                </div>
                <p className="text-xs font-medium text-blue-700 dark:text-blue-300">
                  {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={onOpenCandidates}
          className="flex-1 min-w-[120px] rounded-full bg-gradient-to-r from-blue-600 to-purple-600 border-none text-white"
        >
          Review Candidates
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onOpenJobs}
          className="flex-1 min-w-[120px] rounded-full"
        >
          Manage Jobs
        </Button>
      </div>
    </div>
  );
};

export default HiringFocusPanel;
