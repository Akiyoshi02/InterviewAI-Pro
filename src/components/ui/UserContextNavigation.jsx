import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Icon from '../AppIcon';
import Button from './Button';
import NavigationMenu from './NavigationMenu';
import { ADMIN_NAV_ITEMS } from '../../config/adminNavigation.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { formatCandidateFieldValue } from '../../utils/profileDisplay.js';
import { filterNavByRole } from '../../utils/rolePermissions';
import CandidateAIChatAssistant from '../../pages/candidate-dashboard/components/AIChatAssistant';
import CompanyAIChatAssistant from '../../pages/company-dashboard/components/AIChatAssistant';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const FIREBASE_STORAGE_BUCKET = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '';
const MOBILE_PRIMARY_NAV_LIMIT = 4;
const MOBILE_OVERFLOW_MENU_KEY = '__mobile-overflow__';

const buildCurrentRoute = (pathname = '', hash = '') => `${pathname || ''}${hash || ''}`;

const normalizeRoute = (value = '') => {
  const raw = typeof value === 'string' ? value : '';
  const [pathnamePart = '', hashPart = ''] = raw.split('#');
  const trimmedPathname = pathnamePart.replace(/\/+$/, '');
  const pathname = trimmedPathname || '/';
  const hash = hashPart ? `#${hashPart}` : '';
  return { pathname, hash };
};

const isRouteMatch = (currentRoute, targetRoute, { exact = false } = {}) => {
  if (!targetRoute || typeof targetRoute !== 'string') return false;

  const current = normalizeRoute(currentRoute);
  const target = normalizeRoute(targetRoute);

  if (target.hash) {
    return current.pathname === target.pathname && current.hash === target.hash;
  }

  if (exact) return current.pathname === target.pathname;
  if (target.pathname === '/') return current.pathname === '/';
  return current.pathname === target.pathname || current.pathname.startsWith(`${target.pathname}/`);
};

const normalizeUploadsPath = (value) => {
  if (!value || typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('/')) return trimmed;

  const lower = trimmed.toLowerCase();
  if (lower.startsWith('uploads/')) {
    return `/${trimmed}`;
  }

  const uploadDirs = [
    'profile-photos/',
    'company-logos/',
    'company-verifications/',
    'resumes/',
  ];

  const matched = uploadDirs.find((dir) => lower.startsWith(dir));
  if (matched) {
    return `/uploads/${trimmed}`;
  }

  return '';
};

const buildAssetSources = (value) => {
  if (!value || typeof value !== 'string') return [];
  const trimmed = value.trim();
  if (!trimmed) return [];

  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return [trimmed];
  }

  const uploadsPath = normalizeUploadsPath(trimmed);
  if (uploadsPath) {
    const base = API_BASE_URL.replace(/\/$/, '');
    const sources = [];
    if (base) sources.push(`${base}${uploadsPath}`);
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      if (origin && origin !== base) {
        sources.push(`${origin}${uploadsPath}`);
      }
    }
    return sources;
  }

  if (trimmed.startsWith('gs://')) {
    const match = trimmed.match(/^gs:\/\/([^/]+)\/(.+)$/);
    if (match) {
      const [, bucket, objectPath] = match;
      return [
        `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(objectPath)}?alt=media`,
      ];
    }
  }

  if (FIREBASE_STORAGE_BUCKET && !trimmed.startsWith('/')) {
    return [
      `https://firebasestorage.googleapis.com/v0/b/${FIREBASE_STORAGE_BUCKET}/o/${encodeURIComponent(trimmed)}?alt=media`,
    ];
  }

  const normalized = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const base = API_BASE_URL.replace(/\/$/, '');
  const sources = [];
  if (base) sources.push(`${base}${normalized}`);
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    if (origin && origin !== base) {
      sources.push(`${origin}${normalized}`);
    }
  }
  return sources;
};

