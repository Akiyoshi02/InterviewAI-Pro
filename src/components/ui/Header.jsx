import React, { useState, useMemo } from 'react';
import Icon from '../AppIcon';
import BrandMark from '../BrandMark';
import Button from './Button';

const Header = ({ userType = null, isAuthenticated = false, onLogout }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const currentPath = useMemo(() => window?.location?.pathname || '', []);

  const Logo = () => (
    <BrandMark
      className="items-center"
      iconWrapperClassName="w-9 h-9 sm:w-10 sm:h-10"
      textClassName="text-base sm:text-lg md:text-xl"
      taglineClassName="text-[10px] text-gray-500 hidden sm:block"
      showTagline={false}
    />
  );

  const candidateNavItems = [
    { label: 'Dashboard', path: '/candidate-dashboard', icon: 'LayoutDashboard' },
    { label: 'Practice Interview', path: '/practice-interview-setup', icon: 'Play' },
    { label: 'Live Session', path: '/live-interview-session', icon: 'Video' },
  ];

  const companyNavItems = [
    { label: 'Dashboard', path: '/company-dashboard', icon: 'LayoutDashboard' },
    { label: 'Interview Setup', path: '/practice-interview-setup', icon: 'Settings' },
    { label: 'Live Session', path: '/live-interview-session', icon: 'Video' },
  ];

  const getNavigationItems = () => {
    if (!isAuthenticated) return [];
    return userType === 'candidate' ? candidateNavItems : companyNavItems;
  };

  const handleNavClick = (path) => {
    window.location.href = path;
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
    `flex items-center space-x-2 text-sm font-medium transition-all duration-200 px-3 py-2 rounded-full ${
      isActivePath(path)
        ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/30'
        : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 hover:bg-white/60 dark:hover:bg-slate-800/60'
    }`;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/20 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl">
      <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-10">
        <Logo />
        
        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center space-x-3">
          {getNavigationItems()?.map((item) => (
            <button
              key={item?.path}
              onClick={() => handleNavClick(item?.path)}
              className={navButtonClass(item?.path)}
            >
              <Icon
                name={item?.icon}
                size={16}
                className={`sm:w-[18px] sm:h-[18px] ${isActivePath(item?.path) ? 'text-white' : 'text-gray-400'}`}
              />
              <span>{item?.label}</span>
            </button>
          ))}
        </nav>

        {/* Desktop Auth Actions */}
        <div className="hidden md:flex items-center space-x-3">
          {!isAuthenticated ? (
            <>
              <Button
                variant="ghost"
                onClick={() => handleNavClick('/login')}
                className="rounded-full border border-white/40 dark:border-slate-700 text-sm text-gray-700 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-800/70"
              >
                Sign In
              </Button>
              <Button
                variant="default"
                onClick={() => handleNavClick('/register')}
                className="rounded-full bg-gradient-to-r from-blue-600 to-purple-600 border-none text-sm shadow-md shadow-blue-500/30 hover:from-blue-700 hover:to-purple-700"
              >
                Get Started
              </Button>
            </>
          ) : (
            <div className="flex items-center space-x-2 sm:space-x-3">
              <Button
                variant="outline"
                iconName="LogOut"
                iconPosition="left"
                onClick={handleLogout}
                className="rounded-full text-sm border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800"
              >
                Sign Out
              </Button>
            </div>
          )}
        </div>

        {/* Mobile Menu Button */}
        <div className="md:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="w-10 h-10 rounded-2xl border border-white/40"
          >
            <Icon name={isMenuOpen ? 'X' : 'Menu'} size={20} />
          </Button>
        </div>
      </div>
      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-white/90 dark:bg-slate-900/90 backdrop-blur border-t border-white/30 dark:border-slate-800 shadow-lg">
          <div className="px-4 py-4 space-y-3">
            {getNavigationItems()?.map((item) => (
              <button
                key={item?.path}
                onClick={() => handleNavClick(item?.path)}
                className={`flex items-center space-x-3 w-full text-left text-sm text-gray-600 dark:text-slate-300 px-3 py-2 rounded-2xl transition-all duration-200 ${
                  isActivePath(item?.path)
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md shadow-blue-500/30'
                    : 'hover:bg-gray-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon name={item?.icon} size={18} className={isActivePath(item?.path) ? 'text-white' : 'text-gray-400'} />
                <span className="font-medium">{item?.label}</span>
              </button>
            ))}
            
            <div className="pt-3 border-t border-white/40 space-y-2">
              {!isAuthenticated ? (
                <>
                  <Button
                    variant="ghost"
                    fullWidth
                    onClick={() => handleNavClick('/login')}
                    className="rounded-2xl border border-white/40 dark:border-slate-700 text-sm text-gray-700 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-800/70"
                  >
                    Sign In
                  </Button>
                  <Button
                    variant="default"
                    fullWidth
                    onClick={() => handleNavClick('/register')}
                    className="rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 border-none text-sm shadow-md shadow-blue-500/30"
                  >
                    Get Started
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    fullWidth
                    iconName="LogOut"
                    iconPosition="left"
                    onClick={handleLogout}
                    className="rounded-2xl border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-slate-200 text-sm hover:bg-gray-50 dark:hover:bg-slate-800"
                  >
                    Sign Out
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;