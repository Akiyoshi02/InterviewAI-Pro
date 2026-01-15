import React, { useEffect, useState } from 'react';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Icon from '../../../components/AppIcon';
import { useAuth } from '../../../contexts/AuthContext.jsx';
import apiClient from '../../../services/apiClient.js';
import { cn } from '../../../utils/cn.js';

const OrganizationAdminPanel = ({ className = '' }) => {
  const { organization, organizationRole } = useAuth();
  const isOrgAdmin = organizationRole === 'ADMIN';
  const [orgDetails, setOrgDetails] = useState({
    name: organization?.name || '',
    displayName: organization?.displayName || '',
    logoUrl: organization?.logoUrl || '',
    description: organization?.description || '',
  });
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

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
        const errorMsg = typeof result.error === 'string' ? result.error : (result.error?.message || 'Failed to update organization.');
        setStatusMessage(errorMsg);
      }
    } catch (err) {
      const errorMsg = err?.message || (typeof err === 'string' ? err : 'Failed to update organization.');
      setStatusMessage(errorMsg);
    } finally {
      setSaving(false);
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
            {typeof statusMessage === 'string' ? statusMessage : String(statusMessage)}
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
    </div>
  );
};

export default OrganizationAdminPanel;
