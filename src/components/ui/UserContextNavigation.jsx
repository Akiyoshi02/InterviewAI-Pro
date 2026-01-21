import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Icon from '../AppIcon';
import BrandMark from '../BrandMark';
import Button from './Button';
import ProfileSettingsModal from './ProfileSettingsModal';
import NavigationMenu from './NavigationMenu';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { formatCandidateFieldValue } from '../../utils/profileDisplay.js';
import { filterNavByRole } from '../../utils/rolePermissions';
import CandidateAIChatAssistant from '../../pages/candidate-dashboard/components/AIChatAssistant';
import CompanyAIChatAssistant from '../../pages/company-dashboard/components/AIChatAssistant';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const FIREBASE_STORAGE_BUCKET = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '';

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
  const [activeItem, setActiveItem] = useState(location.pathname);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  const [profileImageIndex, setProfileImageIndex] = useState(0);
  const [profileImageFailed, setProfileImageFailed] = useState(false);

  useEffect(() => {
    setActiveItem(location.pathname);
  }, [location.pathname]);

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
        { label: 'Applications', path: '/company-applications', icon: 'FileText', description: 'Review candidate applications', requiredPermission: 'ACCESS_APPLICATIONS_PAGE' },
        { label: 'Candidates', path: '/company-candidates', icon: 'Users', description: 'Manage candidate pipeline', requiredPermission: 'ACCESS_CANDIDATES_PAGE' },
      ]
    },
    { 
      key: 'interviews',
      label: 'Interviews', 
      icon: 'Calendar',
      description: 'Invitations and interviews',
      items: [
        { label: 'Invitations', path: '/company-invitations', icon: 'Send', description: 'Send and manage interview invitations', requiredPermission: 'ACCESS_INVITATIONS_PAGE' },
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
  ];

  // Filter navigation items based on organization role for company users
  const navigationItems = useMemo(() => {
    if (userType === 'candidate') return candidateNavItems;
    if (userType === 'company') {
      const role = user?.organizationContext?.membership?.role;
      return filterNavByRole(companyNavItems, role);
    }
    return companyNavItems;
  }, [userType, user?.organizationContext?.membership?.role]);

  const handleNavigation = (path) => {
    setActiveItem(path);
    navigate(path);
  };

  const handleProfileClick = () => {
    setIsProfileOpen(true);
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
    || (userType === 'candidate' ? 'Candidate' : 'Team');

  const candidateRoleRaw = user?.targetRole
    || storedUser?.targetRole
    || '';
  const candidateRole = formatCandidateFieldValue('targetRole', candidateRoleRaw)
    || 'Job Seeker';

  const companyRole = user?.jobTitle
    || storedUser?.jobTitle
    || 'Hiring Manager';

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
            <div className="flex items-center justify-between p-3 xl:p-4 border-b border-white/20 dark:border-slate-800">
              {!isCollapsed && (
                <BrandMark
                  className="items-center"
                  iconWrapperClassName="w-8 h-8 xl:w-9 xl:h-9"
                  textClassName="text-base xl:text-lg"
                  showTagline={false}
                />
              )}
              
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
                      name={userType === 'company' ? 'Building2' : 'UserRound'}
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
                      {userType === 'candidate' ? candidateRole : companyRole}
                    </div>
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-gray-200/50 dark:border-slate-800 safe-area-padding">
        <div className="flex items-center justify-around h-16 xs:h-18 px-2">
          {navigationItems?.slice(0, 4).map((item, index) => {
            const isActive = activeItem === item?.path;
            // Use key property if available, otherwise use path, otherwise use index
            const uniqueKey = item?.key || item?.path || `nav-item-${index}`;
            
            return (
              <button
                key={uniqueKey}
                onClick={() => handleNavigation(item?.path)}
                className={`flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 min-w-[60px] ${
                  isActive
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-gray-500 dark:text-slate-400'
                }`}
                aria-current={isActive ? 'page' : undefined}
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
                <span className="text-[10px] xs:text-xs font-medium truncate max-w-[60px]">
                  {item?.label?.split(' ')[0]}
                </span>
              </button>
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
                  name={userType === 'company' ? 'Building2' : 'UserRound'}
                  size={14}
                  className="text-gray-400 dark:text-slate-500"
                />
              )}
            </div>
            <span className="text-[10px] xs:text-xs font-medium">Profile</span>
          </button>
        </div>
      </nav>

      <ProfileSettingsModal
        open={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        userType={userType}
      />

      {userType === 'company' ? (
        <CompanyAIChatAssistant
          isOpen={isAIChatOpen}
          onToggle={handleToggleAIChat}
          {...assistantProps}
        />
      ) : (
        <CandidateAIChatAssistant
          isOpen={isAIChatOpen}
          onToggle={handleToggleAIChat}
        />
      )}
    </>
  );
};

export default UserContextNavigation;
