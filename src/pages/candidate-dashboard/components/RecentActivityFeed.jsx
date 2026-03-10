import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { getInterviewRoundSummary } from '../../../utils/interviewRoundSummary.js';

const RecentActivityFeed = ({ activities = [], onViewAll, onViewHistory }) => {
  const navigate = useNavigate();
  const [showAllActivities, setShowAllActivities] = useState(false);

  // Transform real interview data into activity format
  const transformInterviewsToActivities = (interviews) => {
    if (!Array.isArray(interviews) || interviews.length === 0) return [];
    
    return interviews.map((interview, index) => {
      const status = interview?.status?.toUpperCase();
      const companyName = interview?.organization?.displayName
                         || interview?.organization?.name
                         || interview?.company?.companyName
                         || interview?.company?.fullName
                         || interview?.company?.email
                         || (typeof interview?.company === 'string' ? interview.company : null)
                         || 'Practice Session';
      const jobRole = interview?.jobRole || interview?.position || 'Interview';
      const score = interview?.overallScore || interview?.score;
      const createdAt = interview?.createdAt || interview?.updatedAt;
      const timestamp = createdAt ? new Date(createdAt) : new Date();
      const roundSummary = getInterviewRoundSummary(interview);
      
      // Determine activity type based on interview status and type
      let type = 'practice';
      let title = '';
      let description = '';
      
      if (status === 'COMPLETED') {
        type = 'completed';
        title = `Completed ${jobRole} Interview${roundSummary ? ` - ${roundSummary.badge}` : ''}`;
        description = score ? `Score: ${Math.round(score)}%` : 'Interview completed';
        if (companyName && companyName !== 'Practice Session') {
          description = `${companyName} - ${description}`;
        }
      } else if (status === 'IN_PROGRESS') {
        type = 'live';
        title = `${jobRole}${roundSummary ? ` - ${roundSummary.badge}` : ''} - In Progress`;
        description = companyName !== 'Practice Session' ? `With ${companyName}` : 'Practice session in progress';
      } else if (status === 'SCHEDULED') {
        type = 'live';
        const scheduledDate = interview?.scheduledFor ? new Date(interview.scheduledFor) : null;
        title = `Upcoming: ${companyName} - ${jobRole}${roundSummary ? ` (${roundSummary.badge})` : ''}`;
        description = scheduledDate 
          ? `${scheduledDate.toLocaleDateString()}${roundSummary ? ` - ${roundSummary.title}` : ''}`
          : 'Date pending';
      } else if (status === 'PENDING') {
        type = 'live';
        title = `Interview Pending: ${jobRole}${roundSummary ? ` - ${roundSummary.badge}` : ''}`;
        description = companyName !== 'Practice Session'
          ? `${companyName} - waiting for schedule confirmation`
          : 'Waiting for schedule confirmation';
      } else {
        type = 'practice';
        title = `${jobRole} Session`;
        description = companyName !== 'Practice Session' ? companyName : 'Practice interview';
      }
      
      return {
        id: interview?.id || `interview-${index}`,
        type,
        title,
        description,
        timestamp,
        score: score ? Math.round(score) : null,
        feedback: interview?.feedback?.summary || interview?.evaluation?.summary || null,
        company: companyName
      };
    });
  };

  // Use transformed real data - no mock fallback
  const activityData = transformInterviewsToActivities(activities);
  const hasActivities = activityData.length > 0;
  const visibleActivities = showAllActivities ? activityData : activityData.slice(0, 6);

  const getActivityIcon = (type) => {
    const iconMap = {
      practice: 'Play',
      achievement: 'Award',
      feedback: 'FileText',
      live: 'Video',
      completed: 'CheckCircle'
    };
    return iconMap?.[type] || 'Activity';
  };

  const getActivityColor = (type) => {
    const colorMap = {
      practice: 'bg-gradient-to-br from-blue-600 to-purple-600',
      achievement: 'bg-gradient-to-br from-purple-500 to-pink-500',
      feedback: 'bg-gradient-to-br from-cyan-500 to-blue-500',
      live: 'bg-gradient-to-br from-emerald-500 to-teal-500',
      completed: 'bg-gradient-to-br from-emerald-500 to-teal-500'
    };
    return colorMap?.[type] || 'bg-gradient-to-br from-slate-400 to-slate-500';
  };

  const handleViewAll = () => {
    if (typeof onViewAll === 'function') {
      onViewAll({ activities: activityData, showAllActivities });
      return;
    }
    if (!hasActivities && typeof onViewHistory === 'function') {
      onViewHistory({ activities: activityData, showAllActivities });
      return;
    }
    setShowAllActivities((prev) => !prev);
  };

  const handleViewHistory = () => {
    if (typeof onViewHistory === 'function') {
      onViewHistory({ activities: activityData, showAllActivities });
      return;
    }
    if (!hasActivities) {
      return;
    }
    setShowAllActivities(true);
  };

  const getTimeAgo = (timestamp) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now - timestamp) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)}h ago`;
    } else {
      return `${Math.floor(diffInMinutes / 1440)}d ago`;
    }
  };

  const getScoreColor = (score) => {
    if (score >= 90) return 'text-green-600 dark:text-emerald-400';
    if (score >= 70) return 'text-purple-600 dark:text-purple-400';
    return 'text-rose-500 dark:text-rose-400';
  };

  const viewAllLabel = hasActivities
    ? (showAllActivities ? 'Show Less' : 'View All')
    : (typeof onViewHistory === 'function' ? 'Explore Applications' : 'View All');

  const historyLabel = hasActivities
    ? (showAllActivities ? 'Activity History Expanded' : 'View Complete Activity History')
    : (typeof onViewHistory === 'function' ? 'Open My Applications' : 'View Complete Activity History');

  return (
    <div className="rounded-2xl border border-white/30 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4 sm:p-5 shadow-[0_20px_60px_rgba(15,23,42,0.12)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur">
      <div className="flex items-center justify-between mb-4 sm:mb-5">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100">Recent Activity</h2>
        <Button
          variant="ghost"
          size="sm"
          iconName="MoreHorizontal"
          onClick={handleViewAll}
          className="rounded-full text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
        >
          {viewAllLabel}
        </Button>
      </div>
      <div className="space-y-3">
        {visibleActivities?.length > 0 ? visibleActivities?.map((activity) => (
          <div
            key={activity?.id}
            className="flex items-start gap-3 p-3 sm:p-3.5 rounded-xl border border-white/40 dark:border-slate-700/50 hover:bg-white/70 dark:hover:bg-slate-800/70 transition-colors duration-200"
          >
            <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-white ${getActivityColor(activity?.type)}`}>
              <Icon name={getActivityIcon(activity?.type)} size={16} color="currentColor" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1">
                  <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-slate-100 break-words leading-snug sm:line-clamp-2">
                    {activity?.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 mt-1 leading-relaxed">
                    {activity?.description}
                  </p>

                  {/* Activity-specific details */}
                  {activity?.score && (
                    <div className="mt-2 flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-1">
                      <span className={`text-sm font-medium ${getScoreColor(activity?.score)}`}>
                        Score: {activity?.score}%
                      </span>
                      {activity?.feedback && (
                        <span className="text-xs text-gray-500 dark:text-slate-400 break-words whitespace-normal leading-relaxed">
                          "{activity?.feedback}"
                        </span>
                      )}
                      {activity?.type === 'completed' && activity?.id && (
                        <button
                          type="button"
                          onClick={() => navigate(`/interview-results/${activity.id}`)}
                          className="self-start text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          View results
                        </button>
                      )}
                    </div>
                  )}

                  {activity?.badge && (
                    <div className="mt-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-300">
                        <Icon name="Award" size={12} className="mr-1" />
                        {activity?.badge}
                      </span>
                    </div>
                  )}

                  {activity?.insights && (
                    <div className="mt-2 text-sm text-gray-500 dark:text-slate-400">
                      {activity?.insights} new insights available
                    </div>
                  )}
                </div>

                <div className="self-start text-[11px] text-gray-400 dark:text-slate-500 font-mono tabular-nums sm:ml-4 sm:self-auto sm:text-xs">
                  {getTimeAgo(activity?.timestamp)}
                </div>
              </div>
            </div>
          </div>
        )) : (
          <div className="rounded-xl border border-dashed border-white/40 dark:border-slate-700/60 bg-white/60 dark:bg-slate-900/40 p-5 text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/30 mb-2">
              <Icon name="Activity" size={18} className="text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-slate-100">No activity yet</p>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 mt-1">
              Complete your first interview to build your activity timeline.
            </p>
          </div>
        )}
      </div>
      {/* View More Button */}
      <div className="mt-5 pt-4 border-t border-white/30 dark:border-slate-700/60">
        <Button
          variant="outline"
          fullWidth
          iconName="ArrowRight"
          iconPosition="right"
          onClick={handleViewHistory}
          className="rounded-full border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400"
        >
          {historyLabel}
        </Button>
      </div>
    </div>
  );
};

export default RecentActivityFeed;
