import React from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const QuickActions = ({ onScheduleInterview, onCreateTemplate, onGenerateReport }) => {
  const quickActions = [
    {
      id: 'schedule-interview',
      title: 'Schedule Interview',
      description: 'Set up a new candidate interview session',
      icon: 'Calendar',
      color: 'from-blue-600 to-purple-600',
      onClick: onScheduleInterview || (() => window.location.href = '/practice-interview-setup')
    },
    {
      id: 'create-template',
      title: 'Create Job Template',
      description: 'Design custom interview questions and criteria',
      icon: 'FileText',
      color: 'from-cyan-500 to-blue-500',
      onClick: onCreateTemplate || (() => window.location.href = '/practice-interview-setup')
    },
    {
      id: 'generate-report',
      title: 'Generate Reports',
      description: 'Export hiring analytics and candidate data',
      icon: 'BarChart3',
      color: 'from-emerald-500 to-teal-500',
      onClick: onGenerateReport || (() => {})
    }
  ];

  const shortcuts = [
    {
      id: 'live-session',
      title: 'Start Live Session',
      icon: 'Video',
      path: '/live-interview-session'
    },
    {
      id: 'candidate-search',
      title: 'Search Candidates',
      icon: 'Search',
      path: '/company-dashboard'
    },
    {
      id: 'settings',
      title: 'Interview Settings',
      icon: 'Settings',
      path: '/practice-interview-setup'
    },
    {
      id: 'analytics',
      title: 'View Analytics',
      icon: 'TrendingUp',
      path: '/company-dashboard'
    }
  ];

  return (
    <div className="space-y-4 sm:space-y-5 md:space-y-6">
      {/* Primary Actions */}
      <div className="rounded-3xl border border-white/30 bg-white/80 p-4 sm:p-5 md:p-6 backdrop-blur">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Quick Actions</h3>
        
        <div className="grid grid-cols-1 gap-3 sm:gap-4">
          {quickActions?.map((action) => (
            <div
              key={action?.id}
              className="group cursor-pointer"
              onClick={action?.onClick}
            >
              <div className="rounded-2xl border border-white/30 bg-white/70 hover:-translate-y-1 hover:shadow-[0_20px_60px_rgba(15,23,42,0.12)] p-4 sm:p-5 md:p-6 transition-all duration-300">
                <div className="flex flex-col items-center text-center space-y-3 sm:space-y-4">
                  <div className={`w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br ${action?.color} flex items-center justify-center text-white group-hover:scale-110 transition-transform duration-200 shadow-lg shadow-blue-500/20`}>
                    <Icon name={action?.icon} size={24} className="sm:w-7 sm:h-7 md:w-8 md:h-8" color="currentColor" />
                  </div>
                  
                  <div>
                    <h4 className="text-sm sm:text-base font-semibold text-gray-900 group-hover:text-blue-600 transition-colors duration-200">
                      {action?.title}
                    </h4>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1">
                      {action?.description}
                    </p>
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    iconName="ArrowRight"
                    iconPosition="right"
                    onClick={(e) => {
                      e?.stopPropagation();
                      action?.onClick();
                    }}
                    className="text-xs sm:text-sm rounded-full border border-gray-200 text-gray-700 hover:border-blue-300 hover:text-blue-600"
                  >
                    Start
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Quick Shortcuts */}
      <div className="rounded-3xl border border-white/30 bg-white/80 p-4 sm:p-5 md:p-6 backdrop-blur">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Quick Shortcuts</h3>
        
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          {shortcuts?.map((shortcut) => (
            <button
              key={shortcut?.id}
              onClick={() => window.location.href = shortcut?.path}
              className="flex flex-col items-center space-y-2 p-3 sm:p-4 rounded-2xl border border-white/30 hover:bg-white/60 transition-all duration-200 group"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-white/70 rounded-xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all duration-200">
                <Icon name={shortcut?.icon} size={18} className="sm:w-5 sm:h-5" />
              </div>
              <span className="text-xs sm:text-sm font-medium text-gray-700 group-hover:text-blue-600 transition-colors duration-200 text-center">
                {shortcut?.title}
              </span>
            </button>
          ))}
        </div>
      </div>
      {/* Help & Support */}
      <div className="rounded-3xl border border-white/40 bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-cyan-500/10 p-4 sm:p-5 md:p-6 backdrop-blur">
        <div className="flex flex-col sm:flex-row items-start space-y-3 sm:space-y-0 sm:space-x-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center flex-shrink-0 text-white shadow-lg shadow-blue-500/20">
            <Icon name="HelpCircle" size={20} className="sm:w-6 sm:h-6" color="currentColor" />
          </div>
          
          <div className="flex-1 w-full">
            <h4 className="text-sm sm:text-base font-semibold text-gray-900 mb-2">Need Help?</h4>
            <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
              Get started with our comprehensive guides and tutorials for setting up interviews and managing candidates.
            </p>
            
            <div className="flex flex-col space-y-2">
              <Button variant="outline" size="sm" iconName="Book" iconPosition="left" className="text-xs sm:text-sm w-full rounded-full border border-gray-200 text-gray-700 hover:border-blue-300 hover:text-blue-600">
                View Documentation
              </Button>
              <Button variant="ghost" size="sm" iconName="MessageCircle" iconPosition="left" className="text-xs sm:text-sm w-full rounded-full text-gray-500 hover:text-blue-600">
                Contact Support
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuickActions;
