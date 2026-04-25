import React from 'react';
import Icon from '../../../components/AppIcon';
import { getInterviewRoundSummary } from '../../../utils/interviewRoundSummary.js';
import { getCandidateUpcomingScheduledInterviews } from '../../../utils/candidateInterviewWindows.js';

const formatCompanyLabel = (company) => {
  if (!company) return '';
  if (typeof company === 'string') return company;
  if (typeof company === 'object') {
    return company.displayName || company.name || company.companyName || company.fullName || company.email || '';
  }
  return '';
};

const formatInterviewDate = (value) => {
  if (!value) return '';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '';
    const parsed = Date.parse(trimmed);
    return Number.isNaN(parsed) ? trimmed : new Date(parsed).toLocaleDateString();
  }
  if (typeof value?.toDate === 'function') {
    const date = value.toDate();
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
};

// Accept `progressData` (legacy), `analytics`, `interviews`, `dashboardMetrics`, and `practiceStats` (or `user`) from parent.
const ProgressOverviewCard = ({ progressData, analytics, interviews = [], dashboardMetrics, practiceStats: practiceStatsProp, user }) => {
  // Prefer explicit progressData, then analytics, then an empty object
  const data = progressData || analytics || {};
  const practiceStats = practiceStatsProp ?? user?.practiceStats ?? null;

  // Use comparison metrics if available
  const scoreMetrics = dashboardMetrics?.averageScore;
  const completedMetrics = dashboardMetrics?.completedInterviews;
  const gradeMetrics = dashboardMetrics?.currentGrade;

  // Use real data fields from backend analytics or dashboardMetrics
  const completedSessions = completedMetrics?.value ?? data?.completedInterviews ?? data?.completedSessions ?? 0;
  const totalInterviews = dashboardMetrics?.totalInterviews ?? data?.totalInterviews ?? 0;
  const averageScore = scoreMetrics?.value ?? data?.averageScore ?? 0;
  
  // Calculate derived metrics from real interview data
  const safeInterviews = Array.isArray(interviews) ? interviews : [];
  
  // Find the next scheduled interview
  const scheduledInterviews = getCandidateUpcomingScheduledInterviews(safeInterviews);
  const nextScheduledInterview = scheduledInterviews[0] || null;
  
  // Calculate time left for next interview
  let timeLeftText = '';
  if (nextScheduledInterview?.scheduledFor) {
    const scheduledDate = new Date(nextScheduledInterview.scheduledFor);
    const now = new Date();
    const diffMs = scheduledDate - now;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) {
      timeLeftText = 'Today';
    } else if (diffDays === 1) {
      timeLeftText = '1 day';
    } else {
      timeLeftText = `${diffDays} days`;
    }
  }
  
  // Use grade from metrics or calculate
  const getGrade = (score) => {
    if (!score || score === 0) return 'N/A';
    if (score >= 90) return 'A+';
    if (score >= 85) return 'A';
    if (score >= 80) return 'B+';
    if (score >= 75) return 'B';
    if (score >= 70) return 'C+';
    if (score >= 65) return 'C';
    return 'D';
  };
  const currentGrade = gradeMetrics?.value ?? getGrade(averageScore);
  
  // Get change color based on changeType
  const getChangeColor = (changeType) => {
    if (changeType === 'positive') return 'text-emerald-600 dark:text-emerald-400';
    if (changeType === 'negative') return 'text-rose-500 dark:text-rose-400';
    return 'text-gray-500 dark:text-slate-400';
  };

  const progressPercentage = Math.min((completedSessions / 20) * 100, 100);
  const nextInterviewCompany = formatCompanyLabel(nextScheduledInterview?.organization || nextScheduledInterview?.company);
  const nextInterviewDate = formatInterviewDate(nextScheduledInterview?.scheduledFor);
  const nextInterviewRound = getInterviewRoundSummary(nextScheduledInterview);
  const nextInterviewSummary = [nextInterviewCompany, nextInterviewDate]
    .filter(Boolean)
    .join(' - ') || 'Upcoming interview';

  return (
    <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4 sm:p-5 shadow-[0_25px_70px_rgba(15,23,42,0.12)] dark:shadow-[0_25px_70px_rgba(0,0,0,0.4)] backdrop-blur">
      <div className="flex items-center justify-between mb-4 sm:mb-5">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100">Your Progress</h2>
        <div className="flex items-center space-x-2">
          {gradeMetrics?.changeText && gradeMetrics.changeText !== 'Maintained' ? (
            <span className={`text-sm font-medium ${getChangeColor(gradeMetrics.changeType)}`}>
              {gradeMetrics.changeText}
            </span>
          ) : (
            <>
              <Icon name="Award" size={20} className="text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-blue-600 dark:text-blue-400">{totalInterviews} Total</span>
            </>
          )}
        </div>
      </div>
      {/* Progress Ring */}
      <div className="flex items-center justify-center mb-5">
        <div className="relative w-24 h-24 sm:w-28 sm:h-28">
          <svg className="w-24 h-24 sm:w-28 sm:h-28 transform -rotate-90 drop-shadow-[0_10px_30px_rgba(59,130,246,0.25)]" viewBox="0 0 120 120">
            <circle
              cx="60"
              cy="60"
              r="50"
              stroke="rgba(148,163,184,0.35)"
              strokeWidth="8"
              fill="none"
            />
            <circle
              cx="60"
              cy="60"
              r="50"
              stroke="url(#progressGradient)"
              strokeWidth="9"
              fill="none"
              strokeDasharray={`${progressPercentage * 3.14} 314`}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
            <defs>
              <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#2563eb" />
                <stop offset="100%" stopColor="#a855f7" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-slate-100">{completedSessions}</span>
            <span className="text-xs text-gray-500 dark:text-slate-400">Sessions</span>
          </div>
        </div>
      </div>
      {/* Practice streak */}
      {practiceStats && (practiceStats.currentStreak > 0 || practiceStats.longestStreak > 0) && (
        <div className="rounded-xl border border-amber-200/60 dark:border-amber-600/40 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 p-3 mb-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Icon name="Flame" size={18} className="text-amber-500 dark:text-amber-400" />
              <span className="text-sm font-medium text-gray-900 dark:text-slate-100">Practice streak</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-amber-600 dark:text-amber-400 font-semibold">
                {practiceStats.currentStreak || 0} day{(practiceStats.currentStreak || 0) !== 1 ? 's' : ''}
              </span>
              <span className="text-gray-500 dark:text-slate-400">Best: {practiceStats.longestStreak || 0}</span>
            </div>
          </div>
          {practiceStats.lastPracticeDate && (
            <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">
              Last practice: {new Date(practiceStats.lastPracticeDate).toLocaleDateString()}
            </div>
          )}
        </div>
      )}
      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <div className="text-center">
          <div className="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100">
            {scheduledInterviews.length}
          </div>
          <div className="text-xs sm:text-sm text-gray-500 dark:text-slate-400">Upcoming</div>
        </div>
        <div className="text-center">
          <div className="text-base sm:text-lg font-semibold text-green-600 dark:text-green-400">
            {averageScore > 0 ? `${Math.round(averageScore)}%` : 'N/A'}
          </div>
          <div className="text-xs sm:text-sm text-gray-500 dark:text-slate-400">Avg Score</div>
          {scoreMetrics?.changeText && (
            <div className={`text-xs font-medium mt-0.5 ${getChangeColor(scoreMetrics.changeType)}`}>
              {scoreMetrics.changeText}
            </div>
          )}
        </div>
        <div className="text-center">
          <div className="text-base sm:text-lg font-semibold text-purple-600 dark:text-purple-400">{currentGrade}</div>
          <div className="text-xs sm:text-sm text-gray-500 dark:text-slate-400">Grade</div>
          {gradeMetrics?.changeText && gradeMetrics.changeText !== 'Maintained' && (
            <div className={`text-xs font-medium mt-0.5 ${getChangeColor(gradeMetrics.changeType)}`}>
              {gradeMetrics.changeText}
            </div>
          )}
        </div>
      </div>
      {/* Next Interview */}
      {nextScheduledInterview && (
        <div className="rounded-xl border border-blue-200/40 dark:border-blue-700/50 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 p-3.5 sm:p-4 shadow-inner shadow-blue-500/10">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/80 dark:bg-slate-800/80 flex items-center justify-center shadow">
              <Icon name="Calendar" size={20} color="#2563eb" />
            </div>
            <div className="flex-1">
              <div className="font-medium text-gray-900 dark:text-slate-100">Upcoming Interview</div>
              <div className="text-sm text-gray-600 dark:text-slate-300">
                {nextInterviewSummary}
              </div>
              {nextInterviewRound && (
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center rounded-full border border-violet-200/80 dark:border-violet-500/30 bg-violet-50/80 dark:bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-violet-700 dark:text-violet-200">
                    {nextInterviewRound.badge}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-slate-400">
                    {nextInterviewRound.title}
                  </span>
                </div>
              )}
            </div>
            {timeLeftText && (
              <div className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                {timeLeftText}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProgressOverviewCard;
