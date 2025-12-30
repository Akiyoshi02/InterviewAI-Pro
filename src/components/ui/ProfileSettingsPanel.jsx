import React, { useEffect, useMemo, useRef, useState } from 'react';
import Button from './Button';
import Input from './Input';
import Select from './Select';
import Icon from '../AppIcon';
import apiClient from '../../services/apiClient.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { formatCandidateFieldValue } from '../../utils/profileDisplay.js';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const FIREBASE_STORAGE_BUCKET = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '';

const experienceOptions = [
  { value: 'entry', label: 'Entry Level (0-2 years)' },
  { value: 'mid', label: 'Mid Level (3-5 years)' },
  { value: 'senior', label: 'Senior Level (6-10 years)' },
  { value: 'lead', label: 'Lead/Principal (10+ years)' },
  { value: 'executive', label: 'Executive/C-Level' },
];

const languageOptions = [
  { value: 'english', label: 'English' },
  { value: 'spanish', label: 'Spanish' },
  { value: 'french', label: 'French' },
];

const companySizeOptions = [
  { value: '1-10', label: '1-10 employees' },
  { value: '11-50', label: '11-50 employees' },
  { value: '51-200', label: '51-200 employees' },
  { value: '201-1000', label: '201-1000 employees' },
  { value: '1000+', label: '1000+ employees' },
];

const departmentOptions = [
  { value: 'hr', label: 'Human Resources' },
  { value: 'engineering', label: 'Engineering' },
  { value: 'sales', label: 'Sales & Marketing' },
  { value: 'operations', label: 'Operations' },
  { value: 'finance', label: 'Finance' },
  { value: 'executive', label: 'Executive' },
  { value: 'other', label: 'Other' },
];

const candidatePreferencesDefaults = {
  notificationCadence: 'weekly',
  practiceReminders: true,
  sessionSummaries: true,
  aiInsights: true,
};

const companyPreferencesDefaults = {
  notificationCadence: 'daily',
  candidateAlerts: true,
  reviewerReminders: true,
  reportDigest: true,
};

const candidatePreferenceToggles = [
  {
    key: 'practiceReminders',
    label: 'Practice reminders',
    description: 'Stay consistent with weekly nudges for interview prep.',
  },
  {
    key: 'sessionSummaries',
    label: 'Session summaries',
    description: 'Receive a recap after each practice interview.',
  },
  {
    key: 'aiInsights',
    label: 'AI insight highlights',
    description: 'Get weekly coaching insights based on your activity.',
  },
];

const companyPreferenceToggles = [
  {
    key: 'candidateAlerts',
    label: 'Candidate activity alerts',
    description: 'Notify the team when candidates finish interviews.',
  },
  {
    key: 'reviewerReminders',
    label: 'Reviewer reminders',
    description: 'Send follow-ups when evaluations are pending.',
  },
  {
    key: 'reportDigest',
    label: 'Hiring report digest',
    description: 'Weekly summary of pipeline health and outcomes.',
  },
];

