import React from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const HiringMetrics = ({ metrics: propsMetrics, interviews = [], onExportReport }) => {
  const metricsData = [
    {
      id: 'time-to-hire',
      title: 'Average Time to Hire',
      value: propsMetrics?.averageTimeToHire || '18 days',
      change: '-3 days',
      changeType: 'positive',
      icon: 'Clock',
      gradient: 'from-blue-600 to-purple-600'
    },
    {
      id: 'satisfaction',
      title: 'Candidate Satisfaction',
      value: propsMetrics?.candidateSatisfaction || '4.8/5',
      change: '+0.2',
      changeType: 'positive',
      icon: 'Star',
      gradient: 'from-emerald-500 to-teal-500'
    },
    {
      id: 'completion',
      title: 'Interview Completion Rate',
      value: propsMetrics?.completionRate || '94%',
      change: '+2%',
      changeType: 'positive',
      icon: 'CheckCircle',
      gradient: 'from-purple-500 to-pink-500'
    },
    {
      id: 'quality',
      title: 'Hire Quality Score',
      value: propsMetrics?.hireQuality || '87%',
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
      timestamp: new Date(Date.now() - 1800000),
      score: 92
    },
    {
      id: 2,
      type: 'candidate_approved',
      candidate: 'Michael Chen',
      position: 'Backend Developer',
      timestamp: new Date(Date.now() - 3600000),
      score: 88
    },
    {
      id: 3,
      type: 'interview_scheduled',
      candidate: 'Emily Rodriguez',
      position: 'UX Designer',
      timestamp: new Date(Date.now() - 7200000),
      score: null
    },
    {
      id: 4,
      type: 'template_created',
      candidate: null,
      position: 'Data Scientist',
      timestamp: new Date(Date.now() - 10800000),
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
    // Helper to get candidate name
    const getCandidateName = (candidate) => {
      if (typeof candidate === 'string') return candidate;
      if (typeof candidate === 'object' && candidate) {
        return candidate.fullName || candidate.email || 'Candidate';
      }
      return 'Candidate';
    };

    const candidateName = getCandidateName(activity?.candidate);

    switch (activity?.type) {
      case 'interview_completed':
        return `${candidateName} completed interview for ${activity?.position} (Score: ${activity?.score}%)`;
      case 'candidate_approved':
        return `${candidateName} approved for ${activity?.position} position`;
      case 'interview_scheduled':
        return `Interview scheduled with ${candidateName} for ${activity?.position}`;
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

  const totalInterviews = interviews.length || 156;
  const hiresMade = interviews.filter(i => i?.pipelineStatus === 'HIRED').length || 42;
  const successRate = totalInterviews > 0 ? Math.round((hiresMade / totalInterviews) * 100) : 89;

  return (
    <div className="rounded-2xl border border-white/30 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-3 sm:p-4 shadow-[0_20px_60px_rgba(15,23,42,0.12)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur space-y-3 sm:space-y-4">
      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
        {metricsData?.map((metric) => (
          <div
            key={metric?.id}
            className="rounded-xl border border-white/40 dark:border-slate-700/50 bg-white/70 dark:bg-slate-800/70 p-2.5 sm:p-3 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(15,23,42,0.1)] dark:hover:shadow-[0_10px_30px_rgba(0,0,0,0.3)] transition-all duration-200"
          >
            <div className="flex items-start justify-between mb-2">
              <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br ${metric?.gradient} flex items-center justify-center text-white shadow-lg shadow-blue-500/25`}>
                <Icon name={metric?.icon} size={16} color="currentColor" />
              </div>
              <div className="text-right">
                <div className="text-base sm:text-lg font-bold text-gray-900 dark:text-slate-100">
                  {metric?.value}
                </div>
                <div className={`text-xs font-medium ${
                  metric?.changeType === 'positive' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'
                }`}>
                  {metric?.change}
                </div>
              </div>
            </div>
            <h3 className="text-xs font-medium text-gray-500 dark:text-slate-400">{metric?.title}</h3>
          </div>
        ))}
      </div>

      {/* Performance Overview */}
      <div className="pt-3 border-t border-white/30 dark:border-slate-700/50">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-slate-100">Performance Overview</h3>
          <Button
            variant="outline"
            size="sm"
            iconName="Download"
            iconPosition="left"
            onClick={onExportReport}
            className="rounded-full border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400 text-xs"
          >
            Export Report
          </Button>
        </div>
        
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="text-center p-2.5 sm:p-3 rounded-xl border border-white/40 dark:border-slate-700/50 bg-white/60 dark:bg-slate-900/60">
            <div className="text-lg sm:text-xl font-bold text-blue-600 dark:text-blue-400">{totalInterviews}</div>
            <div className="text-xs text-gray-500 dark:text-slate-400">Total Interviews</div>
          </div>
          <div className="text-center p-2.5 sm:p-3 rounded-xl border border-white/40 dark:border-slate-700/50 bg-white/60 dark:bg-slate-900/60">
            <div className="text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400">{successRate}%</div>
            <div className="text-xs text-gray-500 dark:text-slate-400">Success Rate</div>
          </div>
          <div className="text-center p-2.5 sm:p-3 rounded-xl border border-white/40 dark:border-slate-700/50 bg-white/60 dark:bg-slate-900/60">
            <div className="text-lg sm:text-xl font-bold text-purple-600 dark:text-purple-400">{hiresMade}</div>
            <div className="text-xs text-gray-500 dark:text-slate-400">Hires Made</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HiringMetrics;
