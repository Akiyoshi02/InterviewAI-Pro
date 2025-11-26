import React from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const HiringMetrics = ({ onExportReport }) => {
  const metrics = [
    {
      id: 'time-to-hire',
      title: 'Average Time to Hire',
      value: '18 days',
      change: '-3 days',
      changeType: 'positive',
      icon: 'Clock',
      gradient: 'from-blue-600 to-purple-600'
    },
    {
      id: 'satisfaction',
      title: 'Candidate Satisfaction',
      value: '4.8/5',
      change: '+0.2',
      changeType: 'positive',
      icon: 'Star',
      gradient: 'from-emerald-500 to-teal-500'
    },
    {
      id: 'completion',
      title: 'Interview Completion Rate',
      value: '94%',
      change: '+2%',
      changeType: 'positive',
      icon: 'CheckCircle',
      gradient: 'from-purple-500 to-pink-500'
    },
    {
      id: 'quality',
      title: 'Hire Quality Score',
      value: '87%',
      change: '+5%',
      changeType: 'positive',
      icon: 'TrendingUp',
      gradient: 'from-cyan-500 to-blue-500'
    }
  ];

  const recentActivity = [
    {
      id: 1,
      type: 'interview_completed',
      candidate: 'Sarah Johnson',
      position: 'Frontend Developer',
      timestamp: new Date(Date.now() - 1800000), // 30 minutes ago
      score: 92
    },
    {
      id: 2,
      type: 'candidate_approved',
      candidate: 'Michael Chen',
      position: 'Backend Developer',
      timestamp: new Date(Date.now() - 3600000), // 1 hour ago
      score: 88
    },
    {
      id: 3,
      type: 'interview_scheduled',
      candidate: 'Emily Rodriguez',
      position: 'UX Designer',
      timestamp: new Date(Date.now() - 7200000), // 2 hours ago
      score: null
    },
    {
      id: 4,
      type: 'template_created',
      candidate: null,
      position: 'Data Scientist',
      timestamp: new Date(Date.now() - 10800000), // 3 hours ago
      score: null
    }
  ];

  const getActivityIcon = (type) => {
    const iconMap = {
      interview_completed: 'CheckCircle',
      candidate_approved: 'UserCheck',
      interview_scheduled: 'Calendar',
      template_created: 'Settings'
    };
    return iconMap?.[type] || 'Activity';
  };

  const getActivityColor = (type) => {
    const colorMap = {
      interview_completed: 'text-emerald-600 dark:text-emerald-400',
      candidate_approved: 'text-blue-600 dark:text-blue-400',
      interview_scheduled: 'text-purple-600 dark:text-purple-400',
      template_created: 'text-cyan-500 dark:text-cyan-400'
    };
    return colorMap?.[type] || 'text-gray-500 dark:text-slate-400';
  };

  const getActivityMessage = (activity) => {
    switch (activity?.type) {
      case 'interview_completed':
        return `${activity?.candidate} completed interview for ${activity?.position} (Score: ${activity?.score}%)`;
      case 'candidate_approved':
        return `${activity?.candidate} approved for ${activity?.position} position`;
      case 'interview_scheduled':
        return `Interview scheduled with ${activity?.candidate} for ${activity?.position}`;
      case 'template_created':
        return `New interview template created for ${activity?.position}`;
      default:
        return 'Unknown activity';
    }
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

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      {/* Metrics Cards */}
      <div className="xl:col-span-2 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {metrics?.map((metric) => (
            <div
              key={metric?.id}
              className="rounded-3xl border border-white/30 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-6 hover:-translate-y-1 hover:shadow-[0_25px_70px_rgba(15,23,42,0.12)] dark:hover:shadow-[0_25px_70px_rgba(0,0,0,0.4)] transition-all duration-300 backdrop-blur"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${metric?.gradient} flex items-center justify-center text-white shadow-lg shadow-blue-500/20`}>
                  <Icon name={metric?.icon} size={24} color="currentColor" />
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                    {metric?.value}
                  </div>
                  <div className={`text-sm font-medium ${
                    metric?.changeType === 'positive' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'
                  }`}>
                    {metric?.change}
                  </div>
                </div>
              </div>
              <h3 className="font-medium text-gray-500 dark:text-slate-400">{metric?.title}</h3>
            </div>
          ))}
        </div>

        <div className="rounded-3xl border border-white/30 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-6 backdrop-blur">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Performance Overview</h3>
            <Button
              variant="outline"
              size="sm"
              iconName="Download"
              iconPosition="left"
              onClick={onExportReport}
              className="rounded-full border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400"
            >
              Export Report
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 rounded-2xl border border-white/30 dark:border-slate-700/50 bg-white/70 dark:bg-slate-900/60">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">156</div>
              <div className="text-sm text-gray-500 dark:text-slate-400">Total Interviews</div>
            </div>
            <div className="text-center p-4 rounded-2xl border border-white/30 dark:border-slate-700/50 bg-white/70 dark:bg-slate-900/60">
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">89%</div>
              <div className="text-sm text-gray-500 dark:text-slate-400">Success Rate</div>
            </div>
            <div className="text-center p-4 rounded-2xl border border-white/30 dark:border-slate-700/50 bg-white/70 dark:bg-slate-900/60">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">42</div>
              <div className="text-sm text-gray-500 dark:text-slate-400">Hires Made</div>
            </div>
          </div>
        </div>
      </div>
      {/* Recent Activity */}
      <div className="rounded-3xl border border-white/30 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-6 backdrop-blur">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Recent Activity</h3>
          <Button
            variant="ghost"
            size="sm"
            iconName="MoreHorizontal"
            className="rounded-full text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
          />
        </div>
        
        <div className="space-y-4">
          {recentActivity?.map((activity) => (
            <div
              key={activity?.id}
              className="flex items-start space-x-3 p-3 rounded-2xl border border-white/30 dark:border-slate-700/50 hover:bg-white/60 dark:hover:bg-slate-800/70 transition-colors duration-200"
            >
              <div
                className={`w-8 h-8 rounded-xl bg-white/80 dark:bg-slate-900/70 flex items-center justify-center ${getActivityColor(
                  activity?.type
                )}`}
              >
                <Icon name={getActivityIcon(activity?.type)} size={16} className="text-current" />
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 dark:text-slate-100">
                  {getActivityMessage(activity)}
                </p>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                  {getTimeAgo(activity?.timestamp)}
                </p>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-4 pt-4 border-t border-white/30 dark:border-slate-700/60">
          <Button
            variant="ghost"
            size="sm"
            fullWidth
            className="rounded-full text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
          >
            View All Activity
          </Button>
        </div>
      </div>
    </div>
  );
};

export default HiringMetrics;