import React from 'react';
import Icon from '../../../components/AppIcon';

const formatCompanyLabel = (company) => {
  if (!company) return '';
  if (typeof company === 'string') return company;
  if (typeof company === 'object') {
    return company.companyName || company.fullName || company.email || '';
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

// Accept `progressData` (legacy), `analytics`, `interviews`, and `dashboardMetrics` props from parent.
const ProgressOverviewCard = ({ progressData, analytics, interviews = [], dashboardMetrics }) => {
  // Prefer explicit progressData, then analytics, then an empty object
  const data = progressData || analytics || {};

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
  const scheduledInterviews = safeInterviews
    .filter(i => i?.status?.toUpperCase() === 'SCHEDULED' && i?.scheduledFor)
    .sort((a, b) => new Date(a.scheduledFor) - new Date(b.scheduledFor));
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
    if (!score || score === 0) return '—';
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
  const nextInterviewCompany = formatCompanyLabel(nextScheduledInterview?.company);
  const nextInterviewDate = formatInterviewDate(nextScheduledInterview?.scheduledFor);
  const nextInterviewSummary = [nextInterviewCompany, nextInterviewDate]
    .filter(Boolean)
    .join(' - ') || 'Upcoming interview';

  return (
    <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-3 sm:p-4 shadow-[0_25px_70px_rgba(15,23,42,0.12)] dark:shadow-[0_25px_70px_rgba(0,0,0,0.4)] backdrop-blur">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
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
      <div className="flex items-center justify-center mb-4">
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
      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center">
          <div className="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100">
            {scheduledInterviews.length}
          </div>
          <div className="text-xs text-gray-500 dark:text-slate-400">Upcoming</div>
        </div>
        <div className="text-center">
          <div className="text-base sm:text-lg font-semibold text-green-600 dark:text-green-400">
            {averageScore > 0 ? `${Math.round(averageScore)}%` : '—'}
          </div>
          <div className="text-xs text-gray-500 dark:text-slate-400">Avg Score</div>
          {scoreMetrics?.changeText && (
            <div className={`text-[10px] font-medium mt-0.5 ${getChangeColor(scoreMetrics.changeType)}`}>
              {scoreMetrics.changeText}
            </div>
          )}
        </div>
        <div className="text-center">
          <div className="text-base sm:text-lg font-semibold text-purple-600 dark:text-purple-400">{currentGrade}</div>
          <div className="text-xs text-gray-500 dark:text-slate-400">Grade</div>
          {gradeMetrics?.changeText && gradeMetrics.changeText !== 'Maintained' && (
            <div className={`text-[10px] font-medium mt-0.5 ${getChangeColor(gradeMetrics.changeType)}`}>
              {gradeMetrics.changeText}
            </div>
          )}
        </div>
      </div>
      {/* Next Interview */}
      {nextScheduledInterview && (
        <div className="rounded-xl border border-blue-200/40 dark:border-blue-700/50 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 p-3 shadow-inner shadow-blue-500/10">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/80 dark:bg-slate-800/80 flex items-center justify-center shadow">
              <Icon name="Calendar" size={20} color="#2563eb" />
            </div>
            <div className="flex-1">
              <div className="font-medium text-gray-900 dark:text-slate-100">Upcoming Interview</div>
              <div className="text-sm text-gray-600 dark:text-slate-300">
                {nextInterviewSummary}
              </div>
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
