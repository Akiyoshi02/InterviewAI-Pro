import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Header from '../../components/ui/Header';
import UserContextNavigation from '../../components/ui/UserContextNavigation';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Icon from '../../components/AppIcon';
import { useAuth } from '../../contexts/AuthContext.jsx';
import apiClient from '../../services/apiClient.js';
import { useRealtimePathFeed } from '../../hooks/useRealtimePathFeed';
import { hasPermission } from '../../utils/rolePermissions';
import { Navigate } from 'react-router-dom';

const roleOptions = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'RECRUITER', label: 'Recruiter' },
  { value: 'REVIEWER', label: 'Reviewer' },
];

const CompanyTeamMembersPage = () => {
  const navigate = useNavigate();
  const { user, logout, organization, organizationRole } = useAuth();
  const isOrgAdmin = organizationRole === 'ADMIN';

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
  const [memberSearch, setMemberSearch] = useState('');
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
    } catch (err) {
      console.error('Failed to load members', err);
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
    } catch (err) {
      console.error('Failed to load invitations', err);
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

  const handleRemoveMember = async (userId) => {
    if (!organization?.id) return;
    if (!window.confirm('Are you sure you want to remove this member?')) return;
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
    }
  };

  const filteredMembers = useMemo(() => {
    const search = memberSearch.toLowerCase();
    return members.filter(
      (m) =>
        m.user?.fullName?.toLowerCase().includes(search) ||
        m.user?.email?.toLowerCase().includes(search),
    );
  }, [members, memberSearch]);

  // Filter to only show truly pending invitations (not accepted or rejected)
  const pendingInvitations = useMemo(() => {
    return teamInvitations.filter((inv) => inv.status === 'PENDING');
  }, [teamInvitations]);

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
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
                    <Icon name="Users2" size={22} color="white" />
                  </div>
                  <div>
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
                  className="rounded-full text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
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
                          {pendingInvitations.length} pending invitation{pendingInvitations.length !== 1 ? 's' : ''}
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
                    {loadingInvitations && (
                      <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-4">Loading invitations...</p>
                    )}
                    {!loadingInvitations && pendingInvitations.length === 0 && (
                      <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-4">
                        No pending invitations.
                      </p>
                    )}
                    {!loadingInvitations && pendingInvitations.length > 0 && (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {pendingInvitations.map((inv) => (
                          <div
                            key={inv.id}
                            className="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50"
                          >
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-gray-800 dark:text-slate-100">
                                {inv.email}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-slate-400">
                                Role: {inv.role} • Status: {inv.status}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
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
                      {members.length} member{members.length !== 1 ? 's' : ''} in your organization
                    </p>
                  </div>
                </div>

                {/* Member Search */}
                <div className="mb-4">
                  <Input
                    placeholder="Search members..."
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    iconName="Search"
                  />
                </div>

                {/* Members List */}
                <div className="space-y-3">
                  {loadingMembers && (
                    <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-8">Loading members...</p>
                  )}
                  {!loadingMembers && filteredMembers.length === 0 && (
                    <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-8">
                      {memberSearch ? 'No members found matching your search.' : 'No members found.'}
                    </p>
                  )}
                  {filteredMembers.map((member) => (
                    <div
                      key={member.userId}
                      className="flex items-center justify-between p-4 rounded-xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/70 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(15,23,42,0.1)] dark:hover:shadow-[0_10px_30px_rgba(0,0,0,0.3)] transition-all duration-200"
                    >
                      <div className="flex items-center space-x-4">
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
                          className="w-12 h-12 rounded-full object-cover"
                        />
                        <div>
                          <p className="font-medium text-gray-900 dark:text-slate-100">
                            {(() => {
                              const user = member.user;
                              if (typeof user === 'object' && user !== null) {
                                return user.fullName || user.email || 'Member';
                              }
                              return 'Member';
                            })()}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-slate-400">
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

                      <div className="flex items-center space-x-3">
                        {isOrgAdmin ? (
                          <>
                            <Select
                              options={roleOptions}
                              value={member.role}
                              onChange={(value) => handleUpdateMemberRole(member.userId, value)}
                              className="w-32"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              iconName="Trash2"
                              onClick={() => handleRemoveMember(member.userId)}
                              className="rounded-full text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
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
    </div>
  );
};

export default CompanyTeamMembersPage;
