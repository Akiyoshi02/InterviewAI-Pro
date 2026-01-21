import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Icon from '../AppIcon';
import BrandMark from '../BrandMark';
import Button from './Button';
import RoleBadge from './RoleBadge';
import NavigationMenu from './NavigationMenu';
import { filterNavByRole } from '../../utils/rolePermissions';

const Header = ({ userType = null, isAuthenticated = false, onLogout, organizationRole = null }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const currentPath = useMemo(() => location.pathname || '', [location.pathname]);

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
      className="items-center"
      iconWrapperClassName="w-8 h-8 xs:w-9 xs:h-9 sm:w-10 sm:h-10"
      textClassName="text-sm xs:text-base sm:text-lg md:text-xl"
      taglineClassName="text-[9px] xs:text-[10px] text-gray-500 hidden xs:block"
      showTagline={false}
    />
  );

  const candidateNavItems = [
    { label: 'Dashboard', path: '/candidate-dashboard', icon: 'LayoutDashboard' },
    { label: 'Jobs', path: '/jobs', icon: 'Briefcase' },
    { label: 'Applications', path: '/my-applications', icon: 'FileText', fullLabel: 'My Applications' },
    { label: 'Practice', path: '/practice-interview-setup', icon: 'Play', fullLabel: 'Practice Interview' },
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
        { label: 'Applications', path: '/company-applications', icon: 'FileText', requiredPermission: 'ACCESS_APPLICATIONS_PAGE' },
        { label: 'Candidates', path: '/company-candidates', icon: 'Users', fullLabel: 'Candidates', requiredPermission: 'ACCESS_CANDIDATES_PAGE' },
      ]
    },
    { 
      key: 'interviews',
      label: 'Interviews', 
      icon: 'Calendar',
      fullLabel: 'Interviews',
      items: [
        { label: 'Invitations', path: '/company-invitations', icon: 'Send', fullLabel: 'Invitations', requiredPermission: 'ACCESS_INVITATIONS_PAGE' },
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
  ];

  const adminNavItems = []; // Admin dashboard has its own tab navigation, no header nav needed

  const getNavigationItems = () => {
    if (!isAuthenticated) return [];
    if (userType === 'candidate') return candidateNavItems;
    if (userType === 'admin') return adminNavItems; // Empty array - admin uses tab navigation
    
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
    
    // Handle hash routes specially
    if (path.includes('#')) {
      const [basePath, hash] = path.split('#');
      // If we're already on the base path, just update the hash
      if (location.pathname === basePath) {
        window.location.hash = hash;
        // Trigger hashchange event manually for consistency
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      } else {
        // Navigate to base path first, then set hash
        navigate(basePath);
        setTimeout(() => {
          window.location.hash = hash;
          // Trigger hashchange event manually
          window.dispatchEvent(new HashChangeEvent('hashchange'));
        }, 50);
      }
    } else {
      navigate(path);
    }
    setIsMenuOpen(false);
  };

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    }
    setIsMenuOpen(false);
  };

  const isActivePath = (path) => currentPath?.startsWith(path);

  const navButtonClass = (path) =>
    `flex items-center gap-1.5 xl:gap-2 text-xs xl:text-sm font-medium transition-all duration-200 px-2.5 xl:px-3 py-2 rounded-full min-h-touch ${
      isActivePath(path)
        ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/30'
        : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 hover:bg-white/60 dark:hover:bg-slate-800/60'
    }`;

  return (
    <>
      <header 
        className={`fixed top-0 left-0 right-0 z-50 w-full transition-all duration-300 ${
          isScrolled 
            ? 'border-b border-gray-200/50 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl shadow-sm' 
            : 'border-b border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl'
        }`}
      >
        <div className={`flex ${userType === 'admin' ? 'justify-between' : 'lg:grid lg:grid-cols-[1fr_auto_1fr]'} items-center h-14 xs:h-16 px-3 xs:px-4 sm:px-6 lg:px-8 xl:px-10 max-w-[1920px] mx-auto ${
          isAuthenticated && userType !== 'admin' ? 'justify-end lg:justify-between' : 'justify-between'
        }`}>
          {/* Only show logo in header when NOT authenticated (no sidebar visible) */}
          {!isAuthenticated ? (
            <Logo />
          ) : (
            <>
              {/* Show logo when authenticated - always visible for admin, mobile for others */}
              <div className={userType === 'admin' ? 'mr-auto' : 'lg:hidden mr-auto'}>
                <Logo />
              </div>
              {/* Empty spacer on desktop to maintain layout (only for non-admin) */}
              {userType !== 'admin' && <div className="hidden lg:block" />}
            </>
          )}
          
          {/* Desktop Navigation */}
          {getNavigationItems() && getNavigationItems().length > 0 && (
            <div className="hidden lg:block lg:justify-self-center">
              <NavigationMenu
                items={getNavigationItems()}
                variant="dropdown"
                onItemClick={handleNavClick}
                activeItem={currentPath}
              />
            </div>
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
                  onClick={() => handleNavClick('/privacy')}
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
