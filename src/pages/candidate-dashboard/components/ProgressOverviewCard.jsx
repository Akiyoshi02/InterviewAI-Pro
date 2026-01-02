import React from 'react';
import Icon from '../../../components/AppIcon';

// Accept either `progressData` (legacy) or `analytics` prop from parent.
const ProgressOverviewCard = ({ progressData, analytics }) => {
  // Prefer explicit progressData, then analytics, then an empty object
  const data = progressData || analytics || {};

  const {
    completedSessions = 0,
    totalHours = 0,
    averageScore = 0,
    improvementRate = 0,
    nextInterview = null
  } = data;

  const progressPercentage = Math.min((completedSessions / 20) * 100, 100);

  return (
    <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-3 sm:p-4 shadow-[0_25px_70px_rgba(15,23,42,0.12)] dark:shadow-[0_25px_70px_rgba(0,0,0,0.4)] backdrop-blur">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100">Your Progress</h2>
        <div className="flex items-center space-x-2 text-green-600 dark:text-green-400">
          <Icon name="TrendingUp" size={20} />
          <span className="text-sm font-medium">+{improvementRate}% this month</span>
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
          <div className="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100">{totalHours}h</div>
          <div className="text-xs text-gray-500 dark:text-slate-400">Practice Time</div>
        </div>
        <div className="text-center">
          <div className="text-base sm:text-lg font-semibold text-green-600 dark:text-green-400">{averageScore}%</div>
          <div className="text-xs text-gray-500 dark:text-slate-400">Avg Score</div>
        </div>
        <div className="text-center">
          <div className="text-base sm:text-lg font-semibold text-purple-600 dark:text-purple-400">A+</div>
          <div className="text-xs text-gray-500 dark:text-slate-400">Current Grade</div>
        </div>
      </div>
      {/* Next Interview */}
      {nextInterview && (
        <div className="rounded-xl border border-blue-200/40 dark:border-blue-700/50 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 p-3 shadow-inner shadow-blue-500/10">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/80 dark:bg-slate-800/80 flex items-center justify-center shadow">
              <Icon name="Calendar" size={20} color="#2563eb" />
            </div>
            <div className="flex-1">
              <div className="font-medium text-gray-900 dark:text-slate-100">Upcoming Interview</div>
              <div className="text-sm text-gray-600 dark:text-slate-300">
                {nextInterview?.company} • {nextInterview?.date}
              </div>
            </div>
            <div className="text-sm font-semibold text-blue-600 dark:text-blue-400">
              {nextInterview?.timeLeft}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProgressOverviewCard;