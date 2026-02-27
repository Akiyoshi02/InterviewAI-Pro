import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import Button from './Button';
import Input from './Input';
import Select from './Select';
import Icon from '../AppIcon';
import PhoneInput from './PhoneInput';
import { useAuth } from '../../contexts/AuthContext.jsx';
import apiClient from '../../services/apiClient.js';

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

  const uploadDirs = ['profile-photos/', 'company-logos/', 'company-verifications/', 'resumes/'];
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

const StatusMessage = ({ status }) => {
  if (!status?.message) return null;
  const colorClass = status.type === 'success'
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-rose-500 dark:text-rose-400';
  return <p className={`text-xs ${colorClass}`}>{status.message}</p>;
};

const companySizeOptions = [
  { value: '1-10', label: '1-10 employees' },
  { value: '11-50', label: '11-50 employees' },
  { value: '51-200', label: '51-200 employees' },
  { value: '201-1000', label: '201-1000 employees' },
  { value: '1000+', label: '1000+ employees' },
];

const companyTypeOptions = [
  { value: 'private-limited', label: 'Private Limited Company (Pvt Ltd)' },
  { value: 'public-limited', label: 'Public Limited Company (PLC)' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'sole-proprietorship', label: 'Sole Proprietorship' },
  { value: 'startup', label: 'Startup' },
  { value: 'ngo', label: 'NGO / Non-Profit Organization' },
  { value: 'government', label: 'Government / Semi-Government' },
  { value: 'multinational', label: 'Multinational Corporation (MNC)' },
];

const OrganizationSettings = ({
  className = '',
  hideSaveActions = false,
  onRegisterSaveHandler = null,
  onSavingStateChange = null,
}) => {
  const { organization, organizationRole, user, setAuthenticatedUser, refresh } = useAuth();
  const isOrgAdmin = organizationRole === 'ADMIN';
  const fileInputRef = useRef(null);
  const [orgDetails, setOrgDetails] = useState({
    name: organization?.name || '',
    displayName: organization?.displayName || '',
    tagline: organization?.tagline || organization?.profile?.tagline || '',
    industry: organization?.industry || '',
    companyType: organization?.companyType || '',
    companySize: organization?.companySize || '',
    website: organization?.website || organization?.profile?.website || '',
    location: organization?.location || organization?.profile?.location || '',
    headquartersLocation: organization?.headquartersLocation || organization?.location || organization?.profile?.location || '',
    contactEmail: organization?.contactEmail || user?.email || '',
    contactPhone: organization?.contactPhone || '',
    careersPageUrl: organization?.careersPageUrl || '',
    linkedinUrl: organization?.linkedinUrl || '',
  });
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [logoSourceIndex, setLogoSourceIndex] = useState(0);
  const [logoSourceFailed, setLogoSourceFailed] = useState(false);
  const [isSavingLogo, setIsSavingLogo] = useState(false);
  const [logoStatus, setLogoStatus] = useState(null);

  useEffect(() => {
    setOrgDetails({
      name: organization?.name || '',
      displayName: organization?.displayName || '',
      tagline: organization?.tagline || organization?.profile?.tagline || '',
      industry: organization?.industry || '',
      companyType: organization?.companyType || '',
      companySize: organization?.companySize || '',
      website: organization?.website || organization?.profile?.website || '',
      location: organization?.location || organization?.profile?.location || '',
      headquartersLocation: organization?.headquartersLocation || organization?.location || organization?.profile?.location || '',
      contactEmail: organization?.contactEmail || user?.email || '',
      contactPhone: organization?.contactPhone || '',
      careersPageUrl: organization?.careersPageUrl || '',
      linkedinUrl: organization?.linkedinUrl || '',
    });
  }, [organization, user?.email]);

  const storedUser = useMemo(() => {
    if (typeof window === 'undefined') return null;
    try {
      return JSON.parse(window.localStorage.getItem('user') || 'null');
    } catch {
      return null;
    }
  }, [user]);

  const logoUrl = organization?.logo
    || user?.companyLogoUrl
    || user?.organizationContext?.organization?.branding?.logoUrl
    || storedUser?.companyLogoUrl
    || storedUser?.organizationContext?.organization?.branding?.logoUrl;

  const logoSources = useMemo(
    () => buildAssetSources(logoUrl),
    [logoUrl]
  );

  useEffect(() => {
    setLogoSourceIndex(0);
    setLogoSourceFailed(false);
  }, [logoSources]);

  useEffect(() => {
    if (!logoFile) {
      setLogoPreview('');
      return undefined;
    }
    const url = URL.createObjectURL(logoFile);
    setLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  const fallbackLogoSource = logoSourceFailed
    ? ''
    : (logoSources[logoSourceIndex] || '');
  const logoSource = logoPreview || fallbackLogoSource;

  const handleLogoFileChange = (event) => {
    const file = event?.target?.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    const maxBytes = 5 * 1024 * 1024;

    setLogoStatus(null);

    if (!allowedTypes.includes(file.type)) {
      setLogoStatus({ type: 'error', message: 'Unsupported image type. Please upload PNG, JPG, WEBP, or SVG.' });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    if (file.size > maxBytes) {
      setLogoStatus({ type: 'error', message: 'Image must be 5 MB or less.' });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setLogoFile(file);
  };

  const handleSaveLogo = async ({ showStatus = true } = {}) => {
    if (!logoFile) return true;
    if (showStatus) {
      setLogoStatus(null);
    }
    setIsSavingLogo(true);
    let success = false;
    try {
      const response = await apiClient.auth.updateCompanyLogo(logoFile);
      if (!response?.success || !response?.user) {
        throw new Error('Unable to update the logo. Please try again.');
      }
      setAuthenticatedUser(response.user);
      setLogoFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      if (showStatus) {
        setLogoStatus({
          type: 'success',
          message: 'Company logo updated.',
        });
      }
      success = true;
    } catch (error) {
      if (showStatus) {
        setLogoStatus({
          type: 'error',
          message: error?.message || 'Failed to update logo.',
        });
      }
    } finally {
      setIsSavingLogo(false);
    }
    return success;
  };

  const handleLogoError = () => {
    if (logoPreview) return;
    if (logoSourceIndex < logoSources.length - 1) {
      setLogoSourceIndex((prev) => prev + 1);
      return;
    }
    setLogoSourceFailed(true);
  };

  const handleUpdateOrg = async ({ showStatus = true } = {}) => {
    if (!organization?.id || !isOrgAdmin) return true;
    setSaving(true);
    if (showStatus) {
      setStatusMessage('');
    }
    let success = false;
    try {
      const result = await apiClient.organizations.updateMyOrganization(orgDetails);
      if (result.success) {
        if (showStatus) {
          setStatusMessage('Organization updated.');
        }
        if (typeof refresh === 'function') {
          await refresh();
        }
        if (showStatus) {
          // Clear success message after 3 seconds
          setTimeout(() => setStatusMessage(''), 3000);
        }
        success = true;
      } else {
        const errorMsg = typeof result.error === 'string' ? result.error : (result.error?.message || 'Failed to update organization.');
        if (showStatus) {
          setStatusMessage(errorMsg);
        }
      }
    } catch (err) {
      const errorMsg = err?.message || (typeof err === 'string' ? err : 'Failed to update organization.');
      if (showStatus) {
        setStatusMessage(errorMsg);
      }
    } finally {
      setSaving(false);
    }
    return success;
  };

  const handleSaveAllOrganization = useCallback(async ({ showStatus = true } = {}) => {
    if (!isOrgAdmin) return true;

    const results = [];
    const orgSaved = await handleUpdateOrg({ showStatus });
    results.push(Boolean(orgSaved));

    if (logoFile) {
      const logoSaved = await handleSaveLogo({ showStatus });
      results.push(Boolean(logoSaved));
    }

    return results.every(Boolean);
  }, [isOrgAdmin, logoFile, orgDetails, organization?.id, refresh]);

  useEffect(() => {
    if (typeof onRegisterSaveHandler !== 'function') return undefined;
    onRegisterSaveHandler(handleSaveAllOrganization);
    return () => onRegisterSaveHandler(null);
  }, [handleSaveAllOrganization, onRegisterSaveHandler]);

  useEffect(() => {
    if (typeof onSavingStateChange !== 'function') return;
    onSavingStateChange(Boolean(saving || isSavingLogo));
  }, [onSavingStateChange, saving, isSavingLogo]);

  if (!organization) {
    return (
      <div className={`rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-900/60 p-4 sm:p-5 text-center ${className}`}>
        <div className="w-12 h-12 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-slate-800 dark:to-slate-900 border border-white/50 dark:border-slate-700/60 rounded-full flex items-center justify-center mx-auto mb-3">
          <Icon name="Building2" size={24} className="text-blue-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-2">No Organization</h3>
        <p className="text-sm text-gray-500 dark:text-slate-400">
          Create or join an organization to access this panel.
        </p>
      </div>
    );
  }

  return (
    <div className={`grid gap-4 lg:grid-cols-3 lg:items-stretch ${className}`}>
      <div className="lg:col-span-2 space-y-4">
        {/* Organization Settings Card */}
        <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-900/60 p-4 sm:p-5 space-y-4 h-full flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                <Icon name="Building2" size={18} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Organization Details</h3>
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  Manage your organization&apos;s profile information
                </p>
              </div>
            </div>
            {isOrgAdmin && !hideSaveActions && (
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => handleUpdateOrg({ showStatus: true })}
                disabled={saving}
                className="rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            )}
          </div>

          {statusMessage && (
            <div className={`rounded-xl border px-3 py-2 text-xs sm:text-sm ${
              statusMessage.includes('updated') || statusMessage.includes('success')
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200'
                : 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200'
            }`}>
              {typeof statusMessage === 'string' ? statusMessage : String(statusMessage)}
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2 flex-1">
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
              label="Tagline"
              placeholder="Short phrase candidates will see"
              value={orgDetails.tagline}
              onChange={(e) => setOrgDetails((prev) => ({ ...prev, tagline: e.target.value }))}
              disabled={!isOrgAdmin}
              className="md:col-span-2"
            />
            <Input
              label="Industry"
              value={orgDetails.industry}
              onChange={(e) => setOrgDetails((prev) => ({ ...prev, industry: e.target.value }))}
              disabled={!isOrgAdmin}
            />
            <Select
              label="Company Type"
              options={companyTypeOptions}
              value={orgDetails.companyType}
              onChange={(value) => setOrgDetails((prev) => ({ ...prev, companyType: value }))}
              placeholder="Select company type"
              disabled={!isOrgAdmin}
            />
            <Select
              label="Company Size"
              options={companySizeOptions}
              value={orgDetails.companySize}
              onChange={(value) => setOrgDetails((prev) => ({ ...prev, companySize: value }))}
              placeholder="Select company size"
              disabled={!isOrgAdmin}
            />
            <Input
              label="Company Website"
              type="url"
              placeholder="https://www.yourcompany.com"
              value={orgDetails.website}
              onChange={(e) => setOrgDetails((prev) => ({ ...prev, website: e.target.value }))}
              disabled={!isOrgAdmin}
              className="md:col-span-2"
            />
            <Input
              label="Headquarters location"
              placeholder="e.g. Colombo, Sri Lanka"
              value={orgDetails.location}
              onChange={(e) => {
                const nextValue = e.target.value;
                setOrgDetails((prev) => ({
                  ...prev,
                  location: nextValue,
                  headquartersLocation: nextValue,
                }));
              }}
              disabled={!isOrgAdmin}
            />
            <Input
              label="Primary contact email"
              type="email"
              placeholder="talent@yourcompany.com"
              value={orgDetails.contactEmail}
              onChange={(e) => setOrgDetails((prev) => ({ ...prev, contactEmail: e.target.value }))}
              disabled={!isOrgAdmin}
            />
            <PhoneInput
              label="Primary contact phone"
              value={orgDetails.contactPhone}
              onChange={(value) => setOrgDetails((prev) => ({ ...prev, contactPhone: value }))}
              disabled={!isOrgAdmin}
            />
            <Input
              label="Careers page URL"
              type="url"
              placeholder="https://www.yourcompany.com/careers"
              value={orgDetails.careersPageUrl}
              onChange={(e) => setOrgDetails((prev) => ({ ...prev, careersPageUrl: e.target.value }))}
              disabled={!isOrgAdmin}
            />
            <Input
              label="LinkedIn company URL"
              type="url"
              placeholder="https://www.linkedin.com/company/yourcompany"
              value={orgDetails.linkedinUrl}
              onChange={(e) => setOrgDetails((prev) => ({ ...prev, linkedinUrl: e.target.value }))}
              disabled={!isOrgAdmin}
            />
          </div>
        </div>
      </div>

      {/* Right sidebar - Company Logo Upload */}
      <div className="space-y-4">
        {isOrgAdmin && (
          <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-900/60 p-4 sm:p-5 space-y-4 h-full flex flex-col">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                <Icon name="Image" size={18} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Company Logo</h3>
                <p className="text-sm text-gray-500 dark:text-slate-400">Keep your organization logo fresh.</p>
              </div>
            </div>

            <div className="flex items-center gap-4 flex-1">
              <div className="relative rounded-full border border-white/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/80 flex items-center justify-center overflow-visible w-24 h-24 flex-shrink-0">
                {logoSource ? (
                  <>
                    <div className="w-full h-full rounded-full overflow-hidden">
                      <img
                        src={logoSource}
                        alt="Company logo"
                        className="w-full h-full object-contain"
                        onError={handleLogoError}
                      />
                    </div>
                    {logoFile && (
                      <button
                        type="button"
                        onClick={() => {
                          setLogoFile(null);
                          setLogoStatus(null);
                          if (fileInputRef.current) {
                            fileInputRef.current.value = '';
                          }
                        }}
                        className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg transition-colors z-10 border-2 border-white dark:border-slate-800"
                        aria-label="Cancel upload"
                      >
                        <Icon name="X" size={12} color="white" />
                      </button>
                    )}
                  </>
                ) : (
                  <Icon name="Building2" size={28} className="text-blue-600 dark:text-blue-400" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                  {logoFile?.name || (logoSource ? 'Current logo' : 'No logo uploaded')}
                </p>
                <p className="text-xs text-gray-500 dark:text-slate-400">SVG, PNG, JPG, or WEBP. Max 5 MB.</p>
                <StatusMessage status={logoStatus} />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 justify-center mt-auto">
              <Button
                type="button"
                variant="default"
                size="sm"
                iconName="Upload"
                className="rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                onClick={() => fileInputRef.current?.click()}
              >
                Choose file
              </Button>
              {logoFile && !hideSaveActions && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => handleSaveLogo({ showStatus: true })}
                  disabled={isSavingLogo}
                >
                  {isSavingLogo ? 'Saving...' : 'Save logo'}
                </Button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.svg"
              onChange={handleLogoFileChange}
              className="hidden"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default OrganizationSettings;
