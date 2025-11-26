import React, { useState, useEffect } from 'react';
import Icon from '../AppIcon';
import BrandMark from '../BrandMark';
import Button from './Button';

const UserContextNavigation = ({ 
  userType = 'candidate', 
  isCollapsed = false, 
  onToggleCollapse,
  className = '' 
}) => {
  const [activeItem, setActiveItem] = useState('/candidate-dashboard');

  useEffect(() => {
    const currentPath = window.location?.pathname;
    setActiveItem(currentPath);
  }, []);

  const candidateNavItems = [
    { 
      label: 'Dashboard', 
      path: '/candidate-dashboard', 
      icon: 'LayoutDashboard',
      description: 'Overview and progress tracking'
    },
    { 
      label: 'Practice Interview', 
      path: '/practice-interview-setup', 
      icon: 'Play',
      description: 'Set up practice sessions'
    },
    { 
      label: 'Live Session', 
      path: '/live-interview-session', 
      icon: 'Video',
      description: 'Join live interviews'
    },
  ];

  const companyNavItems = [
    { 
      label: 'Dashboard', 
      path: '/company-dashboard', 
      icon: 'LayoutDashboard',
      description: 'Company overview and analytics'
    },
    { 
      label: 'Interview Setup', 
      path: '/practice-interview-setup', 
      icon: 'Settings',
      description: 'Configure interview parameters'
    },
    { 
      label: 'Live Session', 
      path: '/live-interview-session', 
      icon: 'Video',
      description: 'Conduct live interviews'
    },
  ];

  const navigationItems = userType === 'candidate' ? candidateNavItems : companyNavItems;

  const handleNavigation = (path) => {
    setActiveItem(path);
    window.location.href = path;
  };

  return (
    <aside
      className={`hidden lg:flex lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 transition-all duration-300 ${
        isCollapsed ? 'lg:w-20' : 'lg:w-72'
      } ${className}`}
    >
      <div className="relative w-full h-full">
        <div className="absolute inset-0 opacity-70 bg-[radial-gradient(circle_at_0%_0%,rgba(59,130,246,0.15),transparent_45%),radial-gradient(circle_at_100%_0%,rgba(147,51,234,0.15),transparent_40%)]" />
        <div className="relative z-10 flex flex-col h-full border-r border-white/20 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/20 dark:border-slate-800">
          {!isCollapsed && (
            <BrandMark
              className="items-center"
              iconWrapperClassName="w-9 h-9"
              textClassName="text-lg"
              showTagline={false}
            />
          )}
          
          {onToggleCollapse && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleCollapse}
              className={`rounded-2xl border border-white/40 dark:border-slate-700/50 ${isCollapsed ? 'mx-auto' : ''}`}
            >
              <Icon name={isCollapsed ? "ChevronRight" : "ChevronLeft"} size={20} />
            </Button>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-4 space-y-2">
          {navigationItems?.map((item) => {
            const isActive = activeItem === item?.path;
            
            return (
              <button
                key={item?.path}
                onClick={() => handleNavigation(item?.path)}
                className={`w-full flex items-center space-x-3 px-3 py-3 rounded-2xl transition-all duration-200 group ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/30'
                    : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 hover:bg-white/70 dark:hover:bg-slate-800/70'
                }`}
                title={isCollapsed ? item?.label : ''}
              >
                <Icon 
                  name={item?.icon} 
                  size={20} 
                  className={`flex-shrink-0 ${isActive ? 'text-white' : 'text-gray-400 dark:text-slate-500'}`}
                />
                {!isCollapsed && (
                  <div className="flex-1 text-left">
                    <div className="font-semibold">{item?.label}</div>
                    <div className={`text-xs ${
                      isActive ? 'text-white/80' : 'text-gray-400 dark:text-slate-500'
                    }`}>
                      {item?.description}
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* User Context Indicator */}
        <div className="p-4 border-t border-white/20 dark:border-slate-800">
          <div
            className={`flex items-center space-x-3 px-4 py-3 rounded-2xl bg-white/70 dark:bg-slate-800/70 border border-white/40 dark:border-slate-700/50 shadow-inner ${
              isCollapsed ? 'justify-center' : ''
            }`}
          >
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow ${
                userType === 'candidate'
                  ? 'bg-gradient-to-br from-emerald-500 to-teal-500 text-white'
                  : 'bg-gradient-to-br from-purple-600 to-blue-600 text-white'
              }`}
            >
              <Icon
                name={userType === 'candidate' ? 'User' : 'Building'}
                size={18}
                color="currentColor"
              />
            </div>
            
            {!isCollapsed && (
              <div className="flex-1">
                <div className="font-semibold text-gray-900 dark:text-slate-100 capitalize">
                  {userType} Mode
                </div>
                <div className="text-xs text-gray-500 dark:text-slate-400">
                  {userType === 'candidate' ? 'Job Seeker' : 'Hiring Manager'}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    </aside>
  );
};

export default UserContextNavigation;