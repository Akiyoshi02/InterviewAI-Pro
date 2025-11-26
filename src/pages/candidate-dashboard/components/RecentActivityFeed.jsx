import React from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const RecentActivityFeed = ({ activities = [] }) => {
  const mockActivities = [
    {
      id: 1,
      type: 'practice',
      title: 'Completed Software Engineer Practice',
      description: 'Advanced level • 45 minutes • Score: 92%',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      score: 92,
      feedback: 'Excellent technical knowledge demonstration'
    },
    {
      id: 2,
      type: 'achievement',
      title: 'Earned "Communication Expert" Badge',
      description: 'Achieved 90%+ in communication skills assessment',
      timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000),
      badge: 'Communication Expert'
    },
    {
      id: 3,
      type: 'practice',
      title: 'Product Manager Mock Interview',
      description: 'Intermediate level • 30 minutes • Score: 78%',
      timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      score: 78,
      feedback: 'Good strategic thinking, work on stakeholder management'
    },
    {
      id: 4,
      type: 'feedback',
      title: 'AI Feedback Report Generated',
      description: 'Comprehensive analysis of your last 5 sessions',
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      insights: 3
    },
    {
      id: 5,
      type: 'live',
      title: 'Live Interview with TechCorp',
      description: 'Scheduled for tomorrow • Senior Developer role',
      timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      company: 'TechCorp'
    }
  ];

  const activityData = activities?.length > 0 ? activities : mockActivities;

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

  return (
    <div className="rounded-3xl border border-white/30 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.12)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">Recent Activity</h2>
        <Button
          variant="ghost"
          size="sm"
          iconName="MoreHorizontal"
          className="rounded-full text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
        >
          View All
        </Button>
      </div>
      <div className="space-y-4">
        {activityData?.slice(0, 6)?.map((activity) => (
          <div
            key={activity?.id}
            className="flex items-start space-x-4 p-4 rounded-2xl border border-white/40 dark:border-slate-700/50 hover:bg-white/70 dark:hover:bg-slate-800/70 transition-colors duration-200 cursor-pointer"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-white ${getActivityColor(activity?.type)}`}>
              <Icon name={getActivityIcon(activity?.type)} size={20} color="currentColor" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900 dark:text-slate-100 truncate">
                    {activity?.title}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                    {activity?.description}
                  </p>

                  {/* Activity-specific details */}
                  {activity?.score && (
                    <div className="flex items-center space-x-4 mt-2">
                      <span className={`text-sm font-medium ${getScoreColor(activity?.score)}`}>
                        Score: {activity?.score}%
                      </span>
                      {activity?.feedback && (
                        <span className="text-xs text-gray-500 dark:text-slate-400">
                          "{activity?.feedback}"
                        </span>
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

                <div className="text-xs text-gray-400 dark:text-slate-500 font-mono ml-4">
                  {getTimeAgo(activity?.timestamp)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* View More Button */}
      <div className="mt-6 pt-4 border-t border-white/30 dark:border-slate-700/60">
        <Button
          variant="outline"
          fullWidth
          iconName="ArrowRight"
          iconPosition="right"
          className="rounded-full border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400"
        >
          View Complete Activity History
        </Button>
      </div>
    </div>
  );
};

export default RecentActivityFeed;