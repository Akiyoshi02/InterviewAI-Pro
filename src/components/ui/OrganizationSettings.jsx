import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import Button from './Button';
import Input from './Input';
import Select from './Select';
import { Checkbox } from './Checkbox';
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

const interviewConflictScopeOptions = [
  { value: 'RECRUITER', label: 'Per Recruiter (recommended)' },
  { value: 'ORGANIZATION', label: 'Whole Organization' },
];

const workingDayOptions = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];

const DEFAULT_INTERVIEW_AUTOMATION_SETTINGS = Object.freeze({
  autoScheduleOnInterviewing: true,
  timezone: 'UTC',
  leadHours: 24,
  slotMinutes: 30,
  durationMinutes: 30,
  bufferMinutes: 15,
  scheduleWindowDays: 14,
  maxInterviewsPerDay: 8,
  businessHoursStart: '09:00',
  businessHoursEnd: '17:00',
  conflictScope: 'RECRUITER',
  workingDays: [1, 2, 3, 4, 5],
});

const normalizeWorkingDays = (rawWorkingDays) => {
  const fallback = DEFAULT_INTERVIEW_AUTOMATION_SETTINGS.workingDays;
  if (!Array.isArray(rawWorkingDays) || rawWorkingDays.length === 0) {
    return [...fallback];
  }

  const normalized = rawWorkingDays
    .map((day) => Number.parseInt(day, 10))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
  return normalized.length > 0 ? [...new Set(normalized)].sort((a, b) => a - b) : [...fallback];
};

const parseNumericAutomationField = (value, fallback, minimum, maximum) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
};

const normalizeTimeField = (value, fallback) => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return /^\d{2}:\d{2}$/.test(trimmed) ? trimmed : fallback;
};

