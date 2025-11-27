import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
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
    industry: organization?.industry || '',
    companySize: organization?.companySize || '',
  });
  const [members, setMembers] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [memberForm, setMemberForm] = useState({ userId: '', role: 'RECRUITER' });
  const [memberError, setMemberError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const canManageMembers = useMemo(() => ['ADMIN'].includes(organizationRole), [organizationRole]);
  const canViewPanel = Boolean(organization);

  const loadData = useCallback(async () => {
    if (!canViewPanel) return;
    setLoading(true);
    setStatusMessage('');

    try {
      const [orgRes, memberRes, activityRes] = await Promise.allSettled([
        apiClient.organizations.getMyOrganization(),
        apiClient.organizations.listMembers(),
        apiClient.activity.list(30),
      ]);

      if (orgRes.status === 'fulfilled' && orgRes.value.success) {
        setOrgDetails((prev) => ({
          ...prev,
          ...orgRes.value.organization,
        }));
      }

      if (memberRes.status === 'fulfilled' && memberRes.value.success) {
        setMembers(memberRes.value.members || []);
      }

      if (activityRes.status === 'fulfilled' && activityRes.value.success) {
        setActivity(activityRes.value.activity || []);
      }
    } catch (error) {
      setStatusMessage(error.message || 'Failed to load organization data.');
    } finally {
      setLoading(false);
    }
  }, [canViewPanel]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOrgFieldChange = (field, value) => {
    setOrgDetails((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSaveSettings = async (event) => {
    event.preventDefault();
    if (!isOrgAdmin) return;

    setSavingSettings(true);
    setStatusMessage('');
    try {
      const payload = {
        name: orgDetails.name,
        displayName: orgDetails.displayName,
        industry: orgDetails.industry,
        companySize: orgDetails.companySize,
      };
      const result = await apiClient.organizations.updateMyOrganization(payload);
      if (result.success) {
        setStatusMessage('Organization settings saved.');
      }
    } catch (error) {
      setStatusMessage(error.message || 'Failed to save settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleMemberSubmit = async (event) => {
    event.preventDefault();
    setMemberError('');
    if (!memberForm.userId) {
      setMemberError('User ID is required.');
      return;
    }

    setAddingMember(true);
    try {
      const result = await apiClient.organizations.addMember({
        userId: memberForm.userId.trim(),
        role: memberForm.role,
      });

      if (result.success) {
        setMembers((prev) => [result.member, ...prev]);
        setMemberForm({ userId: '', role: 'RECRUITER' });
      } else {
        setMemberError(result.error || 'Failed to add member.');
      }
    } catch (error) {
      setMemberError(error.message || 'Failed to add member.');
    } finally {
      setAddingMember(false);
    }
  };

  if (!canViewPanel) {
    return null;
  }

  return (
    <section
      className={cn(
        'rounded-3xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-6 shadow-[0_25px_70px_rgba(15,23,42,0.12)] dark:shadow-[0_25px_70px_rgba(0,0,0,0.4)] backdrop-blur',
        className,
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-blue-600 dark:text-blue-400">
            Organization Controls
          </p>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-slate-100">Admin Console</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Manage org profile, team access, and compliance logs in one place.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          Refresh
        </Button>
      </div>

      {statusMessage && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200">
          {statusMessage}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <form
            onSubmit={handleSaveSettings}
            className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-900/60 p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Organization Settings</h3>
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  Update branding and compliance metadata shown to teams.
                </p>
              </div>
              {!isOrgAdmin && (
                <span className="text-xs uppercase tracking-widest text-gray-400">Read-only</span>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Organization Name"
                value={orgDetails.name}
                disabled={!isOrgAdmin}
                onChange={(e) => handleOrgFieldChange('name', e.target.value)}
              />
              <Input
                label="Display Name"
                value={orgDetails.displayName}
                disabled={!isOrgAdmin}
                onChange={(e) => handleOrgFieldChange('displayName', e.target.value)}
              />
              <Input
                label="Industry"
                value={orgDetails.industry}
                disabled={!isOrgAdmin}
                onChange={(e) => handleOrgFieldChange('industry', e.target.value)}
              />
              <Input
                label="Company Size"
                placeholder="e.g. 51-200"
                value={orgDetails.companySize}
                disabled={!isOrgAdmin}
                onChange={(e) => handleOrgFieldChange('companySize', e.target.value)}
              />
            </div>

            {isOrgAdmin && (
              <div className="flex justify-end">
                <Button type="submit" disabled={savingSettings}>
                  {savingSettings ? 'Saving...' : 'Save Settings'}
                </Button>
              </div>
            )}
          </form>

          <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-900/60 p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Team Members</h3>
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  Provision recruiters and reviewers with the right permissions.
                </p>
              </div>
              {canManageMembers && (
                <form className="flex flex-col sm:flex-row gap-3" onSubmit={handleMemberSubmit}>
                  <Input
                    label="User ID"
                    placeholder="auth UID"
                    value={memberForm.userId}
                    onChange={(e) => setMemberForm((prev) => ({ ...prev, userId: e.target.value }))}
                  />
                  <Select
                    label="Role"
                    options={roleOptions}
                    value={memberForm.role}
                    onChange={(value) => setMemberForm((prev) => ({ ...prev, role: value }))}
                  />
                  <div className="flex items-end">
                    <Button type="submit" disabled={addingMember}>
                      {addingMember ? 'Adding...' : 'Add'}
                    </Button>
                  </div>
                </form>
              )}
            </div>

            {memberError && <p className="text-sm text-red-500">{memberError}</p>}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-slate-400 uppercase tracking-wide text-xs">
                    <th className="pb-2">Name</th>
                    <th className="pb-2">Email</th>
                    <th className="pb-2">Role</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.id} className="border-t border-white/30 dark:border-slate-700/50">
                      <td className="py-3">
                        <p className="font-medium text-gray-900 dark:text-slate-100">
                          {member.user?.fullName || member.user?.email || 'User'}
                        </p>
                      </td>
                      <td className="py-3 text-gray-500 dark:text-slate-400">{member.user?.email || '—'}</td>
                      <td className="py-3">
                        <span className="inline-flex items-center rounded-full border border-blue-100 dark:border-blue-500/40 bg-blue-50/70 dark:bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-700 dark:text-blue-200">
                          {member.role}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className={cn(
                          'text-xs font-medium',
                          member.status === 'ACTIVE' ? 'text-emerald-600' : 'text-amber-500',
                        )}
                        >
                          {member.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!members.length && (
                    <tr>
                      <td className="py-4 text-sm text-gray-500 dark:text-slate-400" colSpan={4}>
                        {loading ? 'Loading members...' : 'No members yet.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-900/60 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Audit trail</h3>
              <p className="text-sm text-gray-500 dark:text-slate-400">Latest 30 org events</p>
            </div>
          </div>

          <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
            {activity.map((entry) => (
              <div
                key={entry.id}
                className="rounded-xl border border-white/30 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/70 p-3"
              >
                <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                  {entry.action.replace('_', ' ')}
                </p>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  {entry.actor?.fullName || entry.actor?.email || 'System'} •{' '}
                  {new Date(entry.createdAt).toLocaleString()}
                </p>
                {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                  <pre className="mt-2 text-xs text-gray-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 rounded-lg p-2 overflow-x-auto">
                    {JSON.stringify(entry.metadata, null, 2)}
                  </pre>
                )}
              </div>
            ))}
            {!activity.length && (
              <p className="text-sm text-gray-500 dark:text-slate-400">
                {loading ? 'Loading activity...' : 'No recent activity recorded.'}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default OrganizationAdminPanel;

