import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { hasPermission } from '../../../utils/rolePermissions';

const QuickActions = ({ onScheduleInterview, onCreateTemplate, onGenerateReport, organizationRole }) => {
  const navigate = useNavigate();
  const isReviewerOnly = organizationRole === 'REVIEWER';
  const quickActions = useMemo(() => {
    if (isReviewerOnly) {
      return [
        {
          id: 'open-assigned-reviews',
          title: 'Open Review Queue',
          description: 'Continue assigned reviews and submit structured feedback.',
          icon: 'ClipboardCheck',
          color: 'from-blue-600 to-purple-600',
          onClick: () => navigate('/company-reviews'),
        },
        {
          id: 'review-interview-evidence',
          title: 'Review Interview Evidence',
          description: 'Inspect recordings, transcripts, and AI analysis for assigned interviews.',
          icon: 'PlayCircle',
          color: 'from-cyan-500 to-blue-500',
          onClick: () => navigate('/company-interviews'),
        },
        {
          id: 'privacy-data',
          title: 'Privacy & Data',
          description: 'Manage reviewer privacy, consent, export, and deletion settings.',
          icon: 'Shield',
          color: 'from-emerald-500 to-teal-500',
          onClick: () => navigate('/privacy-settings'),
        },
      ];
    }

    const actions = [
      {
        id: 'advance-to-interviewing',
        title: 'Review Applications',
        description: 'Move qualified candidates into the interviewing stage and launch scheduling.',
        icon: 'FileText',
        color: 'from-blue-600 to-purple-600',
        onClick: () => navigate('/company-applications'),
        requiredPermission: 'UPDATE_APPLICATION_STATUS'
      },
      {
        id: 'create-template',
        title: 'Create Job Template',
        description: 'Design custom interview questions and criteria',
        icon: 'FileText',
        color: 'from-cyan-500 to-blue-500',
        onClick: onCreateTemplate || (() => navigate('/company-jobs')),
        requiredPermission: 'CREATE_TEMPLATES'
      },
      {
        id: 'generate-report',
        title: 'Generate Reports',
        description: 'Export hiring analytics and candidate data',
        icon: 'BarChart3',
        color: 'from-emerald-500 to-teal-500',
        onClick: onGenerateReport || (() => navigate('/company-analytics')),
        requiredPermission: 'EXPORT_REPORTS'
      }
    ];

    // Filter actions based on role permissions
    return actions.filter(action => 
      !action.requiredPermission || hasPermission(organizationRole, action.requiredPermission)
    );
  }, [isReviewerOnly, navigate, onScheduleInterview, onCreateTemplate, onGenerateReport, organizationRole]);

  const shortcuts = useMemo(() => {
    const items = [
      {
        id: 'live-session',
        title: isReviewerOnly ? 'Assigned Reviews' : 'View Interviews',
        icon: 'Calendar',
        path: isReviewerOnly ? '/company-reviews' : '/company-interviews',
        requiredPermission: 'ACCESS_INTERVIEWS_PAGE'
      },
      {
        id: 'candidate-search',
        title: isReviewerOnly ? 'Assigned Candidates' : 'Search Candidates',
        icon: 'Search',
        path: '/company-candidates'
      },
      {
        id: 'settings',
        title: 'Interview Settings',
        icon: 'Settings',
        path: '/company-settings',
        requiredPermission: 'CREATE_TEMPLATES'
      },
      {
        id: 'analytics',
        title: 'View Analytics',
        icon: 'TrendingUp',
        path: '/company-analytics',
        requiredPermission: 'ACCESS_ANALYTICS_PAGE'
      }
    ];

    // Filter shortcuts based on role permissions
    return items.filter(item => 
      !item.requiredPermission || hasPermission(organizationRole, item.requiredPermission)
    );
  }, [isReviewerOnly, organizationRole]);

  const primaryTitle = isReviewerOnly ? 'Reviewer Actions' : 'Quick Actions';
  const primaryDescription = isReviewerOnly
    ? 'Open the reviewer tools you use most often without leaving the dashboard.'
    : 'Manage your hiring workflow';
  const shortcutsTitle = isReviewerOnly ? 'Review Shortcuts' : 'Quick Shortcuts';

  return (
    <div className="space-y-2">
      {/* Primary Actions */}
      <div className="rounded-2xl border border-white/30 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-3 sm:p-4 shadow-[0_20px_60px_rgba(15,23,42,0.12)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur">
        <div className="flex items-center space-x-2.5 mb-3 sm:mb-4">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Icon name="Zap" size={16} color="white" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100">{primaryTitle}</h2>
            <p className="text-xs text-gray-500 dark:text-slate-400">{primaryDescription}</p>
          </div>
        </div>
        
        <div className="space-y-2">
          {quickActions.length > 0 ? (
            quickActions?.map((action) => (
              <button
                key={action?.id}
                type="button"
                className="group w-full text-left"
                onClick={action?.onClick}
              >
                <div className="rounded-xl border border-white/40 dark:border-slate-700/50 bg-white/70 dark:bg-slate-800/70 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(15,23,42,0.1)] dark:hover:shadow-[0_10px_30px_rgba(0,0,0,0.3)] p-3 transition-all duration-200">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${action?.color} flex items-center justify-center text-white group-hover:scale-105 transition-transform duration-200 shadow-lg shadow-blue-500/25`}>
                      <Icon name={action?.icon} size={20} color="currentColor" />
                    </div>
                    
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200">
                        {action?.title}
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-slate-400">
                        {action?.description}
                      </p>
                    </div>
                    
                    <Icon 
                      name="ChevronRight" 
                      size={16} 
                      className="text-gray-400 dark:text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200" 
                    />
                  </div>
                </div>
              </button>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-white/40 dark:border-slate-700/50 bg-white/60 dark:bg-slate-800/60 p-3 text-sm text-gray-600 dark:text-slate-300">
              Scheduling, templates, and exports stay with recruiters. Use the review queue, interviews, and candidate shortcuts below to inspect submissions and leave feedback.
            </div>
          )}
        </div>
      </div>

      {/* Quick Shortcuts */}
      <div className="rounded-2xl border border-white/30 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-3 shadow-[0_20px_60px_rgba(15,23,42,0.12)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-2">{shortcutsTitle}</h3>
        
        <div className="grid grid-cols-2 gap-2">
          {shortcuts?.map((shortcut) => (
            <button
              key={shortcut?.id}
              onClick={() => shortcut?.path && navigate(shortcut.path)}
              className="flex flex-col items-center space-y-1.5 p-2.5 rounded-xl border border-white/40 dark:border-slate-700/50 hover:bg-white/60 dark:hover:bg-slate-800/60 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(15,23,42,0.1)] transition-all duration-200 group"
            >
              <div className="w-8 h-8 bg-white/80 dark:bg-slate-900/70 rounded-lg flex items-center justify-center group-hover:bg-gradient-to-br group-hover:from-blue-600 group-hover:to-purple-600 group-hover:text-white transition-all duration-200">
                <Icon name={shortcut?.icon} size={16} />
              </div>
              <span className="text-xs font-medium text-gray-700 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200 text-center">
                {shortcut?.title}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Help & Support */}
      <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 p-3 backdrop-blur">
        <div className="flex items-start space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center flex-shrink-0 text-white shadow-lg shadow-blue-500/25">
            <Icon name="HelpCircle" size={16} color="currentColor" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-gray-900 dark:text-slate-100 text-sm">Need Help?</h4>
            <p className="text-xs text-gray-600 dark:text-slate-400 mb-2">
              Guides and tutorials for interviews and candidates.
            </p>
            
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                size="sm" 
                iconName="Book" 
                iconPosition="left" 
                onClick={() => navigate('/company-interviews')}
                className="rounded-full border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400 text-xs"
              >
                Interviews
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                iconName="MessageCircle" 
                iconPosition="left" 
                onClick={() => window.open('mailto:support@interviewai.pro', '_blank')}
                className="rounded-full text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 text-xs"
              >
                Support
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuickActions;
