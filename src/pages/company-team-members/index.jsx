import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Header from '../../components/ui/Header';
import UserContextNavigation from '../../components/ui/UserContextNavigation';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Icon from '../../components/AppIcon';
import LoadingState from '../../components/ui/LoadingState';
import UnifiedFilterPanel, {
  FILTER_GRID_CLASS,
  FILTER_SUBPANEL_CLASS,
  UnifiedFilterSelect,
  UnifiedFilterToggleButton,
  UnifiedSearchField,
} from '../../components/ui/UnifiedFilterPanel';
import { useAuth } from '../../contexts/AuthContext.jsx';
import apiClient from '../../services/apiClient.js';
import { useRealtimePathFeed } from '../../hooks/useRealtimePathFeed';
import { hasPermission } from '../../utils/rolePermissions';
import {
  ORGANIZATION_FEED_EVENTS,
  combineRealtimeEventTypes,
} from '../../constants/realtimeFeedEvents.js';

const roleOptions = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'RECRUITER', label: 'Recruiter' },
  { value: 'REVIEWER', label: 'Reviewer' },
];

const MEMBER_STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Membership Statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

const MEMBER_SORT_OPTIONS = [
  { value: 'nameAsc', label: 'Name (A-Z)' },
  { value: 'nameDesc', label: 'Name (Z-A)' },
  { value: 'roleAsc', label: 'Role (A-Z)' },
  { value: 'recent', label: 'Most Recently Added' },
];

const INVITATION_SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'emailAsc', label: 'Email (A-Z)' },
  { value: 'roleAsc', label: 'Role (A-Z)' },
];

const DEFAULT_TEAM_MEMBER_FILTERS = {
  searchQuery: '',
  roleFilter: 'all',
  statusFilter: 'all',
  sortBy: 'nameAsc',
};

const DEFAULT_TEAM_INVITATION_FILTERS = {
  searchQuery: '',
  roleFilter: 'all',
  sortBy: 'newest',
};

const normalizeFilterString = (value) => (value || '').toString().trim().toLowerCase();

const countActiveMemberFilters = (filters = {}) => {
  let count = 0;
  if (normalizeFilterString(filters.searchQuery)) count += 1;
  if ((filters.roleFilter || 'all') !== 'all') count += 1;
  if ((filters.statusFilter || 'all') !== 'all') count += 1;
  if ((filters.sortBy || 'nameAsc') !== 'nameAsc') count += 1;
  return count;
};

const countActiveInvitationFilters = (filters = {}) => {
  let count = 0;
  if (normalizeFilterString(filters.searchQuery)) count += 1;
  if ((filters.roleFilter || 'all') !== 'all') count += 1;
  if ((filters.sortBy || 'newest') !== 'newest') count += 1;
  return count;
};

