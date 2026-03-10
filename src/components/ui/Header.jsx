import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Icon from '../AppIcon';
import BrandMark from '../BrandMark';
import Button from './Button';
import RoleBadge from './RoleBadge';
import NavigationMenu from './NavigationMenu';
import NotificationCenter from './NotificationCenter';
import { ADMIN_NAV_ITEMS } from '../../config/adminNavigation.js';
import { filterNavByRole } from '../../utils/rolePermissions';

const Header = ({ userType = null, isAuthenticated = false, onLogout, organizationRole = null }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const currentPath = useMemo(
    () => `${location.pathname || ''}${location.hash || ''}`,
    [location.pathname, location.hash]
  );

  // Handle scroll effect for header
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close menu on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') setIsMenuOpen(false);
    };
    if (isMenuOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isMenuOpen]);

  const buildAuthLink = (target) => {
    const pathname = location.pathname || '';
    const search = location.search || '';
    const current = `${pathname}${search}`;

    const shouldRedirect =
      pathname &&
      pathname !== '/' &&
      pathname !== '/login' &&
      pathname !== '/register' &&
      current.startsWith('/') &&
      !current.startsWith('//');

    return shouldRedirect ? `${target}?redirect=${encodeURIComponent(current)}` : target;
  };

  const Logo = () => (
    <BrandMark
      className="items-center justify-center"
      iconWrapperClassName="w-8 h-8 xs:w-9 xs:h-9 sm:w-10 sm:h-10"
      textClassName="text-sm xs:text-base sm:text-lg md:text-xl"
      taglineClassName="text-[9px] xs:text-[10px] text-gray-500 hidden xs:block"
      showTagline={false}
    />
  );

  const candidateNavItems = [
    { key: 'dashboard', label: 'Dashboard', path: '/candidate-dashboard', icon: 'LayoutDashboard' },
    { key: 'jobs', label: 'Jobs', path: '/jobs', icon: 'Briefcase' },
    { key: 'companies', label: 'Companies', path: '/companies', icon: 'Building2', fullLabel: 'Companies Directory' },
    { key: 'applications', label: 'Applications', path: '/my-applications', icon: 'FileText', fullLabel: 'My Applications' },
    { key: 'practice', label: 'Practice', path: '/practice-interview-setup', icon: 'Play', fullLabel: 'Practice Interview' },
    { key: 'analytics', label: 'Analytics', path: '/candidate-analytics', icon: 'BarChart2', fullLabel: 'My Analytics' },
    { key: 'achievements', label: 'Achievements', path: '/gamification', icon: 'Trophy' },
    { key: 'prep', label: 'Prep Library', path: '/interview-prep-library', icon: 'BookOpen', fullLabel: 'Interview Prep Library' },
    { key: 'referral', label: 'Referral', path: '/referral-program', icon: 'Gift', fullLabel: 'Referral Program' },
    { key: 'privacy', label: 'Privacy', path: '/privacy-settings', icon: 'Shield', fullLabel: 'Privacy & Data' },
    { key: 'settings', label: 'Settings', path: '/candidate-settings', icon: 'Settings', fullLabel: 'Settings' },
  ];

  const companyNavItems = [
    { 
      key: 'dashboard',
      label: 'Dashboard', 
      path: '/company-dashboard', 
      icon: 'LayoutDashboard' 
    },
    { 
      key: 'hiring',
      label: 'Hiring', 
      icon: 'Briefcase',
      fullLabel: 'Hiring',
      items: [
        { label: 'Jobs', path: '/company-jobs', icon: 'Briefcase', requiredPermission: 'ACCESS_JOBS_PAGE' },
        { label: 'Templates', path: '/company-templates', icon: 'ListChecks', fullLabel: 'Structured Templates', requiredPermission: 'ACCESS_TEMPLATES_PAGE' },
        { label: 'Applications', path: '/company-applications', icon: 'FileText', requiredPermission: 'ACCESS_APPLICATIONS_PAGE' },
        { label: 'Candidates', path: '/company-candidates', icon: 'Users', fullLabel: 'Candidates', requiredPermission: 'ACCESS_CANDIDATES_PAGE' },
        { label: 'Interviews', path: '/company-interviews', icon: 'Calendar', fullLabel: 'Interviews', requiredPermission: 'ACCESS_INTERVIEWS_PAGE' },
      ]
    },
    { 
      key: 'analytics',
      label: 'Analytics', 
      path: '/company-analytics', 
      icon: 'BarChart3', 
      fullLabel: 'Analytics', 
      requiredPermission: 'ACCESS_ANALYTICS_PAGE' 
    },
    { 
      key: 'team',
      label: 'Team', 
      path: '/company-team-members', 
      icon: 'Users2', 
      fullLabel: 'Team Members', 
      requiredPermission: 'MANAGE_MEMBERS' 
    },
    { 
      key: 'settings',
      label: 'Settings', 
      icon: 'Settings', 
      fullLabel: 'Settings',
      items: [
        { label: 'General Settings', path: '/company-settings', icon: 'Settings', fullLabel: 'Company Settings' },
        { label: 'Public Profile', path: '/company-profile-editor', icon: 'Globe', fullLabel: 'Company Public Profile', requiredPermission: 'MANAGE_ORGANIZATION' },
        { label: 'Webhooks', path: '/company-webhooks', icon: 'Webhook', fullLabel: 'Webhook Integrations', requiredPermission: 'MANAGE_ORGANIZATION' },
        { label: 'Privacy & Data', path: '/privacy-settings', icon: 'Shield', fullLabel: 'Privacy & Data' },
      ],
    }, 
    { 
      key: 'billing',
      label: 'Billing', 
      path: '/company-billing', 
      icon: 'CreditCard', 
      fullLabel: 'Billing',
      requiredPermission: 'MANAGE_ORGANIZATION',
    },
  ];

  const getNavigationItems = () => {
    if (!isAuthenticated) return [];
    if (userType === 'candidate') return candidateNavItems;
    if (userType === 'admin') return ADMIN_NAV_ITEMS;
    
    // For company users, filter navigation based on organization role
    if (userType === 'company') {
      return filterNavByRole(companyNavItems, organizationRole);
    }
    
    return companyNavItems;
  };

  const handleNavClick = (path) => {
    // Guard against undefined/null paths (e.g., when clicking groups without paths)
    if (!path || typeof path !== 'string') {
      return;
    }

    navigate(path);
    setIsMenuOpen(false);
  };

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    }
    setIsMenuOpen(false);
  };

  const handleQuickPrivacyNavigation = () => {
    if (isAuthenticated) {
      handleNavClick('/privacy-settings');
      return;
    }

    handleNavClick('/privacy');
  };

  return (
    <>
      <header 
        className={`fixed top-0 left-0 right-0 z-50 w-full transition-all duration-300 ${
          isScrolled 
            ? 'border-b border-gray-200/50 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl shadow-sm' 
            : 'border-b border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl'
        }`}
      >
        <div className={`flex items-center h-14 xs:h-16 px-3 xs:px-4 sm:px-6 lg:px-8 xl:px-10 max-w-[1920px] mx-auto ${
          isAuthenticated
            ? 'justify-end lg:grid lg:grid-cols-[1fr_auto_1fr]'
            : 'justify-between'
        }`}>
          {/* Only show logo in header when NOT authenticated (no sidebar visible) */}
          {!isAuthenticated ? (
            <Logo />
          ) : (
            <>
              {/* Show logo when authenticated on mobile only (desktop uses sidebar branding) */}
              <div className="lg:hidden mr-auto">
                <Logo />
              </div>
              {/* Keep a left spacer and center brand on desktop */}
              <div className="hidden lg:block lg:justify-self-start" />
              <div className="hidden lg:flex lg:justify-self-center">
                <Logo />
              </div>
            </>
          )}

          {/* Desktop Auth Actions */}
          <div className="hidden md:flex items-center gap-2 lg:gap-3 lg:justify-self-end">
            {!isAuthenticated ? (
              <>
                <Button
                  variant="ghost"
                  onClick={() => handleNavClick(buildAuthLink('/login'))}
                  className="rounded-full border border-gray-200/60 dark:border-slate-700 text-xs lg:text-sm px-3 lg:px-4 text-gray-700 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-800/70 min-h-touch"
                >
                  Sign In
                </Button>
                <Button
                  variant="default"
                  onClick={() => handleNavClick(buildAuthLink('/register'))}
                  className="rounded-full bg-gradient-to-r from-blue-600 to-purple-600 border-none text-xs lg:text-sm px-3 lg:px-5 shadow-md shadow-blue-500/30 hover:from-blue-700 hover:to-purple-700 min-h-touch"
                >
                  Get Started
                </Button>
              </>
            ) : (
              <>
                {userType === 'company' && organizationRole && (
                  <RoleBadge role={organizationRole} className="mr-1" />
                )}
                <NotificationCenter />
                <Button
                  variant="outline"
                  iconName="LogOut"
                  iconPosition="left"
                  onClick={handleLogout}
                  className="rounded-full text-xs lg:text-sm px-3 lg:px-4 border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 min-h-touch"
                >
                  <span className="hidden sm:inline">Sign Out</span>
                  <span className="sm:hidden">Exit</span>
                </Button>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden flex items-center justify-center w-10 h-10 xs:w-11 xs:h-11 rounded-xl border border-gray-200/50 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/50 text-gray-700 dark:text-slate-300 transition-colors hover:bg-white/80 dark:hover:bg-slate-800/80"
            aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isMenuOpen}
          >
            <Icon name={isMenuOpen ? 'X' : 'Menu'} size={20} />
          </button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {isMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/20 dark:bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setIsMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile Menu Panel */}
      <div 
        className={`fixed top-14 xs:top-16 right-0 bottom-0 z-50 w-full xs:w-80 md:hidden transform transition-transform duration-300 ease-out ${
          isMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-l border-gray-200/50 dark:border-slate-800 shadow-2xl overflow-y-auto safe-area-padding">
          <div className="px-4 py-5 space-y-4">
            {/* Navigation Items */}
            <NavigationMenu
              items={getNavigationItems()}
              variant="accordion"
              onItemClick={handleNavClick}
              activeItem={currentPath}
            />
            
            {/* Auth Actions */}
            <div className="pt-4 border-t border-gray-200 dark:border-slate-700/50 space-y-3">
              {!isAuthenticated ? (
                <>
                  <Button
                    variant="ghost"
                    fullWidth
                    onClick={() => handleNavClick(buildAuthLink('/login'))}
                    className="rounded-xl border border-gray-200 dark:border-slate-700 text-base py-3.5 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 min-h-touch"
                  >
                    Sign In
                  </Button>
                  <Button
                    variant="default"
                    fullWidth
                    onClick={() => handleNavClick(buildAuthLink('/register'))}
                    className="rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 border-none text-base py-3.5 shadow-md shadow-blue-500/30 min-h-touch"
                  >
                    Get Started Free
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  fullWidth
                  iconName="LogOut"
                  iconPosition="left"
                  onClick={handleLogout}
                  className="rounded-xl border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-slate-200 text-base py-3.5 hover:bg-gray-50 dark:hover:bg-slate-800 min-h-touch"
                >
                  Sign Out
                </Button>
              )}
            </div>

            {/* Quick Links for Mobile */}
            <div className="pt-4 border-t border-gray-200 dark:border-slate-700/50">
              <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-slate-500 mb-3 px-1">Quick Links</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleNavClick('/help-center')}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <Icon name="HelpCircle" size={16} />
                  <span>Help</span>
                </button>
                <button
                  onClick={handleQuickPrivacyNavigation}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <Icon name="Shield" size={16} />
                  <span>Privacy</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Header;
