import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import Icon from '../../../components/AppIcon';
import { useAuth } from '../../../contexts/AuthContext.jsx';
import apiClient from '../../../services/apiClient.js';
import { cn } from '../../../utils/cn.js';

const roleOptions = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'RECRUITER', label: 'Recruiter' },
  { value: 'REVIEWER', label: 'Reviewer' },
];

const OrganizationAdminPanel = ({ className = '' }) => {
  const { organization, organizationRole } = useAuth();
  const isOrgAdmin = organizationRole === 'ADMIN';
  const [orgDetails, setOrgDetails] = useState({
    name: organization?.name || '',
    displayName: organization?.displayName || '',
    logoUrl: organization?.logoUrl || '',
    description: organization?.description || '',
  });
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('REVIEWER');
  const [inviting, setInviting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [memberSearch, setMemberSearch] = useState('');

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

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  useEffect(() => {
    setOrgDetails({
      name: organization?.name || '',
      displayName: organization?.displayName || '',
      logoUrl: organization?.logoUrl || '',
      description: organization?.description || '',
    });
  }, [organization]);

  const handleUpdateOrg = async () => {
    if (!organization?.id) return;
    setSaving(true);
    setStatusMessage('');
    try {
      const result = await apiClient.organizations.updateMyOrganization(orgDetails);
      if (result.success) {
        setStatusMessage('Organization updated.');
      } else {
        setStatusMessage(result.error || 'Failed to update organization.');
      }
    } catch (err) {
      setStatusMessage(err.message || 'Failed to update organization.');
    } finally {
      setSaving(false);
    }
  };

  const handleInviteMember = async () => {
    if (!inviteEmail.trim() || !organization?.id) return;
    setInviting(true);
    setStatusMessage('');
    try {
      // First check if user exists by email
      const emailCheck = await apiClient.auth.checkEmailAvailability(inviteEmail.trim());
      if (!emailCheck.exists) {
        setStatusMessage('User with this email does not exist. They must register first.');
        setInviting(false);
        return;
      }
      
      // If user exists, we need their userId. For now, show a message that
      // direct invitation requires the user ID. In a full implementation,
      // you'd have an endpoint to get user by email or an invitation system.
      setStatusMessage('To add a member, their user ID is required. Please contact support or use the member management system.');
    } catch (err) {
      setStatusMessage(err.message || 'Failed to invite member.');
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!organization?.id) return;
    try {
      const result = await apiClient.organizations.removeMember(userId);
      if (result.success) {
        setMembers((prev) => prev.filter((m) => m.userId !== userId));
        setStatusMessage('Member removed.');
      }
    } catch (err) {
      setStatusMessage(err.message || 'Failed to remove member.');
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
      setStatusMessage(err.message || 'Failed to update role.');
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

  if (!organization) {
    return (
      <div className={cn("rounded-2xl border border-white/30 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-3 sm:p-4 shadow-[0_20px_60px_rgba(15,23,42,0.12)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur text-center", className)}>
        <div className="w-12 h-12 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-slate-800 dark:to-slate-900 border border-white/50 dark:border-slate-700/60 rounded-full flex items-center justify-center mx-auto mb-3">
          <Icon name="Building2" size={24} className="text-blue-600" />
        </div>
        <h3 className="font-medium text-gray-900 dark:text-slate-100 mb-2">No Organization</h3>
        <p className="text-sm text-gray-500 dark:text-slate-400">
          Create or join an organization to access this panel.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3 sm:space-y-4", className)}>
      {/* Organization Settings */}
      <div className="rounded-2xl border border-white/30 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-3 sm:p-4 shadow-[0_20px_60px_rgba(15,23,42,0.12)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur">
        <div className="flex items-center space-x-2.5 mb-3 sm:mb-4">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Icon name="Building2" size={16} color="white" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100">Organization Settings</h2>
            <p className="text-xs text-gray-500 dark:text-slate-400">Manage your company profile</p>
          </div>
        </div>

        {statusMessage && (
          <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs sm:text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
            {statusMessage}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <Input
            label="Organization Name"
            value={orgDetails.name}
            onChange={(e) => setOrgDetails((prev) => ({ ...prev, name: e.target.value }))}
            disabled={!isOrgAdmin}
          />
          <Input
            label="Display Name"
            value={orgDetails.displayName}
            onChange={(e) => setOrgDetails((prev) => ({ ...prev, displayName: e.target.value }))}
            disabled={!isOrgAdmin}
          />
          <Input
            label="Logo URL"
            value={orgDetails.logoUrl}
            onChange={(e) => setOrgDetails((prev) => ({ ...prev, logoUrl: e.target.value }))}
            disabled={!isOrgAdmin}
          />
          <Input
            label="Description"
            value={orgDetails.description}
            onChange={(e) => setOrgDetails((prev) => ({ ...prev, description: e.target.value }))}
            disabled={!isOrgAdmin}
          />
        </div>

        {isOrgAdmin && (
          <div className="mt-4 flex justify-end">
            <Button
              onClick={handleUpdateOrg}
              disabled={saving}
              className="rounded-full bg-gradient-to-r from-blue-600 to-purple-600 border-none text-white shadow-md shadow-blue-500/30 hover:from-blue-700 hover:to-purple-700"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        )}
      </div>

      {/* Team Members */}
      <div className="rounded-2xl border border-white/30 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-3 sm:p-4 shadow-[0_20px_60px_rgba(15,23,42,0.12)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur">
        <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2 mb-3 sm:mb-4">
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100">Team Members</h2>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              {members.length} member{members.length !== 1 ? 's' : ''} in your organization
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            iconName="RefreshCw"
            onClick={loadMembers}
            disabled={loadingMembers}
            className="rounded-full text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
          />
        </div>

        {/* Invite Member */}
        {isOrgAdmin && (
          <div className="mb-4 p-3 sm:p-4 rounded-xl border border-white/40 dark:border-slate-700/50 bg-white/70 dark:bg-slate-900/50">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <Input
                placeholder="Email address"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="flex-1"
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
          </div>
        )}

        {/* Member Search */}
        <div className="mb-3">
          <Input
            placeholder="Search members..."
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
            iconName="Search"
          />
        </div>

        {/* Members List */}
        <div className="space-y-2.5 max-h-[320px] overflow-y-auto">
          {loadingMembers && (
            <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-4">Loading members...</p>
          )}
          {!loadingMembers && filteredMembers.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-4">
              No members found.
            </p>
          )}
          {filteredMembers.map((member) => (
            <div
              key={member.userId}
              className="flex items-center justify-between p-3 rounded-xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/70 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(15,23,42,0.1)] dark:hover:shadow-[0_10px_30px_rgba(0,0,0,0.3)] transition-all duration-200"
            >
              <div className="flex items-center space-x-3">
                <img
                  src={
                    member.user?.photoURL ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(
                      member.user?.fullName || 'U',
                    )}&background=6366f1&color=fff`
                  }
                  alt={member.user?.fullName}
                  className="w-10 h-10 rounded-full object-cover"
                />
                <div>
                  <p className="font-medium text-gray-900 dark:text-slate-100">
                    {member.user?.fullName || member.user?.email}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">{member.user?.email}</p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {isOrgAdmin ? (
                  <>
                    <Select
                      options={roleOptions}
                      value={member.role}
                      onChange={(value) => handleUpdateMemberRole(member.userId, value)}
                      className="w-28"
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
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(member.role)}`}>
                    {member.role}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default OrganizationAdminPanel;