const CompanyTeamMembersPage = () => {
  const navigate = useNavigate();
  const { user, logout, organization, organizationRole, status } = useAuth();
  const isOrgAdmin = organizationRole === 'ADMIN';

  if (status === 'loading' || !user) {
    return (
      <LoadingState
        title="Loading team members"
        message="Syncing memberships and invitations."
        variant="fullscreen"
        tone="primary"
      />
    );
  }

  // Redirect if user doesn't have MANAGE_MEMBERS permission
  if (!hasPermission(organizationRole, 'MANAGE_MEMBERS')) {
    return <Navigate to="/company-dashboard" replace />;
  }

  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('REVIEWER');
  const [inviting, setInviting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [removeMemberConfirm, setRemoveMemberConfirm] = useState(null);
  const [updatingRoleId, setUpdatingRoleId] = useState(null);
  const [memberFilters, setMemberFilters] = useState(DEFAULT_TEAM_MEMBER_FILTERS);
  const [invitationFilters, setInvitationFilters] = useState(DEFAULT_TEAM_INVITATION_FILTERS);
  const [showAdvancedMemberFilters, setShowAdvancedMemberFilters] = useState(false);
  const [showAdvancedInvitationFilters, setShowAdvancedInvitationFilters] = useState(false);
  const [teamInvitations, setTeamInvitations] = useState([]);
  const [loadingInvitations, setLoadingInvitations] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const realtimeRefreshTimeoutRef = useRef(null);
  const loadMembersRef = useRef(null);
  const loadInvitationsRef = useRef(null);

  const loadMembers = useCallback(async () => {
    if (!organization?.id) return;
    setLoadingMembers(true);
    try {
      const result = await apiClient.organizations.listMembers();
      if (result.success) {
        setMembers(result.members || []);
      }
    } catch {
      // Silent failure -- table stays empty; user can refresh
    } finally {
      setLoadingMembers(false);
    }
  }, [organization?.id]);

  const loadInvitations = useCallback(async () => {
    if (!organization?.id) return;
    setLoadingInvitations(true);
    try {
      const result = await apiClient.teamInvitations.list();
      if (result.success) {
        setTeamInvitations(result.invitations || []);
      }
    } catch {
      // Silent failure -- table stays empty; user can refresh
    } finally {
      setLoadingInvitations(false);
    }
  }, [organization?.id]);

  useEffect(() => {
    loadMembersRef.current = loadMembers;
  }, [loadMembers]);

  useEffect(() => {
    loadInvitationsRef.current = loadInvitations;
  }, [loadInvitations]);

  useRealtimePathFeed({
    path: organization?.id ? `organizationFeeds/${organization.id}` : null,
    enabled: Boolean(organization?.id),
    eventTypes: combineRealtimeEventTypes(
      ORGANIZATION_FEED_EVENTS.team,
      ORGANIZATION_FEED_EVENTS.profile,
    ),
    onFeedUpdate: (_feed, { initial }) => {
      if (initial) return;
      if (realtimeRefreshTimeoutRef.current) {
        clearTimeout(realtimeRefreshTimeoutRef.current);
      }
      realtimeRefreshTimeoutRef.current = setTimeout(() => {
        loadMembersRef.current?.();
        loadInvitationsRef.current?.();
      }, 300);
    },
  });

  useEffect(
    () => () => {
      if (realtimeRefreshTimeoutRef.current) {
        clearTimeout(realtimeRefreshTimeoutRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    loadMembers();
    loadInvitations();
  }, [loadMembers, loadInvitations]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleInviteMember = async () => {
    if (!inviteEmail.trim() || !organization?.id) return;
    setInviting(true);
    setStatusMessage('');
    try {
      const result = await apiClient.teamInvitations.send(inviteEmail.trim(), inviteRole);
      if (result.success) {
        setStatusMessage('Invitation sent successfully.');
        setInviteEmail('');
        setInviteRole('REVIEWER');
        loadInvitations();
      } else {
        const errorMsg = typeof result.error === 'string'
          ? result.error
          : (result.error?.message || 'Failed to send invitation.');
        setStatusMessage(errorMsg);
      }
    } catch (err) {
      const errorMsg = err?.message || (typeof err === 'string' ? err : 'Failed to invite member.');
      setStatusMessage(errorMsg);
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = (userId) => {
    setRemoveMemberConfirm(userId);
  };

  const confirmRemoveMember = async () => {
    const userId = removeMemberConfirm;
    setRemoveMemberConfirm(null);
    if (!organization?.id || !userId) return;
    try {
      const result = await apiClient.organizations.removeMember(userId);
      if (result.success) {
        setMembers((prev) => prev.filter((m) => m.userId !== userId));
        setStatusMessage('Member removed.');
      }
    } catch (err) {
      const errorMsg = err?.message || (typeof err === 'string' ? err : 'Failed to remove member.');
      setStatusMessage(errorMsg);
    }
  };

  const handleUpdateMemberRole = async (userId, newRole) => {
    if (!organization?.id) return;
    setUpdatingRoleId(userId);
    try {
      const result = await apiClient.organizations.updateMemberRole(userId, newRole);
      if (result.success) {
        setMembers((prev) =>
          prev.map((m) => (m.userId === userId ? { ...m, role: newRole } : m)),
        );
        setStatusMessage('Member role updated.');
      }
    } catch (err) {
      const errorMsg = err?.message || (typeof err === 'string' ? err : 'Failed to update role.');
      setStatusMessage(errorMsg);
    } finally {
      setUpdatingRoleId(null);
    }
  };

  const updateMemberFilter = (key, value) => {
    setMemberFilters((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const updateInvitationFilter = (key, value) => {
    setInvitationFilters((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const clearMemberFilters = () => {
    setMemberFilters(DEFAULT_TEAM_MEMBER_FILTERS);
    setShowAdvancedMemberFilters(false);
  };

  const clearInvitationFilters = () => {
    setInvitationFilters(DEFAULT_TEAM_INVITATION_FILTERS);
    setShowAdvancedInvitationFilters(false);
  };

  const activeMemberFilterCount = countActiveMemberFilters(memberFilters);
  const activeInvitationFilterCount = countActiveInvitationFilters(invitationFilters);

  const filteredMembers = useMemo(() => {
    const search = normalizeFilterString(memberFilters.searchQuery);
    const tokens = search.split(' ').filter(Boolean);

    return members
      .filter((member) => {
        const role = (member?.role || '').toString().toUpperCase();
        const membershipStatus = (member?.status || 'ACTIVE').toString().toUpperCase();
        const searchableText = [
          member?.user?.fullName || '',
          member?.user?.email || '',
          role,
          membershipStatus,
        ]
          .join(' ')
          .toLowerCase();

        if (memberFilters.roleFilter !== 'all' && role !== memberFilters.roleFilter) return false;
        if (memberFilters.statusFilter !== 'all' && membershipStatus !== memberFilters.statusFilter) return false;
        if (tokens.length && !tokens.every((token) => searchableText.includes(token))) return false;
        return true;
      })
      .sort((left, right) => {
        const leftName = (left?.user?.fullName || left?.user?.email || '').toLowerCase();
        const rightName = (right?.user?.fullName || right?.user?.email || '').toLowerCase();
        if (memberFilters.sortBy === 'nameDesc') return rightName.localeCompare(leftName);
        if (memberFilters.sortBy === 'roleAsc') return (left?.role || '').localeCompare(right?.role || '');
        if (memberFilters.sortBy === 'recent') {
          const leftCreated = new Date(left?.createdAt || 0).getTime() || 0;
          const rightCreated = new Date(right?.createdAt || 0).getTime() || 0;
          return rightCreated - leftCreated;
        }
        return leftName.localeCompare(rightName);
      });
  }, [memberFilters, members]);

  // Filter to only show truly pending invitations (not accepted or rejected)
  const pendingInvitations = useMemo(() => {
    return teamInvitations.filter((inv) => inv.status === 'PENDING');
  }, [teamInvitations]);

  const filteredPendingInvitations = useMemo(() => {
    const search = normalizeFilterString(invitationFilters.searchQuery);
    const tokens = search.split(' ').filter(Boolean);
    return pendingInvitations
      .filter((invitation) => {
        const role = (invitation?.role || '').toString().toUpperCase();
        const searchableText = [
          invitation?.email || '',
          role,
          invitation?.status || '',
        ]
          .join(' ')
          .toLowerCase();

        if (invitationFilters.roleFilter !== 'all' && role !== invitationFilters.roleFilter) return false;
        if (tokens.length && !tokens.every((token) => searchableText.includes(token))) return false;
        return true;
      })
      .sort((left, right) => {
        const leftInvited = new Date(left?.invitedAt || left?.createdAt || 0).getTime() || 0;
        const rightInvited = new Date(right?.invitedAt || right?.createdAt || 0).getTime() || 0;
        if (invitationFilters.sortBy === 'oldest') return leftInvited - rightInvited;
        if (invitationFilters.sortBy === 'emailAsc') return (left?.email || '').localeCompare(right?.email || '');
        if (invitationFilters.sortBy === 'roleAsc') return (left?.role || '').localeCompare(right?.role || '');
        return rightInvited - leftInvited;
      });
  }, [invitationFilters, pendingInvitations]);

  const handleRevokeInvitation = async (id) => {
    try {
      const result = await apiClient.teamInvitations.revoke(id);
      if (result.success) {
        setStatusMessage('Invitation revoked.');
        setTeamInvitations((prev) => prev.filter((inv) => inv.id !== id));
      }
    } catch (err) {
      const errorMsg = err?.message || (typeof err === 'string' ? err : 'Failed to revoke invitation.');
      setStatusMessage(errorMsg);
    }
  };

  const handleResendInvitation = async (id) => {
    try {
      const result = await apiClient.teamInvitations.resend(id);
      if (result.success) {
        setStatusMessage('Invitation email resent.');
      }
    } catch (err) {
      const errorMsg = err?.message || (typeof err === 'string' ? err : 'Failed to resend invitation.');
      setStatusMessage(errorMsg);
    }
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow shadow-purple-500/20';
      case 'RECRUITER':
        return 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow shadow-blue-500/20';
      case 'REVIEWER':
        return 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow shadow-emerald-500/20';
      default:
        return 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300';
    }
  };

  useEffect(() => {
    document.title = 'Team Members - InterviewAI Pro';
  }, []);

  const viewportConfig = { once: true, amount: 0.15 };
  const sectionReveal = {
    hidden: { opacity: 0, y: 32 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: 'easeOut' }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <Header
        userType="company"
        isAuthenticated
        onLogout={handleLogout}
        organizationRole={organizationRole}
      />
      
      {/* Spacer for fixed header */}
      <div className="h-14 xs:h-16" />
      
      <div className="relative z-10">
        <div className="flex flex-col lg:flex-row">
          <UserContextNavigation
            userType="company"
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          />
          <main className={`flex-1 transition-all duration-300 pb-20 lg:pb-0 ${
            isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72 xl:ml-80'
          }`}>
            <div className="container-responsive py-6 sm:py-8">
            <motion.section
              initial="hidden"
              whileInView="visible"
              viewport={viewportConfig}
              variants={sectionReveal}
              className="space-y-4 sm:space-y-6"
            >
              {/* Page Header */}
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="shrink-0 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 p-3 shadow-lg shadow-purple-500/30">
                    <Icon name="Users2" size={24} color="white" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-slate-100">
                      Team Members
                    </h1>
                    <p className="text-sm sm:text-base text-gray-500 dark:text-slate-400 mt-1">
                      Manage your organization&apos;s team members and invitations
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  iconName="RefreshCw"
                  onClick={() => {
                    loadMembers();
                    loadInvitations();
                  }}
                  disabled={loadingMembers || loadingInvitations}
                  className="self-start rounded-full text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
                >
                  Refresh
                </Button>
              </div>

              {/* Status Message */}
              {statusMessage && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                  {typeof statusMessage === 'string' ? statusMessage : String(statusMessage)}
                </div>
              )}

              {/* Invite Member Section */}
              {isOrgAdmin && (
                <div className="rounded-2xl border border-white/30 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4 sm:p-6 shadow-[0_20px_60px_rgba(15,23,42,0.12)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur">
                  <div className="mb-4">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                      Invite Team Member
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                      Send an invitation to add a new member to your organization
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Input
                        placeholder="Email address"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        className="flex-1"
                        type="email"
                      />
                      <Select
                        options={roleOptions}
                        value={inviteRole}
                        onChange={setInviteRole}
                        className="w-full sm:w-36"
                      />
                      <Button
                        onClick={handleInviteMember}
                        disabled={inviting || !inviteEmail.trim()}
                        className="rounded-full bg-gradient-to-r from-blue-600 to-purple-600 border-none text-white shadow-md shadow-blue-500/30 hover:from-blue-700 hover:to-purple-700"
                      >
                        {inviting ? 'Inviting...' : 'Invite'}
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      An email invitation will be sent to the recipient. They can create a company team account and will be automatically added with the selected role.
                    </p>
                  </div>

                  {/* Pending Invitations */}
                  <div className="mt-6 pt-6 border-t border-gray-200 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100">
                          Pending Invitations
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-slate-400">
                          Showing {filteredPendingInvitations.length} of {pendingInvitations.length} pending invitation{pendingInvitations.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        iconName="RefreshCw"
                        onClick={loadInvitations}
                        disabled={loadingInvitations}
                        className="h-8 w-8 rounded-full text-gray-400 hover:text-blue-500 dark:hover:text-blue-400"
                      />
                    </div>

                    <UnifiedFilterPanel
                      className="mb-4"
                      title="Invitation Filters"
                      description="Filter pending invitations by email, role, and ordering."
                      activeCount={activeInvitationFilterCount}
                      onClear={clearInvitationFilters}
                      headerActions={(
                        <UnifiedFilterToggleButton
                          active={showAdvancedInvitationFilters}
                          onClick={() => setShowAdvancedInvitationFilters((previous) => !previous)}
                          label="Advanced Filters"
                        />
                      )}
                    >
                      <div className={FILTER_GRID_CLASS}>
                        <UnifiedSearchField
                          label="Search"
                          className="sm:col-span-2 xl:col-span-2"
                          type="text"
                          value={invitationFilters.searchQuery}
                          onChange={(event) => updateInvitationFilter('searchQuery', event.target.value)}
                          placeholder="Email or role"
                        />
                        <UnifiedFilterSelect
                          label="Role"
                          value={invitationFilters.roleFilter}
                          onChange={(value) => updateInvitationFilter('roleFilter', value)}
                          options={[{ value: 'all', label: 'All Roles' }, ...roleOptions]}
                        />
                      </div>
                      {showAdvancedInvitationFilters && (
                        <div className={FILTER_SUBPANEL_CLASS}>
                          <div className={FILTER_GRID_CLASS}>
                            <UnifiedFilterSelect
                              label="Sort By"
                              value={invitationFilters.sortBy}
                              onChange={(value) => updateInvitationFilter('sortBy', value)}
                              options={INVITATION_SORT_OPTIONS}
                            />
                          </div>
                        </div>
                      )}
                    </UnifiedFilterPanel>

                    {loadingInvitations && (
                      <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-4">Loading invitations...</p>
                    )}
                    {!loadingInvitations && filteredPendingInvitations.length === 0 && (
                      <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-4">
                        {activeInvitationFilterCount > 0
                          ? 'No pending invitations match the selected filters.'
                          : 'No pending invitations.'}
                      </p>
                    )}
                    {!loadingInvitations && filteredPendingInvitations.length > 0 && (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {filteredPendingInvitations.map((inv) => (
                          <div
                            key={inv.id}
                            className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white/50 p-3 dark:border-slate-700 dark:bg-slate-900/50 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="min-w-0 flex-1">
                              <span className="block text-sm font-medium text-gray-800 dark:text-slate-100 break-all leading-snug">
                                {inv.email}
                              </span>
                              <span className="mt-1 block text-xs text-gray-500 dark:text-slate-400 break-words leading-snug">
                                Role: {inv.role} - Status: {inv.status}
                              </span>
                            </div>
                            <div className="flex items-center justify-end gap-2 self-end sm:self-auto sm:flex-shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                iconName="RefreshCw"
                                onClick={() => handleResendInvitation(inv.id)}
                                className="h-8 w-8 rounded-full text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10"
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                iconName="Trash2"
                                onClick={() => handleRevokeInvitation(inv.id)}
                                className="h-8 w-8 rounded-full text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Members List Section */}
              <div className="rounded-2xl border border-white/30 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4 sm:p-6 shadow-[0_20px_60px_rgba(15,23,42,0.12)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                      Team Members
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-slate-400">
                      Showing {filteredMembers.length} of {members.length} member{members.length !== 1 ? 's' : ''} in your organization
                    </p>
                  </div>
                </div>

                <UnifiedFilterPanel
                  className="mb-4"
                  title="Member Filters"
                  description="Filter team members by name, role, membership status, and sorting."
                  activeCount={activeMemberFilterCount}
                  onClear={clearMemberFilters}
                  headerActions={(
                    <UnifiedFilterToggleButton
                      active={showAdvancedMemberFilters}
                      onClick={() => setShowAdvancedMemberFilters((previous) => !previous)}
                      label="Advanced Filters"
                    />
                  )}
                >
                  <div className={FILTER_GRID_CLASS}>
                    <UnifiedSearchField
                      label="Search"
                      className="sm:col-span-2 xl:col-span-2"
                      type="text"
                      value={memberFilters.searchQuery}
                      onChange={(event) => updateMemberFilter('searchQuery', event.target.value)}
                      placeholder="Name, email, role, or status"
                    />
                    <UnifiedFilterSelect
                      label="Role"
                      value={memberFilters.roleFilter}
                      onChange={(value) => updateMemberFilter('roleFilter', value)}
                      options={[{ value: 'all', label: 'All Roles' }, ...roleOptions]}
                    />
                  </div>
                  {showAdvancedMemberFilters && (
                    <div className={FILTER_SUBPANEL_CLASS}>
                      <div className={FILTER_GRID_CLASS}>
                        <UnifiedFilterSelect
                          label="Membership Status"
                          value={memberFilters.statusFilter}
                          onChange={(value) => updateMemberFilter('statusFilter', value)}
                          options={MEMBER_STATUS_FILTER_OPTIONS}
                        />
                        <UnifiedFilterSelect
                          label="Sort By"
                          value={memberFilters.sortBy}
                          onChange={(value) => updateMemberFilter('sortBy', value)}
                          options={MEMBER_SORT_OPTIONS}
                        />
                      </div>
                    </div>
                  )}
                </UnifiedFilterPanel>

                {/* Members List */}
                <div className="space-y-3">
                  {loadingMembers && (
                    <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-8">Loading members...</p>
                  )}
                  {!loadingMembers && filteredMembers.length === 0 && (
                    <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-8">
                      {activeMemberFilterCount > 0 ? 'No members match the selected filters.' : 'No members found.'}
                    </p>
                  )}
                  {filteredMembers.map((member) => (
                    <div
                      key={member.userId}
                      className="flex flex-col gap-3 rounded-xl border border-white/40 bg-white/80 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(15,23,42,0.1)] dark:border-slate-700/50 dark:bg-slate-800/70 dark:hover:shadow-[0_10px_30px_rgba(0,0,0,0.3)] sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-center gap-4">
                        <img
                          src={
                            member.user?.photoURL ||
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(
                              (() => {
                                const user = member.user;
                                if (typeof user === 'object' && user !== null) {
                                  return user.fullName || user.email || 'U';
                                }
                                return 'U';
                              })()
                            )}&background=6366f1&color=fff`
                          }
                          alt={(() => {
                            const user = member.user;
                            if (typeof user === 'object' && user !== null) {
                              return user.fullName || user.email || 'Member';
                            }
                            return 'Member';
                          })()}
                          className="h-12 w-12 flex-shrink-0 rounded-full object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="break-words font-medium text-gray-900 dark:text-slate-100">
                            {(() => {
                              const user = member.user;
                              if (typeof user === 'object' && user !== null) {
                                return user.fullName || user.email || 'Member';
                              }
                              return 'Member';
                            })()}
                          </p>
                          <p className="break-all text-sm text-gray-500 dark:text-slate-400">
                            {(() => {
                              const user = member.user;
                              if (typeof user === 'object' && user !== null) {
                                return user.email || '';
                              }
                              return '';
                            })()}
                          </p>
                        </div>
                      </div>

                      <div className="flex w-full items-center gap-3 sm:w-auto sm:justify-end">
                        {isOrgAdmin ? (
                          <>
                            <Select
                              options={roleOptions}
                              value={member.role}
                              onChange={(value) => handleUpdateMemberRole(member.userId, value)}
                              loading={updatingRoleId === member.userId}
                              className="w-full sm:w-32"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              iconName="Trash2"
                              onClick={() => handleRemoveMember(member.userId)}
                              className="shrink-0 rounded-full text-rose-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                            />
                          </>
                        ) : (
                          <span className={`px-3 py-1.5 rounded-full text-xs font-medium ${getRoleBadgeColor(member.role)}`}>
                            {member.role}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              </motion.section>
            </div>
          </main>
        </div>
      </div>

      {removeMemberConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-white/30 dark:border-slate-700/50 bg-white dark:bg-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                <Icon name="UserMinus" size={18} className="text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100">Remove member?</h3>
                <p className="text-sm text-gray-500 dark:text-slate-400">This will revoke their access to the organization.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setRemoveMemberConfirm(null)}>
                Cancel
              </Button>
              <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white border-none" onClick={confirmRemoveMember}>
                Remove
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyTeamMembersPage;
