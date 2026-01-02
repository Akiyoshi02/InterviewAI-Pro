import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../AppIcon';
import Button from './Button';

const DashboardQuickActions = ({ 
  userType = 'candidate',
  recentActivity = [],
  onActionClick,
  className = ''
}) => {
  const navigate = useNavigate();
  const candidateActions = [
    {
      id: 'start-practice',
      title: 'Start Practice Interview',
      description: 'Begin a new AI-powered practice session',
      icon: 'Play',
      variant: 'default',
      path: '/practice-interview-setup',
      color: 'bg-gradient-to-br from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/40'
    },
    {
      id: 'browse-jobs',
      title: 'Browse Jobs',
      description: 'Explore available job opportunities',
      icon: 'Briefcase',
      variant: 'secondary',
      path: '/jobs',
      color: 'bg-gradient-to-br from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/30'
    },
    {
      id: 'view-progress',
      title: 'View Progress',
      description: 'Check your interview performance',
      icon: 'TrendingUp',
      variant: 'outline',
      path: '/candidate-dashboard',
      color: 'bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/30'
    }
  ];

  const companyActions = [
    {
      id: 'setup-interview',
      title: 'Setup New Interview',
      description: 'Configure interview parameters and questions',
      icon: 'Settings',
      variant: 'default',
      path: '/practice-interview-setup',
      color: 'bg-gradient-to-br from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/40'
    },
    {
      id: 'review-candidates',
      title: 'Review Candidates',
      description: 'Evaluate completed interview sessions',
      icon: 'Users',
      variant: 'secondary',
      path: '/company-dashboard',
      color: 'bg-gradient-to-br from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/30'
    },
    {
      id: 'live-session',
      title: 'Start Live Session',
      description: 'Begin real-time candidate interview',
      icon: 'Video',
      variant: 'outline',
      path: '/live-interview-session',
      color: 'bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/30'
    }
  ];

  const actions = userType === 'candidate' ? candidateActions : companyActions;

  const handleActionClick = (action) => {
    if (onActionClick) {
      onActionClick(action);
    } else {
      navigate(action?.path);
    }
  };

  const getRecentActivityIcon = (type) => {
    const iconMap = {
      practice: 'Play',
      live: 'Video',
      review: 'FileText',
      setup: 'Settings',
      completed: 'CheckCircle'
    };
    return iconMap?.[type] || 'Activity';
  };

  const getActivityTimeAgo = (timestamp) => {
    const now = new Date();
    const activityTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now - activityTime) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)}h ago`;
    } else {
      return `${Math.floor(diffInMinutes / 1440)}d ago`;
    }
  };

  const getActionButtonClasses = (variant) => {
    switch (variant) {
      case 'default':
        return 'rounded-full bg-gradient-to-r from-blue-600 to-purple-600 border-none text-white shadow-md shadow-blue-500/30 hover:from-blue-700 hover:to-purple-700';
      case 'secondary':
        return 'rounded-full bg-white/80 dark:bg-slate-800/80 border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:border-blue-400 dark:hover:border-blue-600';
      case 'outline':
        return 'rounded-full border border-gray-200 dark:border-slate-700 bg-transparent text-gray-700 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400';
      case 'ghost':
        return 'rounded-full text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400';
      default:
        return 'rounded-full';
    }
  };

  return (
    <div className={`space-y-2 sm:space-y-3 ${className}`}>
      {/* Quick Actions Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
        {actions?.map((action) => (
          <div
            key={action?.id}
            className="rounded-2xl border border-white/30 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-3 sm:p-4 shadow-[0_15px_40px_rgba(15,23,42,0.08)] dark:shadow-[0_15px_40px_rgba(0,0,0,0.3)] backdrop-blur hover:-translate-y-0.5 hover:shadow-[0_20px_50px_rgba(59,130,246,0.2)] dark:hover:shadow-[0_20px_50px_rgba(59,130,246,0.25)] transition-all duration-200 cursor-pointer group"
            onClick={() => handleActionClick(action)}
          >
            <div className="flex items-start space-x-2.5 sm:space-x-3">
              <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center text-white ${action?.color} group-hover:scale-105 transition-transform duration-200 flex-shrink-0`}>
                <Icon name={action?.icon} size={18} className="sm:w-5 sm:h-5" color="currentColor" />
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200">
                  {action?.title}
                </h3>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 mt-0.5 sm:mt-1 line-clamp-2">
                  {action?.description}
                </p>
                
                <div className="mt-2 sm:mt-3">
                  <Button
                    variant={action?.variant}
                    size="sm"
                    iconName="ArrowRight"
                    iconPosition="right"
                    className={`${getActionButtonClasses(action?.variant)} text-xs sm:text-sm`}
                    onClick={(e) => {
                      e?.stopPropagation();
                      handleActionClick(action);
                    }}
                  >
                    {userType === 'candidate' ? 'Start' : 'Setup'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* Recent Activity */}
      {recentActivity?.length > 0 && (
        <div className="rounded-3xl border border-white/30 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4 sm:p-5 md:p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.3)] backdrop-blur">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100">Recent Activity</h3>
            <Button
              variant="ghost"
              size="sm"
              iconName="MoreHorizontal"
              className="text-xs sm:text-sm rounded-full text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
            >
              View All
            </Button>
          </div>
          
          <div className="space-y-2 sm:space-y-3">
            {recentActivity?.slice(0, 5)?.map((activity, index) => (
              <div
                key={index}
                className="flex items-center space-x-2 sm:space-x-3 p-2 sm:p-3 rounded-2xl hover:bg-white/60 dark:hover:bg-slate-800/60 transition-colors duration-200"
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 border border-white/60 dark:border-slate-700/50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Icon 
                    name={getRecentActivityIcon(activity?.type)} 
                    size={14} 
                    className="sm:w-4 sm:h-4 text-blue-600 dark:text-blue-400"
                  />
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                    {activity?.title}
                  </p>
                  <p className="text-[10px] sm:text-xs text-gray-500 dark:text-slate-400 truncate">
                    {activity?.description}
                  </p>
                </div>
                
                <div className="text-[10px] sm:text-xs text-gray-400 dark:text-slate-500 font-mono flex-shrink-0">
                  {getActivityTimeAgo(activity?.timestamp)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {userType === 'candidate' ? (
          <>
            <div className="rounded-2xl border border-white/30 dark:border-slate-700/50 bg-white/70 dark:bg-slate-800/70 p-3 sm:p-4 text-center shadow-sm">
              <div className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">12</div>
              <div className="text-xs sm:text-sm text-gray-500 dark:text-slate-400">Practice Sessions</div>
            </div>
            <div className="rounded-2xl border border-white/30 dark:border-slate-700/50 bg-white/70 dark:bg-slate-800/70 p-3 sm:p-4 text-center shadow-sm">
              <div className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400">85%</div>
              <div className="text-xs sm:text-sm text-gray-500 dark:text-slate-400">Avg Score</div>
            </div>
            <div className="rounded-2xl border border-white/30 dark:border-slate-700/50 bg-white/70 dark:bg-slate-800/70 p-3 sm:p-4 text-center shadow-sm">
              <div className="text-xl sm:text-2xl font-bold text-purple-600 dark:text-purple-400">3</div>
              <div className="text-xs sm:text-sm text-gray-500 dark:text-slate-400">Live Interviews</div>
            </div>
            <div className="rounded-2xl border border-white/30 dark:border-slate-700/50 bg-white/70 dark:bg-slate-800/70 p-3 sm:p-4 text-center shadow-sm">
              <div className="text-xl sm:text-2xl font-bold text-cyan-600 dark:text-cyan-400">24h</div>
              <div className="text-xs sm:text-sm text-gray-500 dark:text-slate-400">Total Practice</div>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-2xl border border-white/30 dark:border-slate-700/50 bg-white/70 dark:bg-slate-800/70 p-3 sm:p-4 text-center shadow-sm">
              <div className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">48</div>
              <div className="text-xs sm:text-sm text-gray-500 dark:text-slate-400">Candidates</div>
            </div>
            <div className="rounded-2xl border border-white/30 dark:border-slate-700/50 bg-white/70 dark:bg-slate-800/70 p-3 sm:p-4 text-center shadow-sm">
              <div className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400">92%</div>
              <div className="text-xs sm:text-sm text-gray-500 dark:text-slate-400">Completion Rate</div>
            </div>
            <div className="rounded-2xl border border-white/30 dark:border-slate-700/50 bg-white/70 dark:bg-slate-800/70 p-3 sm:p-4 text-center shadow-sm">
              <div className="text-xl sm:text-2xl font-bold text-purple-600 dark:text-purple-400">15</div>
              <div className="text-xs sm:text-sm text-gray-500 dark:text-slate-400">Active Sessions</div>
            </div>
            <div className="rounded-2xl border border-white/30 dark:border-slate-700/50 bg-white/70 dark:bg-slate-800/70 p-3 sm:p-4 text-center shadow-sm">
              <div className="text-xl sm:text-2xl font-bold text-cyan-600 dark:text-cyan-400">4.8</div>
              <div className="text-xs sm:text-sm text-gray-500 dark:text-slate-400">Avg Rating</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DashboardQuickActions;