const normalizeInterviewAutomationSettings = (rawSettings = null) => {
  const source = rawSettings && typeof rawSettings === 'object' ? rawSettings : {};
  const timezone = typeof source.timezone === 'string' && source.timezone.trim()
    ? source.timezone.trim()
    : DEFAULT_INTERVIEW_AUTOMATION_SETTINGS.timezone;

  return {
    autoScheduleOnInterviewing: source.autoScheduleOnInterviewing !== false,
    timezone,
    leadHours: parseNumericAutomationField(source.leadHours, DEFAULT_INTERVIEW_AUTOMATION_SETTINGS.leadHours, 1, 72),
    slotMinutes: parseNumericAutomationField(source.slotMinutes, DEFAULT_INTERVIEW_AUTOMATION_SETTINGS.slotMinutes, 15, 180),
    durationMinutes: parseNumericAutomationField(source.durationMinutes, DEFAULT_INTERVIEW_AUTOMATION_SETTINGS.durationMinutes, 15, 180),
    bufferMinutes: parseNumericAutomationField(source.bufferMinutes, DEFAULT_INTERVIEW_AUTOMATION_SETTINGS.bufferMinutes, 0, 180),
    scheduleWindowDays: parseNumericAutomationField(source.scheduleWindowDays, DEFAULT_INTERVIEW_AUTOMATION_SETTINGS.scheduleWindowDays, 1, 90),
    maxInterviewsPerDay: parseNumericAutomationField(source.maxInterviewsPerDay, DEFAULT_INTERVIEW_AUTOMATION_SETTINGS.maxInterviewsPerDay, 1, 40),
    businessHoursStart: normalizeTimeField(source.businessHoursStart, DEFAULT_INTERVIEW_AUTOMATION_SETTINGS.businessHoursStart),
    businessHoursEnd: normalizeTimeField(source.businessHoursEnd, DEFAULT_INTERVIEW_AUTOMATION_SETTINGS.businessHoursEnd),
    conflictScope: source.conflictScope === 'ORGANIZATION' ? 'ORGANIZATION' : 'RECRUITER',
    workingDays: normalizeWorkingDays(source.workingDays),
  };
};

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
  const [interviewAutomation, setInterviewAutomation] = useState(
    () => normalizeInterviewAutomationSettings(organization?.settings?.interviewAutomation),
  );
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

  useEffect(() => {
    setInterviewAutomation(
      normalizeInterviewAutomationSettings(organization?.settings?.interviewAutomation),
    );
  }, [organization]);

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

  const updateInterviewAutomationField = (field, value) => {
    setInterviewAutomation((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const toggleWorkingDay = (day) => {
    setInterviewAutomation((previous) => {
      const exists = previous.workingDays.includes(day);
      const nextDays = exists
        ? previous.workingDays.filter((entry) => entry !== day)
        : [...previous.workingDays, day];
      return {
        ...previous,
        workingDays: normalizeWorkingDays(nextDays),
      };
    });
  };

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
      const mergedSettings = {
        ...(organization?.settings && typeof organization.settings === 'object'
          ? organization.settings
          : {}),
        interviewAutomation: normalizeInterviewAutomationSettings(interviewAutomation),
      };
      const result = await apiClient.organizations.updateMyOrganization({
        ...orgDetails,
        settings: mergedSettings,
      });
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
  }, [isOrgAdmin, logoFile, orgDetails, organization?.id, refresh, interviewAutomation]);

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
    <div className={`grid gap-4 lg:grid-cols-3 lg:items-start ${className}`}>
      <div className="lg:col-span-2 space-y-4">
        {/* Organization Settings Card */}
        <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-900/60 p-4 sm:p-5 space-y-4">
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

        <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-900/60 p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center">
              <Icon name="CalendarClock" size={18} className="text-purple-600 dark:text-purple-300" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Interview Automation</h3>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                Configure how auto-scheduling finds conflict-free interview slots.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/40 p-3 sm:p-4 space-y-4">
            <Checkbox
              checked={Boolean(interviewAutomation.autoScheduleOnInterviewing)}
              onChange={(event) => updateInterviewAutomationField('autoScheduleOnInterviewing', event.target.checked)}
              disabled={!isOrgAdmin}
              label="Auto-schedule immediately when a candidate is moved to Interviewing."
              size="default"
            />

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              <Input
                label="Timezone"
                value={interviewAutomation.timezone}
                onChange={(event) => updateInterviewAutomationField('timezone', event.target.value)}
                disabled={!isOrgAdmin}
                placeholder="Asia/Colombo"
              />
              <Input
                label="Notice (hours)"
                type="number"
                min={1}
                max={72}
                value={interviewAutomation.leadHours}
                onChange={(event) => updateInterviewAutomationField('leadHours', event.target.value)}
                disabled={!isOrgAdmin}
              />
              <Input
                label="Slot interval (min)"
                type="number"
                min={15}
                max={180}
                value={interviewAutomation.slotMinutes}
                onChange={(event) => updateInterviewAutomationField('slotMinutes', event.target.value)}
                disabled={!isOrgAdmin}
              />
              <Input
                label="Duration (min)"
                type="number"
                min={15}
                max={180}
                value={interviewAutomation.durationMinutes}
                onChange={(event) => updateInterviewAutomationField('durationMinutes', event.target.value)}
                disabled={!isOrgAdmin}
              />
              <Input
                label="Buffer (min)"
                type="number"
                min={0}
                max={180}
                value={interviewAutomation.bufferMinutes}
                onChange={(event) => updateInterviewAutomationField('bufferMinutes', event.target.value)}
                disabled={!isOrgAdmin}
              />
              <Input
                label="Window (days)"
                type="number"
                min={1}
                max={90}
                value={interviewAutomation.scheduleWindowDays}
                onChange={(event) => updateInterviewAutomationField('scheduleWindowDays', event.target.value)}
                disabled={!isOrgAdmin}
              />
              <Input
                label="Max interviews/day"
                type="number"
                min={1}
                max={40}
                value={interviewAutomation.maxInterviewsPerDay}
                onChange={(event) => updateInterviewAutomationField('maxInterviewsPerDay', event.target.value)}
                disabled={!isOrgAdmin}
              />
              <Input
                label="Business start"
                type="time"
                value={interviewAutomation.businessHoursStart}
                onChange={(event) => updateInterviewAutomationField('businessHoursStart', event.target.value)}
                disabled={!isOrgAdmin}
              />
              <Input
                label="Business end"
                type="time"
                value={interviewAutomation.businessHoursEnd}
                onChange={(event) => updateInterviewAutomationField('businessHoursEnd', event.target.value)}
                disabled={!isOrgAdmin}
              />
            </div>

            <Select
              label="Conflict scope"
              options={interviewConflictScopeOptions}
              value={interviewAutomation.conflictScope}
              onChange={(value) => updateInterviewAutomationField('conflictScope', value)}
              disabled={!isOrgAdmin}
            />

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400 mb-2">
                Working days
              </p>
              <div className="grid grid-cols-7 gap-2 w-full">
                {workingDayOptions.map((day) => {
                  const isActive = interviewAutomation.workingDays.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleWorkingDay(day.value)}
                      disabled={!isOrgAdmin}
                      className={`w-full py-2 rounded-lg text-xs font-medium border transition-colors ${
                        isActive
                          ? 'bg-purple-100 border-purple-300 text-purple-700 dark:bg-purple-600/20 dark:border-purple-500/40 dark:text-purple-200'
                          : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300'
                      } ${!isOrgAdmin ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right sidebar - Company Logo Upload */}
      <div className="space-y-4">
        {isOrgAdmin && (
          <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-900/60 p-4 sm:p-5 space-y-4 flex flex-col">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                <Icon name="Image" size={18} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Company Logo</h3>
                <p className="text-sm text-gray-500 dark:text-slate-400">Keep your organization logo fresh.</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
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
