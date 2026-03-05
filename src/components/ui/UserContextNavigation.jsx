import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Icon from '../AppIcon';
import Button from './Button';
import NavigationMenu from './NavigationMenu';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { formatCandidateFieldValue } from '../../utils/profileDisplay.js';
import { filterNavByRole } from '../../utils/rolePermissions';
import CandidateAIChatAssistant from '../../pages/candidate-dashboard/components/AIChatAssistant';
import CompanyAIChatAssistant from '../../pages/company-dashboard/components/AIChatAssistant';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const FIREBASE_STORAGE_BUCKET = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '';

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
      description: 'Overview and progress tracking'
    },
    { 
      label: 'Jobs', 
      path: '/jobs', 
      icon: 'Briefcase',
      description: 'Browse available positions'
    },
    {
      label: 'Companies',
      path: '/companies',
      icon: 'Building2',
      description: 'Browse company profiles'
    },
    { 
      label: 'My Applications', 
      path: '/my-applications', 
      icon: 'FileText',
      description: 'Track your job applications'
    },
    { 
      label: 'Practice Interview', 
      path: '/practice-interview-setup', 
      icon: 'Play',
      description: 'Set up practice sessions'
    },
    { 
      label: 'My Analytics', 
      path: '/candidate-analytics', 
      icon: 'BarChart2',
      description: 'Track your performance trends'
    },
    {
      label: 'Achievements',
      path: '/gamification',
      icon: 'Trophy',
      description: 'Streaks, badges, XP & challenges'
    },
    {
      label: 'Prep Library',
      path: '/interview-prep-library',
      icon: 'BookOpen',
      description: 'Guides, question bank & STAR builder'
    },
    {
      label: 'Referral Program',
      path: '/referral-program',
      icon: 'Gift',
      description: 'Invite friends and earn rewards'
    },
    {
      label: 'Privacy & Data',
      path: '/privacy-settings',
      icon: 'Shield',
      description: 'GDPR rights, data export & deletion'
    },
    {
      label: 'Settings',
      path: '/candidate-settings',
      icon: 'Settings',
      description: 'Edit your profile details'
    },
  ];

  const companyNavItems = [
    { 
      key: 'dashboard',
      label: 'Dashboard', 
      path: '/company-dashboard', 
      icon: 'LayoutDashboard',
      description: 'Company overview and analytics'
    },
    { 
      key: 'hiring',
      label: 'Hiring', 
      icon: 'Briefcase',
      description: 'Jobs, applications, and candidates',
      items: [
        { label: 'Jobs', path: '/company-jobs', icon: 'Briefcase', description: 'Manage job postings', requiredPermission: 'ACCESS_JOBS_PAGE' },
        { label: 'Templates', path: '/company-templates', icon: 'ListChecks', description: 'Manage structured interview templates', requiredPermission: 'ACCESS_JOBS_PAGE' },
        { label: 'Applications', path: '/company-applications', icon: 'FileText', description: 'Review candidate applications', requiredPermission: 'ACCESS_APPLICATIONS_PAGE' },
        { label: 'Candidates', path: '/company-candidates', icon: 'Users', description: 'Manage candidate pipeline', requiredPermission: 'ACCESS_CANDIDATES_PAGE' },
        { label: 'Interviews', path: '/company-interviews', icon: 'Calendar', description: 'View and manage interviews', requiredPermission: 'ACCESS_INTERVIEWS_PAGE' },
      ]
    },
    { 
      key: 'analytics',
      label: 'Analytics', 
      path: '/company-analytics', 
      icon: 'BarChart3',
      description: 'View progress and metrics',
      requiredPermission: 'ACCESS_ANALYTICS_PAGE'
    },
    { 
      key: 'team',
      label: 'Team Members', 
      path: '/company-team-members', 
      icon: 'Users2',
      description: 'Manage team members and invitations',
      requiredPermission: 'MANAGE_MEMBERS'
    },
    { 
      key: 'billing',
      label: 'Billing', 
      path: '/company-billing', 
      icon: 'CreditCard',
      description: 'Plan, usage, and billing history'
    },
    {
      key: 'public-profile',
      label: 'Public Profile',
      path: '/company-profile-editor',
      icon: 'Globe',
      description: 'Edit your company\'s public page'
    },
    {
      key: 'webhooks',
      label: 'Webhooks',
      path: '/company-webhooks',
      icon: 'Webhook',
      description: 'Integrate with your ATS and tools'
    },
    {
      key: 'privacy',
      label: 'Privacy & Data',
      path: '/privacy-settings',
      icon: 'Shield',
      description: 'GDPR rights, data export & deletion'
    },
    { 
      key: 'settings',
      label: 'Settings', 
      path: '/company-settings', 
      icon: 'Settings',
      description: 'Organization and user profile settings'
    },
  ];

  const adminNavItems = [
    {
      key: 'overview',
      label: 'Overview',
      path: '/system-admin-dashboard',
      exact: true,
      icon: 'LayoutDashboard',
      description: 'Platform stats and quick actions'
    },
    {
      key: 'organizations',
      label: 'Organizations',
      icon: 'Building2',
      description: 'Approvals and organization controls',
      items: [
        {
          label: 'Pending Approvals',
          path: '/system-admin-dashboard/approvals',
          icon: 'CheckCircle',
          description: 'Review pending organizations'
        },
        {
          label: 'All Organizations',
          path: '/system-admin-dashboard/organizations',
          icon: 'Building',
          description: 'Manage organization lifecycle'
        },
      ],
    },
    {
      key: 'users',
      label: 'Users',
      path: '/system-admin-dashboard/users',
      icon: 'Users',
      description: 'Manage users and admin promotions'
    },
    {
      key: 'operations',
      label: 'Operations',
      path: '/system-admin-dashboard/operations',
      icon: 'Wallet',
      description: 'Billing, retention, and newsletters'
    },
    {
      key: 'governance',
      label: 'Governance',
      icon: 'Scale',
      description: 'Policy, templates, fairness, and auditing',
      items: [
        {
          label: 'Templates',
          path: '/system-admin-dashboard/templates',
          icon: 'ListChecks',
          description: 'Structured template defaults and adoption'
        },
        {
          label: 'Fairness',
          path: '/system-admin-dashboard/fairness',
          icon: 'Scale',
          description: 'Calibration and fairness checks'
        },
        {
          label: 'System Settings',
          path: '/system-admin-dashboard/settings',
          icon: 'Settings',
          description: 'Maintenance and platform flags'
        },
        {
          label: 'Audit Logs',
          path: '/system-admin-dashboard/audit',
          icon: 'FileText',
          description: 'Trace administrative events'
        },
      ],
    },
    {
      key: 'data-research',
      label: 'Data & AI',
      icon: 'Database',
      description: 'Datasets, models, and research tools',
      items: [
        {
          label: 'Training Data',
          path: '/system-admin-dashboard/training-data',
          icon: 'Database',
          description: 'Inspect and export datasets'
        },
        {
          label: 'Question Catalog',
          path: '/system-admin-dashboard/question-catalog',
          icon: 'BookOpenCheck',
          description: 'Import and curate approved question pools'
        },
        {
          label: 'Classification Metrics',
          path: '/system-admin-dashboard/classification',
          icon: 'Grid3X3',
          description: 'Confusion matrix and precision/recall'
        },
        {
          label: 'Model Fine-Tuning',
          path: '/system-admin-dashboard/fine-tuning',
          icon: 'Cpu',
          description: 'Train LLM from interview data'
        },
        {
          label: 'MediaPipe Calibration',
          path: '/system-admin-dashboard/mediapipe-calibration',
          icon: 'ScanFace',
          description: 'Posture and face threshold calibration'
        },
        {
          label: 'Research Tools',
          path: '/system-admin-dashboard/research-tools',
          icon: 'FlaskConical',
          description: 'Record posture and analyze videos'
        },
      ],
    },
    {
      key: 'support',
      label: 'Live Chat',
      path: '/system-admin-dashboard/live-chat',
      icon: 'MessageSquare',
      description: 'Respond to user support chats'
    },
  ];

  // Filter navigation items based on organization role for company users
  const navigationItems = useMemo(() => {
    if (userType === 'candidate') return candidateNavItems;
    if (userType === 'admin') return adminNavItems;
    if (userType === 'company') {
      const role = user?.organizationContext?.membership?.role;
      return filterNavByRole(companyNavItems, role);
    }
    return companyNavItems;
  }, [userType, user?.organizationContext?.membership?.role]);

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
  const mobilePrimaryItems = navigationItems?.slice(0, 4) || [];

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
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-gray-200/50 dark:border-slate-800 safe-area-padding"
      >
        <div className="flex items-center justify-around h-16 xs:h-18 px-2">
          {mobilePrimaryItems.map((item, index) => {
            const isActive = isNavigationItemActive(item, activeItem);
            const subItems = getNavigableSubItems(item);
            const hasSubmenu = !item?.path && subItems.length > 1;
            // Use key property if available, otherwise use path, otherwise use index
            const uniqueKey = item?.key || item?.path || `nav-item-${index}`;
            const isSubmenuOpen = mobileGroupMenuKey === uniqueKey;
            const isFirstItem = index === 0;
            const isLastPrimaryItem = index === mobilePrimaryItems.length - 1;
            const popoverPositionClass = isFirstItem
              ? 'left-0'
              : isLastPrimaryItem
                ? 'right-0'
                : 'left-1/2 -translate-x-1/2';
            
            return (
              <div key={uniqueKey} className="relative flex flex-col items-center">
                {hasSubmenu && isSubmenuOpen && (
                  <div
                    role="menu"
                    aria-label={`${item?.label || 'Navigation'} submenu`}
                    className={`absolute bottom-full mb-2 z-50 w-44 max-w-[46vw] rounded-2xl border border-gray-200/70 dark:border-slate-700/80 bg-white/96 dark:bg-slate-900/96 backdrop-blur-xl shadow-[0_20px_35px_rgba(15,23,42,0.2)] overflow-hidden ${popoverPositionClass}`}
                  >
                    <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2.5 h-2.5 rotate-45 bg-white/96 dark:bg-slate-900/96 border-r border-b border-gray-200/70 dark:border-slate-700/80" />
                    <div className="px-2 py-1.5">
                      <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400 px-1 pb-1">
                        {item?.label}
                      </p>
                      <div className="space-y-1">
                        {subItems.map((subItem, subIndex) => {
                          const isSubActive = isNavigationItemActive(subItem, activeItem);
                          const subItemKey = subItem?.path || `${uniqueKey}-sub-${subIndex}`;

                          return (
                            <button
                              key={subItemKey}
                              role="menuitem"
                              onClick={() => handleNavigation(subItem.path)}
                              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all duration-200 text-left ${
                                isSubActive
                                  ? 'bg-blue-100 dark:bg-blue-900/45 text-blue-700 dark:text-blue-300'
                                  : 'text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800'
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
                  </div>
                )}

                <button
                  onClick={() => handleMobileTabNavigation(item, uniqueKey)}
                  className={`flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 min-w-[60px] ${
                    isActive
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-500 dark:text-slate-400'
                  }`}
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
                  <span className="text-xs font-medium text-center whitespace-nowrap">
                    {item?.label?.split(' ')[0]}
                  </span>
                </button>
              </div>
            );
          })}
          
          {/* Profile button on mobile */}
          <button
            onClick={handleProfileClick}
            className="flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl text-gray-500 dark:text-slate-400 min-w-[60px]"
            aria-label="Profile"
          >
            <div className="w-7 h-7 rounded-full border border-gray-200 dark:border-slate-700 bg-gray-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
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
                  size={14}
                  className="text-gray-400 dark:text-slate-500"
                />
              )}
            </div>
            <span className="text-xs font-medium">Profile</span>
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
