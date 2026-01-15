import React from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const HiringMetrics = ({ metrics: propsMetrics, interviews = [], onExportReport }) => {
  // Calculate completion rate from real data if available
  const completedInterviews = interviews.filter(i => i?.status === 'COMPLETED').length;
  const calculatedCompletionRate = interviews.length > 0 
    ? Math.round((completedInterviews / interviews.length) * 100) 
    : null;

  const metricsData = [
    {
      id: 'time-to-hire',
      title: 'Average Time to Hire',
      value: propsMetrics?.averageTimeToHire || '—',
      change: propsMetrics?.averageTimeToHireChange || '',
      changeType: 'neutral',
      icon: 'Clock',
      gradient: 'from-blue-600 to-purple-600'
    },
    {
      id: 'avg-score',
      title: 'Average Score',
      value: propsMetrics?.averageScore ? `${Math.round(propsMetrics.averageScore)}%` : '—',
      change: propsMetrics?.averageScoreChange || '',
      changeType: propsMetrics?.averageScoreChange?.startsWith('+') ? 'positive' : 'neutral',
      icon: 'Star',
      gradient: 'from-emerald-500 to-teal-500'
    },
    {
      id: 'completion',
      title: 'Interview Completion Rate',
      value: propsMetrics?.completionRate || (calculatedCompletionRate !== null ? `${calculatedCompletionRate}%` : '—'),
      change: propsMetrics?.completionRateChange || '',
      changeType: 'neutral',
      icon: 'CheckCircle',
      gradient: 'from-purple-500 to-pink-500'
    },
    {
      id: 'in-progress',
      title: 'In Progress',
      value: propsMetrics?.inProgressInterviews ?? interviews.filter(i => i?.status === 'IN_PROGRESS').length,
      change: '',
      changeType: 'neutral',
      icon: 'TrendingUp',
      gradient: 'from-cyan-500 to-blue-500'
    }
  ];

  // Use real data - no fake fallback values
  const totalInterviews = interviews.length;
  const hiresMade = interviews.filter(i => i?.pipelineStatus === 'HIRED').length;
  const successRate = totalInterviews > 0 ? Math.round((hiresMade / totalInterviews) * 100) : 0;

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
                {metric?.change && (
                  <div className={`text-xs font-medium ${
                    metric?.changeType === 'positive' ? 'text-emerald-600 dark:text-emerald-400' 
                    : metric?.changeType === 'negative' ? 'text-rose-500 dark:text-rose-400'
                    : 'text-gray-500 dark:text-slate-400'
                  }`}>
                    {metric?.change}
                  </div>
                )}
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