const notificationCadenceOptions = {
  candidate: [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'off', label: 'Off' },
  ],
  company: [
    { value: 'instant', label: 'Instant' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
  ],
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

const StatusMessage = ({ status }) => {
  if (!status?.message) return null;
  const colorClass = status.type === 'success'
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-rose-500 dark:text-rose-400';
  return <p className={`text-xs ${colorClass}`}>{status.message}</p>;
};

const PreferenceToggle = ({ id, label, description, checked, onChange, density = 'comfortable' }) => {
  const isCompact = density === 'compact';

  return (
  <label
    htmlFor={id}
    className={`flex items-start rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-900/50 transition-colors hover:border-blue-200 dark:hover:border-blue-600 ${
      isCompact ? 'gap-2 p-2' : 'gap-3 p-3'
    }`}
  >
    <Input
      id={id}
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      className="mt-1"
    />
    <div>
      <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{label}</p>
      <p className="text-xs text-gray-500 dark:text-slate-400">{description}</p>
    </div>
  </label>
  );
};

const buildProfileDefaults = (user, isCompany) => ({
  fullName: user?.fullName || '',
  email: user?.email || '',
  targetRole: isCompany
    ? user?.targetRole || ''
    : formatCandidateFieldValue('targetRole', user?.targetRole || ''),
  experienceLevel: user?.experienceLevel || '',
  location: user?.location || '',
  preferredLanguage: user?.preferredLanguage || (isCompany ? '' : 'english'),
  industry: isCompany
    ? user?.industry || ''
    : formatCandidateFieldValue('industry', user?.industry || ''),
  companyName: user?.companyName || '',
  companySize: user?.companySize || '',
  jobTitle: user?.jobTitle || '',
  department: user?.department || '',
  companyWebsite: user?.companyWebsite || '',
  companyLocation: user?.companyLocation || '',
  phoneNumber: user?.phoneNumber || '',
});

const ProfileSettingsPanel = ({
  userType = 'candidate',
  className = '',
  sectionId = 'profile-settings',
  variant = 'card',
  headerAction = null,
  density = 'comfortable',
}) => {
  const { user, setAuthenticatedUser } = useAuth();
  const isCompany = userType === 'company';
  const fileInputRef = useRef(null);
  const isCompact = density === 'compact';

  const headerMargin = isCompact ? 'mb-4' : 'mb-6';
  const headerGap = isCompact ? 'gap-3' : 'gap-4';
  const badgePadding = isCompact ? 'px-3 py-2' : 'px-4 py-3';
  const gridGap = isCompact ? 'gap-4' : 'gap-6';
  const columnSpacing = isCompact ? 'space-y-4' : 'space-y-6';
  const cardPadding = isCompact ? 'p-4' : 'p-5';
  const cardSpacing = isCompact ? 'space-y-3' : 'space-y-4';
  const cardHeaderGap = isCompact ? 'gap-2' : 'gap-3';
  const formGrid = isCompact && isCompany
    ? 'grid gap-3 md:grid-cols-2 lg:grid-cols-3'
    : `grid ${isCompact ? 'gap-3' : 'gap-4'} md:grid-cols-2`;
  const toggleSpacing = isCompact ? 'space-y-2' : 'space-y-3';
  const photoGap = isCompact ? 'gap-3' : 'gap-4';
  const titleSize = isCompact ? 'text-xl' : 'text-2xl';

  const [profileForm, setProfileForm] = useState(() => buildProfileDefaults(user, isCompany));
  const [preferences, setPreferences] = useState(
    isCompany ? companyPreferencesDefaults : candidatePreferencesDefaults,
  );
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [photoSourceIndex, setPhotoSourceIndex] = useState(0);
  const [photoSourceFailed, setPhotoSourceFailed] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPhoto, setIsSavingPhoto] = useState(false);
  const [profileStatus, setProfileStatus] = useState(null);
  const [photoStatus, setPhotoStatus] = useState(null);
  const [preferencesStatus, setPreferencesStatus] = useState(null);

  const preferencesKey = useMemo(() => {
    const identifier = user?.id || user?.email || 'guest';
    return `dashboard-preferences:${userType}:${identifier}`;
  }, [user?.id, user?.email, userType]);

  useEffect(() => {
    setProfileForm(buildProfileDefaults(user, isCompany));
  }, [user, isCompany]);

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview('');
      return undefined;
    }
    const url = URL.createObjectURL(photoFile);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem(preferencesKey);
      const defaults = isCompany ? companyPreferencesDefaults : candidatePreferencesDefaults;
      if (stored) {
        setPreferences({ ...defaults, ...JSON.parse(stored) });
      } else {
        setPreferences(defaults);
      }
    } catch {
      setPreferences(isCompany ? companyPreferencesDefaults : candidatePreferencesDefaults);
    }
  }, [preferencesKey, isCompany]);

  const storedUser = useMemo(() => {
    if (typeof window === 'undefined') return null;
    try {
      return JSON.parse(window.localStorage.getItem('user') || 'null');
    } catch {
      return null;
    }
  }, [user]);

  const profilePhotoUrl = isCompany
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

  const photoSources = useMemo(
    () => buildAssetSources(profilePhotoUrl),
    [profilePhotoUrl]
  );

  useEffect(() => {
    setPhotoSourceIndex(0);
    setPhotoSourceFailed(false);
  }, [photoSources]);

  const fallbackPhotoSource = photoSourceFailed
    ? ''
    : (photoSources[photoSourceIndex] || '');
  const photoSource = photoPreview || fallbackPhotoSource;
  const photoLabel = isCompany ? 'Company logo' : 'Profile photo';
  const photoHelper = isCompany ? 'SVG, PNG, JPG, or WEBP. Max 5 MB.' : 'PNG, JPG, or WEBP. Max 5 MB.';
  const photoIcon = isCompany ? 'Building2' : 'UserRound';
  const photoUploadMethod = isCompany ? apiClient.auth.updateCompanyLogo : apiClient.auth.updateProfilePhoto;
  const preferenceToggles = isCompany ? companyPreferenceToggles : candidatePreferenceToggles;
  const cadenceOptions = notificationCadenceOptions[isCompany ? 'company' : 'candidate'];

  const handleProfileFieldChange = (field, value) => {
    setProfileForm((prev) => ({ ...prev, [field]: value }));
    if (profileStatus) {
      setProfileStatus(null);
    }
  };

  const handlePhotoFileChange = (event) => {
    const file = event?.target?.files?.[0];
    if (!file) return;

    const allowedTypes = isCompany
      ? ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
      : ['image/jpeg', 'image/png', 'image/webp'];
    const maxBytes = 5 * 1024 * 1024;
    const allowedLabel = isCompany ? 'PNG, JPG, WEBP, or SVG' : 'PNG, JPG, or WEBP';

    setPhotoStatus(null);

    if (!allowedTypes.includes(file.type)) {
      setPhotoStatus({ type: 'error', message: `Unsupported image type. Please upload a ${allowedLabel}.` });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    if (file.size > maxBytes) {
      setPhotoStatus({ type: 'error', message: 'Image must be 5 MB or less.' });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setPhotoFile(file);
  };

  const handleSavePhoto = async () => {
    if (!photoFile) return;
    setPhotoStatus(null);
    setIsSavingPhoto(true);
    try {
      const response = await photoUploadMethod(photoFile);
      if (!response?.success || !response?.user) {
        throw new Error('Unable to update the photo. Please try again.');
      }
      setAuthenticatedUser(response.user);
      setPhotoFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setPhotoStatus({
        type: 'success',
        message: isCompany ? 'Company logo updated.' : 'Profile photo updated.',
      });
    } catch (error) {
      setPhotoStatus({
        type: 'error',
        message: error?.message || 'Failed to update photo.',
      });
    } finally {
      setIsSavingPhoto(false);
    }
  };

  const handleSaveProfile = async () => {
    setProfileStatus(null);
    setIsSavingProfile(true);
    try {
      const payload = isCompany
        ? {
            fullName: profileForm.fullName,
            companyName: profileForm.companyName,
            companySize: profileForm.companySize,
            industry: profileForm.industry,
            jobTitle: profileForm.jobTitle,
            department: profileForm.department,
            companyWebsite: profileForm.companyWebsite,
            companyLocation: profileForm.companyLocation,
            phoneNumber: profileForm.phoneNumber,
          }
        : {
            fullName: profileForm.fullName,
            targetRole: profileForm.targetRole,
            experienceLevel: profileForm.experienceLevel,
            location: profileForm.location,
            preferredLanguage: profileForm.preferredLanguage,
            industry: profileForm.industry,
          };

      const response = await apiClient.auth.updateProfile(payload);
      if (!response?.success || !response?.user) {
        throw new Error('Unable to update profile. Please try again.');
      }
      setAuthenticatedUser(response.user);
      setProfileStatus({ type: 'success', message: 'Profile updated successfully.' });
    } catch (error) {
      setProfileStatus({
        type: 'error',
        message: error?.message || 'Failed to update profile.',
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSavePreferences = () => {
    setPreferencesStatus(null);
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(preferencesKey, JSON.stringify(preferences));
      }
      setPreferencesStatus({ type: 'success', message: 'Preferences saved.' });
    } catch {
      setPreferencesStatus({ type: 'error', message: 'Unable to save preferences.' });
    }
  };

  const handlePreferenceChange = (key, value) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
    if (preferencesStatus) {
      setPreferencesStatus(null);
    }
  };

  const handlePhotoError = () => {
    if (photoPreview) return;
    if (photoSourceIndex < photoSources.length - 1) {
      setPhotoSourceIndex((prev) => prev + 1);
      return;
    }
    setPhotoSourceFailed(true);
  };

  return (
    <section
      id={sectionId}
      className={`${
        variant === 'plain'
          ? 'rounded-3xl bg-transparent'
          : 'scroll-mt-24 rounded-3xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-6 shadow-[0_25px_70px_rgba(15,23,42,0.12)] dark:shadow-[0_25px_70px_rgba(0,0,0,0.4)] backdrop-blur'
      } ${className}`}
    >
      <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between ${headerMargin} ${headerGap}`}>
        <div className={`flex items-center ${headerGap}`}>
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Icon name={isCompany ? 'Building2' : 'UserCircle'} size={22} color="white" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-blue-600 dark:text-blue-400">
              Profile Center
            </p>
            <h2 className={`${titleSize} font-semibold text-gray-900 dark:text-slate-100`}>
              Profile & Preferences
            </h2>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Update your details, photo, and notification settings.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className={`rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-900/60 text-xs text-gray-500 dark:text-slate-400 ${badgePadding}`}>
            {isCompany ? 'Company workspace' : 'Candidate workspace'}
          </div>
          {headerAction}
        </div>
      </div>

      <div className={`grid ${gridGap} lg:grid-cols-3`}>
        <div className={`lg:col-span-2 ${columnSpacing}`}>
          <div className={`rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-900/60 ${cardPadding} ${cardSpacing}`}>
            <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between ${cardHeaderGap}`}>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Profile details</h3>
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  {isCompany ? 'Keep your company profile current for candidates.' : 'Keep your candidate profile up to date.'}
                </p>
              </div>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleSaveProfile}
                disabled={isSavingProfile}
                className="rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white"
              >
                {isSavingProfile ? 'Saving...' : 'Save profile'}
              </Button>
            </div>

            <div className={formGrid}>
              <Input
                label="Full name"
                value={profileForm.fullName}
                onChange={(event) => handleProfileFieldChange('fullName', event.target.value)}
              />
              <Input
                label="Email"
                value={profileForm.email}
                disabled
              />
              {isCompany ? (
                <>
                  <Input
                    label="Company name"
                    value={profileForm.companyName}
                    onChange={(event) => handleProfileFieldChange('companyName', event.target.value)}
                  />
                  <Select
                    label="Company size"
                    options={companySizeOptions}
                    value={profileForm.companySize}
                    onChange={(value) => handleProfileFieldChange('companySize', value)}
                    placeholder="Select size"
                  />
                  <Input
                    label="Industry"
                    value={profileForm.industry}
                    onChange={(event) => handleProfileFieldChange('industry', event.target.value)}
                  />
                  <Input
                    label="Job title"
                    value={profileForm.jobTitle}
                    onChange={(event) => handleProfileFieldChange('jobTitle', event.target.value)}
                  />
                  <Select
                    label="Department"
                    options={departmentOptions}
                    value={profileForm.department}
                    onChange={(value) => handleProfileFieldChange('department', value)}
                    placeholder="Select department"
                  />
                  <Input
                    label="Company website"
                    type="url"
                    value={profileForm.companyWebsite}
                    onChange={(event) => handleProfileFieldChange('companyWebsite', event.target.value)}
                  />
                  <Input
                    label="Company location"
                    value={profileForm.companyLocation}
                    onChange={(event) => handleProfileFieldChange('companyLocation', event.target.value)}
                  />
                  <Input
                    label="Phone number"
                    type="tel"
                    value={profileForm.phoneNumber}
                    onChange={(event) => handleProfileFieldChange('phoneNumber', event.target.value)}
                  />
                </>
              ) : (
                <>
                  <Select
                    label="Experience level"
                    options={experienceOptions}
                    value={profileForm.experienceLevel}
                    onChange={(value) => handleProfileFieldChange('experienceLevel', value)}
                    placeholder="Select experience"
                  />
                  <Input
                    label="Target role"
                    value={profileForm.targetRole}
                    onChange={(event) => handleProfileFieldChange('targetRole', event.target.value)}
                  />
                  <Input
                    label="Location"
                    value={profileForm.location}
                    onChange={(event) => handleProfileFieldChange('location', event.target.value)}
                  />
                  <Select
                    label="Preferred language"
                    options={languageOptions}
                    value={profileForm.preferredLanguage}
                    onChange={(value) => handleProfileFieldChange('preferredLanguage', value)}
                    placeholder="Select language"
                  />
                  <Input
                    label="Industry focus"
                    value={profileForm.industry}
                    onChange={(event) => handleProfileFieldChange('industry', event.target.value)}
                  />
                </>
              )}
            </div>
            <StatusMessage status={profileStatus} />
          </div>
        </div>

        <div className={columnSpacing}>
          <div className={`rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-900/60 ${cardPadding} ${cardSpacing}`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{photoLabel}</h3>
                <p className="text-sm text-gray-500 dark:text-slate-400">Keep your profile visuals fresh.</p>
              </div>
            </div>

            <div className={`flex items-center ${photoGap}`}>
              <div className={`rounded-full border border-white/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/80 flex items-center justify-center overflow-hidden ${isCompact ? 'w-20 h-20' : 'w-24 h-24'}`}>
                {photoSource ? (
                  <img
                    src={photoSource}
                    alt={photoLabel}
                    className="w-full h-full object-cover"
                    onError={handlePhotoError}
                  />
                ) : (
                  <Icon name={photoIcon} size={28} className="text-blue-600 dark:text-blue-400" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                  {photoFile?.name || (photoSource ? 'Current image' : 'No image uploaded')}
                </p>
                <p className="text-xs text-gray-500 dark:text-slate-400">{photoHelper}</p>
                <StatusMessage status={photoStatus} />
              </div>
            </div>

            <div className={`flex flex-wrap gap-2 ${photoFile ? '' : 'justify-center'}`}>
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
              {photoFile && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={handleSavePhoto}
                    disabled={isSavingPhoto}
                  >
                    {isSavingPhoto ? 'Saving...' : 'Save photo'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-full text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
                    onClick={() => {
                      setPhotoFile(null);
                      setPhotoStatus(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    }}
                  >
                    Cancel
                  </Button>
                </>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept={isCompany ? 'image/*,.svg' : 'image/*'}
              onChange={handlePhotoFileChange}
              className="hidden"
            />
          </div>

          <div className={`rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-900/60 ${cardPadding} ${cardSpacing}`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Preferences</h3>
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  Configure notifications and workflow settings.
                </p>
              </div>
            </div>

            <Select
              label="Notification cadence"
              options={cadenceOptions}
              value={preferences.notificationCadence}
              onChange={(value) => handlePreferenceChange('notificationCadence', value)}
            />

            <div className={toggleSpacing}>
              {preferenceToggles.map((toggle) => (
                <PreferenceToggle
                  key={toggle.key}
                  id={`${userType}-${toggle.key}`}
                  label={toggle.label}
                  description={toggle.description}
                  checked={Boolean(preferences[toggle.key])}
                  onChange={(value) => handlePreferenceChange(toggle.key, value)}
                  density={density}
                />
              ))}
            </div>

            <div className="flex items-center justify-between">
              <StatusMessage status={preferencesStatus} />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={handleSavePreferences}
              >
                Save preferences
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProfileSettingsPanel;
