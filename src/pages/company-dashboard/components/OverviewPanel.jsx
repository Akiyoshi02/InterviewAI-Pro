import React from 'react';
import Icon from '../../../components/AppIcon';


const OverviewPanel = ({ 
  activeJobPostings = 12,
  pendingReviews = 8,
  upcomingInterviews = 5,
  onViewAllJobs,
  onViewPendingReviews,
  onViewUpcomingInterviews
}) => {
  const overviewStats = [
    {
      id: 'active-jobs',
      title: 'Active Job Postings',
      value: activeJobPostings,
      icon: 'Briefcase',
      gradient: 'from-blue-600 to-purple-600',
      change: '+3 this week',
      changeType: 'positive',
      onClick: onViewAllJobs
    },
    {
      id: 'pending-reviews',
      title: 'Pending Reviews',
      value: pendingReviews,
      icon: 'Clock',
      gradient: 'from-amber-500 to-orange-500',
      change: '2 urgent',
      changeType: 'urgent',
      onClick: onViewPendingReviews
    },
    {
      id: 'upcoming-interviews',
      title: 'Upcoming Interviews',
      value: upcomingInterviews,
      icon: 'Calendar',
      gradient: 'from-emerald-500 to-teal-500',
      change: 'Today: 2',
      changeType: 'neutral',
      onClick: onViewUpcomingInterviews
    }
  ];

  const getChangeColor = (type) => {
    switch (type) {
      case 'positive':
        return 'text-emerald-600 dark:text-emerald-400';
      case 'urgent':
        return 'text-rose-500 dark:text-rose-400';
      default:
        return 'text-gray-500 dark:text-slate-400';
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
      {overviewStats?.map((stat) => (
        <div
          key={stat?.id}
          className="rounded-2xl border border-white/30 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-3 sm:p-4 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(15,23,42,0.1)] dark:hover:shadow-[0_10px_30px_rgba(0,0,0,0.3)] transition-all duration-200 cursor-pointer group backdrop-blur"
          onClick={stat?.onClick}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2.5 mb-2 sm:mb-3">
                <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br ${stat?.gradient} flex items-center justify-center text-white group-hover:scale-105 transition-transform duration-200 shadow-lg shadow-blue-500/25 flex-shrink-0`}>
                  <Icon name={stat?.icon} size={18} color="currentColor" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-xs sm:text-sm font-medium text-gray-500 dark:text-slate-400 truncate">
                    {stat?.title}
                  </h3>
                  <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-slate-100">
                    {stat?.value}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className={`text-xs sm:text-sm font-medium ${getChangeColor(stat?.changeType)}`}>
                  {stat?.change}
                </span>
                <Icon 
                  name="ArrowRight" 
                  size={16} 
                  className="text-gray-400 dark:text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200" 
                />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default OverviewPanel;
