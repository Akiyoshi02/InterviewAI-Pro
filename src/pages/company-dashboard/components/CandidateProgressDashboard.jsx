import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import apiClient from '../../../services/apiClient.js';

const CandidateProgressDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30d');
  const [selectedJob, setSelectedJob] = useState('all');

  useEffect(() => {
    loadDashboardData();
  }, [timeRange, selectedJob]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load applications and analytics
      const [applicationsResult, metricsResult, jobsResult] = await Promise.all([
        apiClient.applications.getOrganizationApplications(),
        apiClient.analytics.getCompanyMetrics(),
        apiClient.jobs.getOrganizationJobs(),
      ]);

      const applications = applicationsResult.success ? applicationsResult.applications || [] : [];
      const metrics = metricsResult.success ? metricsResult.metrics || {} : {};
      const jobs = jobsResult.success ? jobsResult.jobs || [] : [];

      // Calculate statistics
      const stats = calculateStatistics(applications, jobs);
      
      setData({
        applications,
        metrics,
        jobs,
        stats,
      });
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateStatistics = (applications, jobs) => {
    const stats = {
      total: applications.length,
      byStatus: {},
      byJob: {},
      recentActivity: [],
      conversionRate: 0,
      avgTimeToHire: 0,
      topJobs: [],
    };

    // Count by status
    const statusCounts = {
      SUBMITTED: 0,
      SCREENING: 0,
      INTERVIEWING: 0,
      SHORTLISTED: 0,
      HIRED: 0,
      REJECTED: 0,
    };

    applications.forEach((app) => {
      statusCounts[app.status] = (statusCounts[app.status] || 0) + 1;
      
      // Count by job
      const jobId = app.jobId;
      if (!stats.byJob[jobId]) {
        stats.byJob[jobId] = {
          count: 0,
          title: app.job?.title || 'Unknown',
        };
      }
      stats.byJob[jobId].count++;
    });

    stats.byStatus = statusCounts;

    // Calculate conversion rate (submitted -> hired)
    if (statusCounts.SUBMITTED > 0) {
      stats.conversionRate = ((statusCounts.HIRED / stats.total) * 100).toFixed(1);
    }

    // Top jobs by application count
    stats.topJobs = Object.entries(stats.byJob)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Recent activity (last 10)
    stats.recentActivity = applications
      .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
      .slice(0, 10);

    return stats;
  };

  const StatCard = ({ icon, label, value, trend, color = 'purple' }) => (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className={`p-6 rounded-xl bg-gradient-to-br from-${color}-50 to-${color}-100 dark:from-${color}-900/20 dark:to-${color}-900/10 border border-${color}-200 dark:border-${color}-800`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-3 rounded-lg bg-${color}-600 dark:bg-${color}-600/80`}>
          <Icon name={icon} className="w-6 h-6 text-white" />
        </div>
        {trend && (
          <div className={`px-2 py-1 rounded-full text-xs font-medium ${
            trend > 0
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
          }`}>
            {trend > 0 ? '+' : ''}{trend}%
          </div>
        )}
      </div>
      <p className="text-sm text-gray-600 dark:text-slate-400 mb-1">{label}</p>
      <p className={`text-3xl font-bold text-${color}-900 dark:text-${color}-100`}>{value}</p>
    </motion.div>
  );

  const StatusPieChart = ({ data }) => {
    const total = Object.values(data).reduce((sum, val) => sum + val, 0);
    if (total === 0) return null;

    const colors = {
      SUBMITTED: '#3B82F6',
      SCREENING: '#EAB308',
      INTERVIEWING: '#A855F7',
      SHORTLISTED: '#10B981',
      HIRED: '#059669',
      REJECTED: '#6B7280',
    };

    let currentAngle = 0;

    return (
      <div className="flex items-center justify-center gap-8">
        <svg width="200" height="200" viewBox="0 0 200 200">
          {Object.entries(data).map(([status, count], index) => {
            const percentage = (count / total) * 100;
            const angle = (percentage / 100) * 360;
            const largeArcFlag = angle > 180 ? 1 : 0;
            
            const startX = 100 + 80 * Math.cos((currentAngle - 90) * Math.PI / 180);
            const startY = 100 + 80 * Math.sin((currentAngle - 90) * Math.PI / 180);
            const endX = 100 + 80 * Math.cos((currentAngle + angle - 90) * Math.PI / 180);
            const endY = 100 + 80 * Math.sin((currentAngle + angle - 90) * Math.PI / 180);
            
            const path = count > 0 ? `
              M 100 100
              L ${startX} ${startY}
              A 80 80 0 ${largeArcFlag} 1 ${endX} ${endY}
              Z
            ` : '';

            currentAngle += angle;

            return count > 0 ? (
              <path
                key={status}
                d={path}
                fill={colors[status]}
                opacity="0.9"
              />
            ) : null;
          })}
          <circle cx="100" cy="100" r="50" fill="white" className="dark:fill-slate-900" />
          <text x="100" y="100" textAnchor="middle" dy=".3em" fontSize="24" fontWeight="bold" className="fill-gray-900 dark:fill-slate-100">
            {total}
          </text>
          <text x="100" y="120" textAnchor="middle" fontSize="12" className="fill-gray-600 dark:fill-slate-400">
            Total
          </text>
        </svg>

        <div className="space-y-2">
          {Object.entries(data).map(([status, count]) => (
            count > 0 && (
              <div key={status} className="flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: colors[status] }}
                />
                <div className="flex-1">
                  <p className="text-sm text-gray-700 dark:text-slate-300">
                    {status}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-slate-500">
                    {count} ({((count / total) * 100).toFixed(0)}%)
                  </p>
                </div>
              </div>
            )
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-6 shadow-lg">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-6 shadow-lg">
        <div className="text-center py-12">
          <Icon name="AlertCircle" className="w-12 h-12 text-red-600 mx-auto mb-3" />
          <p className="text-gray-900 dark:text-slate-100">Failed to load dashboard data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Filters */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
            Candidate Progress Analytics
          </h2>
          <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
            Track candidate journey and hiring metrics
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
          </select>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadDashboardData}
          >
            <Icon name="RefreshCw" className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon="Users"
          label="Total Candidates"
          value={data.stats.total}
          color="blue"
        />
        <StatCard
          icon="TrendingUp"
          label="Conversion Rate"
          value={`${data.stats.conversionRate}%`}
          color="green"
        />
        <StatCard
          icon="Clock"
          label="In Pipeline"
          value={data.stats.byStatus.SUBMITTED + data.stats.byStatus.SCREENING + data.stats.byStatus.INTERVIEWING}
          color="purple"
        />
        <StatCard
          icon="CheckCircle"
          label="Hired"
          value={data.stats.byStatus.HIRED}
          color="emerald"
        />
      </div>

      {/* Application Status Distribution */}
      <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-6">
          Application Status Distribution
        </h3>
        <StatusPieChart data={data.stats.byStatus} />
      </div>

      {/* Pipeline Funnel */}
      <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-6">
          Hiring Funnel
        </h3>
        <div className="space-y-3">
          {[
            { status: 'SUBMITTED', label: 'Submitted', icon: 'Send', color: 'blue' },
            { status: 'SCREENING', label: 'Screening', icon: 'Eye', color: 'yellow' },
            { status: 'INTERVIEWING', label: 'Interviewing', icon: 'Video', color: 'purple' },
            { status: 'SHORTLISTED', label: 'Shortlisted', icon: 'Star', color: 'green' },
            { status: 'HIRED', label: 'Hired', icon: 'CheckCircle', color: 'emerald' },
          ].map((stage, index) => {
            const count = data.stats.byStatus[stage.status] || 0;
            const percentage = data.stats.total > 0 ? (count / data.stats.total) * 100 : 0;
            
            return (
              <div key={stage.status} className="relative">
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg bg-${stage.color}-100 dark:bg-${stage.color}-900/30`}>
                    <Icon name={stage.icon} className={`w-5 h-5 text-${stage.color}-600 dark:text-${stage.color}-400`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-slate-100">
                        {stage.label}
                      </span>
                      <span className="text-sm font-bold text-gray-900 dark:text-slate-100">
                        {count} ({percentage.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                        className={`h-full bg-gradient-to-r from-${stage.color}-400 to-${stage.color}-600`}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top Jobs */}
      <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-6">
          Top Jobs by Applications
        </h3>
        {data.stats.topJobs.length > 0 ? (
          <div className="space-y-3">
            {data.stats.topJobs.map((job, index) => (
              <div
                key={job.id}
                className="flex items-center gap-4 p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 font-bold">
                  #{index + 1}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                    {job.title}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-slate-400">
                    {job.count} application{job.count !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {job.count}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-600 dark:text-slate-400">
            No application data available
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-6">
          Recent Activity
        </h3>
        {data.stats.recentActivity.length > 0 ? (
          <div className="space-y-3">
            {data.stats.recentActivity.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-900/50 transition-colors"
              >
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 shrink-0">
                  <Icon name="User" className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                    {activity.candidate?.fullName || activity.candidate?.email || 'Unknown'}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-slate-400 truncate">
                    Applied to {activity.job?.title || 'Unknown position'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                    activity.status === 'HIRED'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                      : activity.status === 'REJECTED'
                      ? 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                  }`}>
                    {activity.status}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
                    {new Date(activity.submittedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-600 dark:text-slate-400">
            No recent activity
          </div>
        )}
      </div>

      {/* Export Options */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => alert('Export as PDF feature coming soon!')}
        >
          <Icon name="FileText" className="w-4 h-4 mr-2" />
          Export as PDF
        </Button>
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => alert('Export as CSV feature coming soon!')}
        >
          <Icon name="Download" className="w-4 h-4 mr-2" />
          Export as CSV
        </Button>
      </div>
    </div>
  );
};

export default CandidateProgressDashboard;