const UserContextNavigation = ({ 
  userType = 'candidate', 
  isCollapsed = false, 
  onToggleCollapse,
  className = '',
  assistantProps = {}
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const mobileNavRef = useRef(null);
  const [activeItem, setActiveItem] = useState(buildCurrentRoute(location.pathname, location.hash));
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  const [profileImageIndex, setProfileImageIndex] = useState(0);
  const [profileImageFailed, setProfileImageFailed] = useState(false);
  const [mobileGroupMenuKey, setMobileGroupMenuKey] = useState(null);
  const companyOrgRole = String(user?.organizationContext?.membership?.role || '').toUpperCase();

  useEffect(() => {
    setActiveItem(buildCurrentRoute(location.pathname, location.hash));
    setMobileGroupMenuKey(null);
  }, [location.pathname, location.hash]);

  useEffect(() => {
    if (!mobileGroupMenuKey) return undefined;

    const handleClickOutside = (event) => {
      if (!mobileNavRef.current) return;
      if (!mobileNavRef.current.contains(event.target)) {
        setMobileGroupMenuKey(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [mobileGroupMenuKey]);

  const candidateNavItems = [
    { 
      label: 'Dashboard', 
      path: '/candidate-dashboard', 
      icon: 'LayoutDashboard',
      mobileLabel: 'Dashboard',
      description: 'Overview and progress tracking'
    },
    { 
      label: 'Jobs', 
      path: '/jobs', 
      icon: 'Briefcase',
      mobileLabel: 'Jobs',
      description: 'Browse available positions'
    },
    {
      label: 'Companies',
      path: '/companies',
      icon: 'Building2',
      mobileLabel: 'Companies',
      description: 'Browse company profiles'
    },
    { 
      label: 'My Applications', 
      path: '/my-applications', 
      icon: 'FileText',
      mobileLabel: 'Apps',
      description: 'Track your job applications'
    },
    { 
      label: 'Practice Interview', 
      path: '/practice-interview-setup', 
      icon: 'Play',
      mobileLabel: 'Practice',
      description: 'Set up practice sessions'
    },
    { 
      label: 'My Analytics', 
      path: '/candidate-analytics', 
      icon: 'BarChart2',
      mobileLabel: 'Analytics',
      description: 'Track your performance trends'
    },
    {
      label: 'Achievements',
      path: '/gamification',
      icon: 'Trophy',
      mobileLabel: 'Awards',
      description: 'Streaks, badges, XP & challenges'
    },
    {
      label: 'Prep Library',
      path: '/interview-prep-library',
      icon: 'BookOpen',
      mobileLabel: 'Prep',
      description: 'Guides, question bank & STAR builder'
    },
    {
      label: 'Referral Program',
      path: '/referral-program',
      icon: 'Gift',
      mobileLabel: 'Referral',
      description: 'Invite friends and earn rewards'
    },
    {
      label: 'Privacy & Data',
      path: '/privacy-settings',
      icon: 'Shield',
      mobileLabel: 'Privacy',
      description: 'GDPR rights, data export & deletion'
    },
    {
      label: 'Settings',
      path: '/candidate-settings',
      icon: 'Settings',
      mobileLabel: 'Settings',
      description: 'Edit your profile details'
    },
  ];

  const companyNavItems = useMemo(() => {
    const isReviewerRole = companyOrgRole === 'REVIEWER';
    const hiringGroupDescription = isReviewerRole
      ? 'Assigned application, candidate, and interview context'
      : 'Submissions, candidate context, and interview reviews';
    const applicationsDescription = isReviewerRole
      ? 'Review assigned applications and interview context'
      : 'Candidate submissions and status context';
    const candidatesDescription = isReviewerRole
      ? 'Review assigned candidate profiles and resumes'
      : 'Candidate profiles and pipeline context';
    const interviewsDescription = isReviewerRole
      ? 'Review interview evidence, recordings, and scorecards'
      : 'Interview schedule, recordings, and reviews';
    const settingsDescription = isReviewerRole
      ? 'Profile and review preferences'
      : 'Profile and workspace settings';

    const baseItems = [
      { 
        key: 'dashboard',
        label: 'Dashboard', 
        path: '/company-dashboard', 
        icon: 'LayoutDashboard',
        mobileLabel: 'Dashboard',
        description: 'Workspace overview'
      },
      { 
        key: 'hiring',
        label: 'Hiring', 
        icon: 'Briefcase',
        mobileLabel: 'Hiring',
        description: hiringGroupDescription,
        items: [
          { label: 'Jobs', path: '/company-jobs', icon: 'Briefcase', description: 'Job postings and hiring plans', requiredPermission: 'ACCESS_JOBS_PAGE' },
          { label: 'Templates', path: '/company-templates', icon: 'ListChecks', description: 'Manage structured interview templates', requiredPermission: 'ACCESS_TEMPLATES_PAGE' },
          { label: 'Applications', path: '/company-applications', icon: 'FileText', description: applicationsDescription, requiredPermission: 'ACCESS_APPLICATIONS_PAGE' },
          { label: 'Candidates', path: '/company-candidates', icon: 'Users', description: candidatesDescription, requiredPermission: 'ACCESS_CANDIDATES_PAGE' },
          { label: 'Interviews', path: '/company-interviews', icon: 'Calendar', description: interviewsDescription, requiredPermission: 'ACCESS_INTERVIEWS_PAGE' },
        ]
      },
      { 
        key: 'analytics',
        label: 'Analytics', 
        path: '/company-analytics', 
        icon: 'BarChart3',
        mobileLabel: 'Analytics',
        description: 'View progress and metrics',
        requiredPermission: 'ACCESS_ANALYTICS_PAGE'
      },
      { 
        key: 'team',
        label: 'Team Members', 
        path: '/company-team-members', 
        icon: 'Users2',
        mobileLabel: 'Team',
        description: 'Manage team members and invitations',
        requiredPermission: 'MANAGE_MEMBERS'
      },
      { 
        key: 'billing',
        label: 'Billing', 
        path: '/company-billing', 
        icon: 'CreditCard',
        mobileLabel: 'Billing',
        description: 'Plan, usage, and billing history',
        requiredPermission: 'MANAGE_ORGANIZATION',
      },
      {
        key: 'public-profile',
        label: 'Public Profile',
        path: '/company-profile-editor',
        icon: 'Globe',
        mobileLabel: 'Profile',
        description: 'Edit your company\'s public page',
        requiredPermission: 'MANAGE_ORGANIZATION',
      },
      {
        key: 'webhooks',
        label: 'Webhooks',
        path: '/company-webhooks',
        icon: 'Webhook',
        mobileLabel: 'Webhooks',
        description: 'Integrate with your ATS and tools',
        requiredPermission: 'MANAGE_ORGANIZATION',
      },
      {
        key: 'privacy',
        label: 'Privacy & Data',
        path: '/privacy-settings',
        icon: 'Shield',
        mobileLabel: 'Privacy',
        description: 'GDPR rights, data export & deletion'
      },
      { 
        key: 'settings',
        label: 'Settings', 
        path: '/company-settings', 
        icon: 'Settings',
        mobileLabel: 'Settings',
        description: settingsDescription
      },
    ];

    if (isReviewerRole) {
      baseItems.splice(2, 0, {
        key: 'assigned-reviews',
        label: 'Assigned Reviews',
        path: '/company-reviews',
        icon: 'ClipboardCheck',
        mobileLabel: 'Reviews',
        description: 'Your assigned interview feedback queue',
        requiredPermission: 'VIEW_REVIEWS',
      });
    }

    return baseItems;
  }, [companyOrgRole]);

  // Filter navigation items based on organization role for company users
  const navigationItems = useMemo(() => {
    if (userType === 'candidate') return candidateNavItems;
    if (userType === 'admin') return ADMIN_NAV_ITEMS;
    if (userType === 'company') {
      return filterNavByRole(companyNavItems, companyOrgRole);
    }
    return companyNavItems;
  }, [companyNavItems, companyOrgRole, userType]);

  const resolveItemPath = (item) => {
    if (!item) return '';
    if (typeof item.path === 'string' && item.path.trim()) return item.path;
    if (!Array.isArray(item.items)) return '';
    const firstSubItemWithPath = item.items.find(
      (subItem) => typeof subItem?.path === 'string' && subItem.path.trim()
    );
    return firstSubItemWithPath?.path || '';
  };

  const isNavigationItemActive = (item, currentPath) => {
    if (!item || !currentPath) return false;
    const directPath = resolveItemPath(item);
    if (directPath && isRouteMatch(currentPath, directPath, { exact: item.exact === true })) return true;
    if (!Array.isArray(item.items)) return false;

    return item.items.some((subItem) => {
      const subPath = resolveItemPath(subItem);
      return !!subPath && isRouteMatch(currentPath, subPath, { exact: subItem.exact === true });
    });
  };

  const getNavigableSubItems = (item) => {
    if (!Array.isArray(item?.items)) return [];
    return item.items.filter(
      (subItem) => typeof subItem?.path === 'string' && subItem.path.trim()
    );
  };

  const getNavigationItemKey = (item, index = 0) => (
    item?.key || item?.path || item?.label || `nav-item-${index}`
  );

  const getMobileItemLabel = (item) => {
    if (!item) return '';
    if (typeof item.mobileLabel === 'string' && item.mobileLabel.trim()) return item.mobileLabel;
    if (typeof item.label === 'string' && item.label.trim()) {
      return item.label.split(' ')[0];
    }
    return 'Menu';
  };

  const getMobileItemAriaLabel = (item) => (
    item?.fullLabel || item?.label || 'Navigation item'
  );

  const handleNavigation = (path) => {
    if (!path || typeof path !== 'string') return;
    setMobileGroupMenuKey(null);
    setActiveItem(path);

    navigate(path);
  };

  const handleMobileTabNavigation = (item, itemKey) => {
    const hasDirectPath = typeof item?.path === 'string' && item.path.trim();
    const subItems = getNavigableSubItems(item);

    if (!hasDirectPath && subItems.length > 1) {
      setMobileGroupMenuKey((prev) => (prev === itemKey ? null : itemKey));
      return;
    }

    handleNavigation(resolveItemPath(item));
  };

  const handleProfileClick = () => {
    setMobileGroupMenuKey(null);
    if (userType === 'company') {
      handleNavigation('/company-settings');
      return;
    }

    if (userType === 'admin') {
      handleNavigation('/system-admin-dashboard/settings');
      return;
    }

    handleNavigation('/candidate-settings');
  };

  const handleToggleAIChat = () => {
    setIsAIChatOpen((prev) => !prev);
  };

  const storedUser = useMemo(() => {
    if (typeof window === 'undefined') return null;
    try {
      return JSON.parse(window.localStorage.getItem('user') || 'null');
    } catch {
      return null;
    }
  }, [user]);

  const profileImage = userType === 'company'
    ? user?.companyLogoUrl
      || user?.organizationContext?.organization?.branding?.logoUrl
      || storedUser?.companyLogoUrl
      || storedUser?.organizationContext?.organization?.branding?.logoUrl
    : user?.profilePhotoUrl
      || user?.photoURL
      || user?.user_metadata?.photoURL
      || storedUser?.profilePhotoUrl
      || storedUser?.photoURL
      || storedUser?.user_metadata?.photoURL;

  const profileImageSources = useMemo(
    () => buildAssetSources(profileImage),
    [profileImage]
  );

  useEffect(() => {
    setProfileImageIndex(0);
    setProfileImageFailed(false);
  }, [profileImageSources]);

  const profileImageUrl = profileImageFailed
    ? ''
    : (profileImageSources[profileImageIndex] || '');

  const handleProfileImageError = () => {
    if (profileImageIndex < profileImageSources.length - 1) {
      setProfileImageIndex((prev) => prev + 1);
      return;
    }
    setProfileImageFailed(true);
  };

  const displayName = user?.fullName
    || storedUser?.fullName
    || user?.email?.split('@')?.[0]
    || storedUser?.email?.split('@')?.[0]
    || (userType === 'candidate' ? 'Candidate' : userType === 'admin' ? 'Admin' : 'Team');

  const candidateRoleRaw = user?.targetRole
    || storedUser?.targetRole
    || '';
  const candidateRole = formatCandidateFieldValue('targetRole', candidateRoleRaw)
    || 'Job Seeker';

  const companyRole = user?.jobTitle
    || storedUser?.jobTitle
    || 'Hiring Manager';
  const adminRole = 'System Administrator';
  const profilePath = userType === 'company'
    ? '/company-settings'
    : userType === 'admin'
      ? '/system-admin-dashboard/settings'
      : '/candidate-settings';
  const profileIconName = userType === 'company'
    ? 'Building2'
    : userType === 'admin'
      ? 'Shield'
      : 'UserRound';
  const mobileNavigationItems = navigationItems?.filter((item) => (
    userType === 'admin' || resolveItemPath(item) !== profilePath
  )) || [];
  const mobilePrimaryItems = mobileNavigationItems.slice(0, MOBILE_PRIMARY_NAV_LIMIT);
  const mobileOverflowItems = mobileNavigationItems.slice(MOBILE_PRIMARY_NAV_LIMIT);
  const isMoreMenuOpen = mobileGroupMenuKey === MOBILE_OVERFLOW_MENU_KEY;
  const isProfileActive = isRouteMatch(activeItem, profilePath);
  const isOverflowActive = !isProfileActive && mobileOverflowItems.some((item) => (
    isNavigationItemActive(item, activeItem)
  ));
  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:top-14 xs:lg:top-16 transition-all duration-300 ease-out ${
          isCollapsed ? 'lg:w-20' : 'lg:w-72 xl:w-80'
        } ${className}`}
      >
        <div className="relative w-full h-full">
          <div className="absolute inset-0 opacity-70 bg-[radial-gradient(circle_at_0%_0%,rgba(59,130,246,0.15),transparent_45%),radial-gradient(circle_at_100%_0%,rgba(147,51,234,0.15),transparent_40%)]" />
          <div className="relative z-10 flex flex-col h-full border-r border-white/20 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl">
            {/* Header */}
            <div className="flex items-center justify-end p-3 xl:p-4 border-b border-white/20 dark:border-slate-800">
              {onToggleCollapse && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onToggleCollapse}
                  className={`rounded-xl border border-white/40 dark:border-slate-700/50 w-9 h-9 min-w-[36px] ${isCollapsed ? 'mx-auto' : ''}`}
                  aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                  <Icon name={isCollapsed ? "ChevronRight" : "ChevronLeft"} size={18} />
                </Button>
              )}
            </div>

            {/* Navigation Items */}
            <div className="flex-1 overflow-y-auto scroll-container">
              <NavigationMenu
                items={navigationItems}
                variant="accordion"
                onItemClick={handleNavigation}
                activeItem={activeItem}
                isCollapsed={isCollapsed}
                className="p-3 xl:p-4"
              />
            </div>

            {/* User Context Indicator */}
            <div className="p-3 xl:p-4 border-t border-white/20 dark:border-slate-800">
              <button
                type="button"
                onClick={handleProfileClick}
                className={`group w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl xl:rounded-2xl bg-white/70 dark:bg-slate-800/70 border border-white/40 dark:border-slate-700/50 shadow-inner transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(59,130,246,0.16)] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 min-h-touch ${
                  isCollapsed ? 'justify-center' : ''
                }`}
                aria-label="Open profile settings"
              >
                <div className={`rounded-full border border-white/70 dark:border-slate-700/60 bg-white/90 dark:bg-slate-900/90 flex items-center justify-center overflow-hidden shadow flex-shrink-0 ${
                  isCollapsed ? 'w-10 h-10' : 'w-12 h-12 xl:w-14 xl:h-14'
                }`}>
                  {profileImageUrl ? (
                    <img
                      src={profileImageUrl}
                      alt="Profile"
                      className={`h-full w-full ${userType === 'company' ? 'object-contain' : 'object-cover'}`}
                      onError={handleProfileImageError}
                    />
                  ) : (
                    <Icon
                      name={userType === 'company' ? 'Building2' : userType === 'admin' ? 'Shield' : 'UserRound'}
                      size={isCollapsed ? 18 : 22}
                      className="text-blue-600 dark:text-blue-400"
                    />
                  )}
                </div>
                
                {!isCollapsed && (
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm xl:text-base text-gray-900 dark:text-slate-100 truncate">
                      {displayName}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-slate-400 truncate">
                      {userType === 'candidate'
                        ? candidateRole
                        : userType === 'admin'
                          ? adminRole
                          : companyRole}
                    </div>
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav
        ref={mobileNavRef}
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 overflow-visible bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-gray-200/50 dark:border-slate-800 safe-area-padding"
      >
        <div className="flex items-center gap-1 h-16 xs:h-18 px-1.5">
          {mobilePrimaryItems.map((item, index) => {
            const isActive = isNavigationItemActive(item, activeItem);
            const subItems = getNavigableSubItems(item);
            const hasSubmenu = !item?.path && subItems.length > 1;
            const uniqueKey = getNavigationItemKey(item, index);
            const isSubmenuOpen = mobileGroupMenuKey === uniqueKey;
            const isFirstItem = index === 0;
            const isLastPrimaryItem = index === mobilePrimaryItems.length - 1;
            const popoverPositionClass = isFirstItem
              ? 'left-0'
              : isLastPrimaryItem
                ? 'right-0'
                : 'left-1/2 -translate-x-1/2';
            
            return (
              <div key={uniqueKey} className="relative flex min-w-0 flex-1 flex-col items-center">
                {hasSubmenu && isSubmenuOpen && (
                  <div
                    role="menu"
                    aria-label={`${item?.label || 'Navigation'} submenu`}
                    className={`absolute bottom-full mb-3 z-50 w-48 max-w-[min(18rem,calc(100vw-1rem))] overflow-visible rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 shadow-[0_24px_48px_rgba(15,23,42,0.32)] ring-1 ring-black/5 dark:ring-white/10 ${popoverPositionClass}`}
                  >
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white to-slate-50 dark:from-slate-950 dark:to-slate-900" />
                    <div className="relative overflow-hidden rounded-2xl">
                      <div className="px-2 py-1.5 border-b border-gray-200/80 dark:border-slate-800">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-slate-400 px-1">
                          {item?.label}
                        </p>
                      </div>
                      <div className="p-1.5 space-y-1">
                        {subItems.map((subItem, subIndex) => {
                          const isSubActive = isNavigationItemActive(subItem, activeItem);
                          const subItemKey = subItem?.path || `${uniqueKey}-sub-${subIndex}`;

                          return (
                            <button
                              key={subItemKey}
                              type="button"
                              role="menuitem"
                              onClick={() => handleNavigation(subItem.path)}
                              className={`w-full flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-all duration-200 ${
                                isSubActive
                                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300'
                                  : 'text-gray-700 hover:bg-gray-100 dark:text-slate-200 dark:hover:bg-slate-800/90'
                              }`}
                              aria-current={isSubActive ? 'page' : undefined}
                            >
                              <Icon
                                name={subItem?.icon}
                                size={16}
                                className={isSubActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-slate-500'}
                              />
                              <span className="text-xs font-medium truncate">
                                {subItem?.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="absolute left-1/2 -translate-x-1/2 -bottom-1.5 h-3 w-3 rotate-45 border-r border-b border-gray-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900" />
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => handleMobileTabNavigation(item, uniqueKey)}
                  className={`w-full flex flex-col items-center justify-center gap-1 px-1.5 py-2 rounded-xl transition-all duration-200 min-w-0 ${
                    isActive
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-500 dark:text-slate-400'
                  }`}
                  aria-label={getMobileItemAriaLabel(item)}
                  aria-current={isActive ? 'page' : undefined}
                  aria-expanded={hasSubmenu ? isSubmenuOpen : undefined}
                  aria-haspopup={hasSubmenu ? 'menu' : undefined}
                >
                  <div className={`p-1.5 rounded-lg transition-colors ${
                    isActive ? 'bg-blue-100 dark:bg-blue-900/50' : ''
                  }`}>
                    <Icon
                      name={item?.icon}
                      size={20}
                      className={isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-slate-500'}
                    />
                  </div>
                  <span className="max-w-full truncate text-[11px] font-medium leading-tight text-center">
                    {getMobileItemLabel(item)}
                  </span>
                </button>
              </div>
            );
          })}

          {mobileOverflowItems.length > 0 && (
            <div className="relative flex min-w-0 flex-1 flex-col items-center">
              {isMoreMenuOpen && (
                <div
                  role="menu"
                  aria-label="More navigation"
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-50 w-56 max-w-[min(20rem,calc(100vw-1rem))] overflow-visible rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 shadow-[0_24px_48px_rgba(15,23,42,0.32)] ring-1 ring-black/5 dark:ring-white/10"
                >
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white to-slate-50 dark:from-slate-950 dark:to-slate-900" />
                  <div className="relative overflow-hidden rounded-2xl">
                    <div className="max-h-[60vh] overflow-y-auto p-1.5 space-y-1.5">
                      {mobileOverflowItems.map((item, index) => {
                        const overflowKey = getNavigationItemKey(item, index + MOBILE_PRIMARY_NAV_LIMIT);
                        const overflowSubItems = getNavigableSubItems(item);
                        const hasGroupedSubmenu = !item?.path && overflowSubItems.length > 1;
                        const isOverflowItemActive = isNavigationItemActive(item, activeItem);
                        const overflowPath = resolveItemPath(item);

                        if (hasGroupedSubmenu) {
                          return (
                            <div key={overflowKey} className="space-y-1">
                              <div className="px-2.5 pt-1 pb-0.5">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-slate-400">
                                  {item?.label}
                                </p>
                              </div>
                              <div className="space-y-1">
                                {overflowSubItems.map((subItem, subIndex) => {
                                  const isSubActive = isNavigationItemActive(subItem, activeItem);
                                  const subItemKey = subItem?.path || `${overflowKey}-sub-${subIndex}`;

                                  return (
                                    <button
                                      key={subItemKey}
                                      type="button"
                                      role="menuitem"
                                      onClick={() => handleNavigation(subItem.path)}
                                      className={`w-full flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-all duration-200 ${
                                        isSubActive
                                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300'
                                          : 'text-gray-700 hover:bg-gray-100 dark:text-slate-200 dark:hover:bg-slate-800/90'
                                      }`}
                                      aria-current={isSubActive ? 'page' : undefined}
                                    >
                                      <Icon
                                        name={subItem?.icon}
                                        size={16}
                                        className={isSubActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-slate-500'}
                                      />
                                      <span className="text-xs font-medium leading-snug text-left whitespace-normal">
                                        {subItem?.label}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div key={overflowKey} className="space-y-1">
                            {userType === 'admin' && (
                              <div className="px-2.5 pt-1 pb-0.5">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-slate-400">
                                  {item?.label}
                                </p>
                              </div>
                            )}
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => handleNavigation(overflowPath)}
                              className={`w-full flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-all duration-200 ${
                                isOverflowItemActive
                                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300'
                                  : 'text-gray-700 hover:bg-gray-100 dark:text-slate-200 dark:hover:bg-slate-800/90'
                              }`}
                              aria-current={isOverflowItemActive ? 'page' : undefined}
                            >
                              <Icon
                                name={item?.icon}
                                size={16}
                                className={isOverflowItemActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-slate-500'}
                              />
                              <span className="min-w-0 flex-1 text-xs font-medium leading-snug text-left whitespace-normal">
                                {item?.label}
                              </span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="absolute left-1/2 -translate-x-1/2 -bottom-1.5 h-3 w-3 rotate-45 border-r border-b border-gray-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900" />
                </div>
              )}

              <button
                type="button"
                onClick={() => setMobileGroupMenuKey((prev) => (prev === MOBILE_OVERFLOW_MENU_KEY ? null : MOBILE_OVERFLOW_MENU_KEY))}
                className={`w-full flex flex-col items-center justify-center gap-1 px-1.5 py-2 rounded-xl transition-all duration-200 min-w-0 ${
                  isOverflowActive
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-gray-500 dark:text-slate-400'
                }`}
                aria-label="More navigation"
                aria-current={isOverflowActive ? 'page' : undefined}
                aria-expanded={isMoreMenuOpen}
                aria-haspopup="menu"
              >
                <div className={`p-1.5 rounded-lg transition-colors ${
                  isOverflowActive ? 'bg-blue-100 dark:bg-blue-900/50' : ''
                }`}>
                  <Icon
                    name="MoreHorizontal"
                    size={20}
                    className={isOverflowActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-slate-500'}
                  />
                </div>
                <span className="max-w-full truncate text-[11px] font-medium leading-tight text-center">
                  More
                </span>
              </button>
            </div>
          )}
          
          {/* Profile button on mobile */}
          <button
            type="button"
            onClick={handleProfileClick}
            className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1.5 py-2 rounded-xl transition-all duration-200 ${
              isProfileActive
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-slate-400'
            }`}
            aria-label="Profile"
            aria-current={isProfileActive ? 'page' : undefined}
          >
            <div className={`p-1.5 rounded-lg transition-colors ${
              isProfileActive ? 'bg-blue-100 dark:bg-blue-900/50' : ''
            }`}>
              <Icon
                name={profileIconName}
                size={20}
                className={isProfileActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-slate-500'}
              />
            </div>
            <span className="max-w-full truncate text-[11px] font-medium leading-tight text-center">Profile</span>
          </button>
        </div>
      </nav>

      {userType === 'company' ? (
        <CompanyAIChatAssistant
          isOpen={isAIChatOpen}
          onToggle={handleToggleAIChat}
          {...assistantProps}
        />
      ) : userType === 'candidate' ? (
        <CandidateAIChatAssistant
          isOpen={isAIChatOpen}
          onToggle={handleToggleAIChat}
        />
      ) : null}
    </>
  );
};

export default UserContextNavigation;
