import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import Button from './Button';
import Input from './Input';
import Select from './Select';
import Icon from '../AppIcon';
import LoadingIndicator from './LoadingIndicator';
import OrganizationSettings from './OrganizationSettings';
import PhoneInput from './PhoneInput';
import apiClient from '../../services/apiClient.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { hasPermission } from '../../utils/rolePermissions.js';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const FIREBASE_STORAGE_BUCKET = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '';

const experienceOptions = [
  { value: 'entry', label: 'Entry Level (0-2 years)' },
  { value: 'mid', label: 'Mid Level (3-5 years)' },
  { value: 'senior', label: 'Senior Level (6-10 years)' },
  { value: 'lead', label: 'Lead/Principal (10+ years)' },
  { value: 'executive', label: 'Executive/C-Level' },
];

const jobRoleOptions = [
  { value: 'software-engineer', label: 'Software Engineer' },
  { value: 'frontend-developer', label: 'Frontend Engineer' },
  { value: 'backend-developer', label: 'Backend Engineer' },
  { value: 'fullstack-developer', label: 'Full Stack Engineer' },
  { value: 'devops-engineer', label: 'DevOps Engineer' },
  { value: 'qa-engineer', label: 'QA Engineer' },
];

const industryOptions = [
  { value: 'technology', label: 'Technology & Software' },
];

const languageOptions = [
  { value: 'english', label: 'English' },
];

const qualificationOptions = [
  { value: 'ol', label: 'O/L (Ordinary Level)' },
  { value: 'al', label: 'A/L (Advanced Level)' },
  { value: 'diploma', label: 'Diploma / Certificate' },
  { value: 'hnd', label: 'HND (Higher National Diploma)' },
  { value: 'bachelors', label: "Bachelor's Degree" },
  { value: 'masters', label: "Master's Degree" },
  { value: 'phd', label: 'PhD / Doctorate' },
];

const fieldOfStudyOptions = [
  'Computer Science',
  'Software Engineering',
  'Information Technology',
  'Information Systems',
  'Data Science',
  'Artificial Intelligence',
  'Cyber Security',
  'Computer Engineering',
  'Electrical Engineering',
  'Electronics Engineering',
  'Mechanical Engineering',
  'Civil Engineering',
  'Industrial Engineering',
  'Business Administration',
  'Management',
  'Marketing',
  'Finance',
  'Accounting',
  'Economics',
  'Statistics',
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'Biotechnology',
  'Psychology',
  'Human Resources',
  'Project Management',
  'Graphic Design',
  'UX/UI Design',
  'Communication',
  'English',
  'Education',
  'Agriculture',
  'Medicine',
  'Nursing',
  'Public Health',
  'Hospitality',
  'Tourism',
].map((option) => ({ value: option, label: option }));

const institutionOptions = [
  'University of Colombo',
  'University of Moratuwa',
  'University of Sri Jayewardenepura',
  'University of Kelaniya',
  'University of Peradeniya',
  'University of Ruhuna',
  'University of Jaffna',
  'Eastern University, Sri Lanka',
  'Rajarata University of Sri Lanka',
  'Sabaragamuwa University of Sri Lanka',
  'Wayamba University of Sri Lanka',
  'Uva Wellassa University',
  'Open University of Sri Lanka',
  'Sri Lanka Institute of Information Technology (SLIIT)',
  'Informatics Institute of Technology (IIT)',
  'National School of Business Management (NSBM)',
  'Sri Lanka Institute of Advanced Technological Education (SLIATE)',
  'National Institute of Business Management (NIBM)',
  'Academy of Design (AOD)',
  'APIIT Sri Lanka',
  'CINEC Campus',
  'University of the Visual and Performing Arts',
].map((option) => ({ value: option, label: option }));

const availabilityOptions = [
  { value: 'immediately', label: 'Immediately Available' },
  { value: '1-week', label: '1 Week Notice' },
  { value: '2-weeks', label: '2 Weeks Notice' },
  { value: '1-month', label: '1 Month Notice' },
  { value: '2-months', label: '2 Months Notice' },
  { value: '3-months', label: '3+ Months Notice' },
];

const workTypeOptions = [
  { value: 'remote', label: 'Remote' },
  { value: 'onsite', label: 'On-site' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'flexible', label: 'Flexible / No Preference' },
];

const employmentTypeOptions = [
  { value: 'full-time', label: 'Full-time' },
  { value: 'part-time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'internship', label: 'Internship' },
  { value: 'freelance', label: 'Freelance' },
];

const salaryRangeOptions = [
  { value: 'below-50k', label: 'Below Rs. 50,000' },
  { value: '50k-100k', label: 'Rs. 50,000 - 100,000' },
  { value: '100k-150k', label: 'Rs. 100,000 - 150,000' },
  { value: '150k-200k', label: 'Rs. 150,000 - 200,000' },
  { value: '200k-300k', label: 'Rs. 200,000 - 300,000' },
  { value: '300k-500k', label: 'Rs. 300,000 - 500,000' },
  { value: 'above-500k', label: 'Above Rs. 500,000' },
  { value: 'negotiable', label: 'Negotiable' },
];

const currentYear = new Date().getFullYear();
const graduationYearOptions = Array.from({ length: 40 }, (_, i) => {
  const year = currentYear - i;
  return { value: year.toString(), label: year.toString() };
});

const departmentOptions = [
  { value: 'hr', label: 'Human Resources' },
  { value: 'engineering', label: 'Engineering' },
  { value: 'sales', label: 'Sales & Marketing' },
  { value: 'operations', label: 'Operations' },
  { value: 'finance', label: 'Finance' },
  { value: 'executive', label: 'Executive' },
  { value: 'other', label: 'Other' },
];
const OTHER_DEPARTMENT_VALUE = 'other';

const recruiterWorkingDayOptions = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];

const defaultRecruiterInterviewAvailability = Object.freeze({
  timezone: 'UTC',
  workingDays: [1, 2, 3, 4, 5],
  businessHoursStart: '09:00',
  businessHoursEnd: '17:00',
  maxInterviewsPerDay: 8,
});

const normalizeWorkingDays = (rawWorkingDays) => {
  if (!Array.isArray(rawWorkingDays) || rawWorkingDays.length === 0) {
    return [...defaultRecruiterInterviewAvailability.workingDays];
  }
  const normalized = rawWorkingDays
    .map((day) => Number.parseInt(day, 10))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
  return normalized.length > 0
    ? [...new Set(normalized)].sort((a, b) => a - b)
    : [...defaultRecruiterInterviewAvailability.workingDays];
};

const normalizeTimeInput = (value, fallback) => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return /^\d{2}:\d{2}$/.test(trimmed) ? trimmed : fallback;
};

const normalizeTimezone = (value, fallback = 'UTC') => {
  const timezone = typeof value === 'string' ? value.trim() : '';
  if (!timezone) return fallback;
  try {
    Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return timezone;
  } catch {
    return fallback;
  }
};

const parseNumberWithinRange = (value, fallback, minimum, maximum) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
};

const normalizeRecruiterInterviewAvailability = (value = null, fallbackTimezone = 'UTC') => {
  const source = value && typeof value === 'object' ? value : {};
  return {
    timezone: normalizeTimezone(
      source.timezone,
      normalizeTimezone(fallbackTimezone, defaultRecruiterInterviewAvailability.timezone),
    ),
    workingDays: normalizeWorkingDays(source.workingDays),
    businessHoursStart: normalizeTimeInput(
      source.businessHoursStart,
      defaultRecruiterInterviewAvailability.businessHoursStart,
    ),
    businessHoursEnd: normalizeTimeInput(
      source.businessHoursEnd,
      defaultRecruiterInterviewAvailability.businessHoursEnd,
    ),
    maxInterviewsPerDay: parseNumberWithinRange(
      source.maxInterviewsPerDay,
      defaultRecruiterInterviewAvailability.maxInterviewsPerDay,
      1,
      40,
    ),
  };
};

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

const adminPreferencesDefaults = {
  notificationCadence: 'daily',
  securityAlerts: true,
  auditDigest: true,
  incidentEscalations: true,
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

const adminPreferenceToggles = [
  {
    key: 'securityAlerts',
    label: 'Security alerts',
    description: 'Notify on suspicious activity, access risks, and policy violations.',
  },
  {
    key: 'auditDigest',
    label: 'Audit digest',
    description: 'Receive periodic summaries of administrative activity and key changes.',
  },
  {
    key: 'incidentEscalations',
    label: 'Incident escalations',
    description: 'Immediately flag high-priority operational incidents.',
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
  admin: [
    { value: 'instant', label: 'Instant' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'off', label: 'Off' },
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

const normalizeOptionValue = (value) => (value ?? '').toString().toLowerCase().trim();

const resolveOptionValue = (options, value) => {
  const normalized = normalizeOptionValue(value);
  if (!normalized) return '';
  const match = options.find((option) => (
    normalizeOptionValue(option.value) === normalized
    || normalizeOptionValue(option.label) === normalized
  ));
  return match ? match.value : value;
};

const appendCurrentOption = (options, value) => {
  const normalized = normalizeOptionValue(value);
  if (!normalized) return options;
  const hasMatch = options.some((option) => (
    normalizeOptionValue(option.value) === normalized
    || normalizeOptionValue(option.label) === normalized
  ));
  if (hasMatch) return options;
  return [...options, { value, label: value }];
};

const formatDetectedLocation = (data, coords) => {
  if (!data && !coords) {
    return '';
  }

  const administrative = data?.localityInfo?.administrative || [];
  const locality = data?.city
    || data?.locality
    || data?.principalSubdivision
    || administrative.find((item) => (item.order ?? 0) >= 4)?.name;

  const region = data?.principalSubdivision
    || administrative.find((item) => (item.order ?? 0) <= 3)?.name;

  const country = data?.countryName || data?.countryCode;

  const parts = [locality, region, country].filter(Boolean);

  if (parts.length > 0) {
    return parts.join(', ');
  }

  if (coords) {
    const { latitude, longitude } = coords;
    return `Lat ${latitude.toFixed(3)}, Long ${longitude.toFixed(3)}`;
  }

  return '';
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
    className={`flex items-center rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-900/50 transition-colors hover:border-blue-200 dark:hover:border-blue-600 ${
      isCompact ? 'gap-2 p-2' : 'gap-3 p-3'
    }`}
  >
    <Input
      id={id}
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      className="rounded-full"
    />
    <div>
      <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{label}</p>
      <p className="text-xs text-gray-500 dark:text-slate-400">{description}</p>
    </div>
  </label>
  );
};

const buildProfileDefaults = (user, userType) => {
  const isCompany = userType === 'company';
  const isAdmin = userType === 'admin';

  return ({
  fullName: user?.fullName || '',
  email: user?.email || '',
  targetRole: isCompany
    ? user?.targetRole || ''
    : resolveOptionValue(jobRoleOptions, user?.targetRole || ''),
  experienceLevel: user?.experienceLevel || '',
  location: user?.location || '',
  preferredLanguage: user?.preferredLanguage || (isCompany ? '' : 'english'),
  industry: isCompany
    ? user?.industry || ''
    : resolveOptionValue(industryOptions, user?.industry || ''),
  jobTitle: user?.jobTitle || '',
  department: user?.department || '',
  phoneNumber: user?.phoneNumber || '',
  // Candidate education fields
  highestQualification: user?.highestQualification || '',
  fieldOfStudy: user?.fieldOfStudy || '',
  institutionName: user?.institutionName || '',
  graduationYear: user?.graduationYear || '',
  // Candidate professional links
  linkedinUrl: user?.linkedinUrl || '',
  githubUrl: user?.githubUrl || '',
  portfolioUrl: user?.portfolioUrl || '',
  // Candidate job preferences
  availability: user?.availability || '',
  preferredWorkType: user?.preferredWorkType || '',
  preferredEmploymentType: user?.preferredEmploymentType || '',
  expectedSalary: user?.expectedSalary || '',
  // Admin profile fields
  timezone: isAdmin ? user?.timezone || '' : '',
});
};

const getPreferenceDefaultsByUserType = (userType) => {
  if (userType === 'company') return companyPreferencesDefaults;
  if (userType === 'admin') return adminPreferencesDefaults;
  return candidatePreferencesDefaults;
};

const getPreferenceTogglesByUserType = (userType) => {
  if (userType === 'company') return companyPreferenceToggles;
  if (userType === 'admin') return adminPreferenceToggles;
  return candidatePreferenceToggles;
};

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
  const isAdmin = userType === 'admin';
  const isCandidate = userType === 'candidate';
  const companyOrganizationRole = (user?.organizationContext?.membership?.role || '').toString().toUpperCase();
  const isReviewerRole = companyOrganizationRole === 'REVIEWER';
  const isRecruiterRole = companyOrganizationRole === 'RECRUITER';
  const canManageOrganizationSettings = isCompany && hasPermission(companyOrganizationRole, 'MANAGE_ORGANIZATION');
  const canManageInterviewAvailability = isCompany && hasPermission(companyOrganizationRole, 'SEND_INVITATIONS');
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
  const companyProfileDescription = isReviewerRole
    ? 'Keep your reviewer identity and contact details current for interview feedback.'
    : isRecruiterRole
      ? 'Keep your recruiter profile current for hiring coordination.'
      : 'Keep your company profile current for candidates.';
  const companyPreferencesDescription = isReviewerRole
    ? 'Configure the alerts you want while reviewing interviews.'
    : isRecruiterRole
      ? 'Configure notifications and recruiting workflow settings.'
      : 'Configure notifications and workflow settings.';

  const [profileForm, setProfileForm] = useState(() => buildProfileDefaults(user, userType));
  const [recruiterInterviewAvailability, setRecruiterInterviewAvailability] = useState(
    () => normalizeRecruiterInterviewAvailability(
      user?.interviewAvailability,
      user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    ),
  );
  const [preferences, setPreferences] = useState(
    getPreferenceDefaultsByUserType(userType),
  );
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [photoSourceIndex, setPhotoSourceIndex] = useState(0);
  const [photoSourceFailed, setPhotoSourceFailed] = useState(false);
  const [resumeFile, setResumeFile] = useState(null);
  const resumeInputRef = useRef(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPhoto, setIsSavingPhoto] = useState(false);
  const [isSavingResume, setIsSavingResume] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [locationFeedback, setLocationFeedback] = useState({ status: 'idle', message: '' });
  const [profileStatus, setProfileStatus] = useState(null);
  const [photoStatus, setPhotoStatus] = useState(null);
  const [resumeStatus, setResumeStatus] = useState(null);
  const [preferencesStatus, setPreferencesStatus] = useState(null);
  const [saveAllStatus, setSaveAllStatus] = useState(null);
  const [saveOrganizationSettings, setSaveOrganizationSettings] = useState(null);
  const [isSavingOrganizationSettings, setIsSavingOrganizationSettings] = useState(false);
  const [activeTab, setActiveTab] = useState(
    isCompany && canManageOrganizationSettings ? 'company' : 'user',
  );

  const preferencesKey = useMemo(() => {
    const identifier = user?.id || user?.email || 'guest';
    return `dashboard-preferences:${userType}:${identifier}`;
  }, [user?.id, user?.email, userType]);

  useEffect(() => {
    setProfileForm(buildProfileDefaults(user, userType));
    setRecruiterInterviewAvailability(
      normalizeRecruiterInterviewAvailability(
        user?.interviewAvailability,
        user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      ),
    );
  }, [user, userType]);

  useEffect(() => {
    if (isCompany && !canManageOrganizationSettings && activeTab !== 'user') {
      setActiveTab('user');
    }
  }, [activeTab, canManageOrganizationSettings, isCompany]);

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
      const defaults = getPreferenceDefaultsByUserType(userType);
      if (stored) {
        setPreferences({ ...defaults, ...JSON.parse(stored) });
      } else {
        setPreferences(defaults);
      }
    } catch {
      setPreferences(getPreferenceDefaultsByUserType(userType));
    }
  }, [preferencesKey, userType]);

  const storedUser = useMemo(() => {
    if (typeof window === 'undefined') return null;
    try {
      return JSON.parse(window.localStorage.getItem('user') || 'null');
    } catch {
      return null;
    }
  }, [user]);

  const profilePhotoUrl = user?.profilePhotoUrl
    || user?.photoURL
    || user?.user_metadata?.photoURL
    || storedUser?.profilePhotoUrl
    || storedUser?.photoURL
    || storedUser?.user_metadata?.photoURL;

  const photoSources = useMemo(
    () => buildAssetSources(profilePhotoUrl),
    [profilePhotoUrl]
  );
  const resumeSources = useMemo(
    () => buildAssetSources(user?.resumeUrl),
    [user?.resumeUrl]
  );

  useEffect(() => {
    setPhotoSourceIndex(0);
    setPhotoSourceFailed(false);
  }, [photoSources]);

  const fallbackPhotoSource = photoSourceFailed
    ? ''
    : (photoSources[photoSourceIndex] || '');
  const photoSource = photoPreview || fallbackPhotoSource;
  const photoLabel = 'Profile photo';
  const photoHelper = 'PNG, JPG, or WEBP. Max 5 MB.';
  const photoIcon = isAdmin ? 'Shield' : 'UserRound';
  const photoUploadMethod = apiClient.auth.updateProfilePhoto;
  const preferenceToggles = getPreferenceTogglesByUserType(userType);
  const cadenceOptions = notificationCadenceOptions[userType === 'company' ? 'company' : userType === 'admin' ? 'admin' : 'candidate'];
  const resolvedJobRoleOptions = useMemo(
    () => appendCurrentOption(jobRoleOptions, profileForm.targetRole),
    [profileForm.targetRole]
  );
  const resolvedIndustryOptions = useMemo(
    () => appendCurrentOption(industryOptions, profileForm.industry),
    [profileForm.industry]
  );
  const resolvedFieldOfStudyOptions = useMemo(
    () => appendCurrentOption(fieldOfStudyOptions, profileForm.fieldOfStudy),
    [profileForm.fieldOfStudy]
  );
  const resolvedInstitutionOptions = useMemo(
    () => appendCurrentOption(institutionOptions, profileForm.institutionName),
    [profileForm.institutionName]
  );
  const resolvedAdminDepartmentOptions = useMemo(
    () => appendCurrentOption(departmentOptions, profileForm.department),
    [profileForm.department]
  );
  const hasCustomCompanyDepartment = isCompany && Boolean(
    profileForm.department
    && !departmentOptions.some(
      (option) => normalizeOptionValue(option.value) === normalizeOptionValue(profileForm.department),
    ),
  );
  const selectedCompanyDepartment = hasCustomCompanyDepartment
    ? OTHER_DEPARTMENT_VALUE
    : (profileForm.department || '');
  const customCompanyDepartment = hasCustomCompanyDepartment ? profileForm.department : '';

  const handleProfileFieldChange = (field, value) => {
    setProfileForm((prev) => ({ ...prev, [field]: value }));
    if (saveAllStatus) {
      setSaveAllStatus(null);
    }
    if (profileStatus) {
      setProfileStatus(null);
    }
    if (field === 'location' && locationFeedback?.status !== 'idle') {
      setLocationFeedback({ status: 'idle', message: '' });
    }
  };

  const handleRecruiterAvailabilityFieldChange = (field, value) => {
    setRecruiterInterviewAvailability((previous) => ({
      ...previous,
      [field]: value,
    }));
    if (saveAllStatus) {
      setSaveAllStatus(null);
    }
    if (profileStatus) {
      setProfileStatus(null);
    }
  };

  const handleRecruiterWorkingDayToggle = (day) => {
    setRecruiterInterviewAvailability((previous) => {
      const exists = previous.workingDays.includes(day);
      const nextDays = exists
        ? previous.workingDays.filter((entry) => entry !== day)
        : [...previous.workingDays, day];
      return {
        ...previous,
        workingDays: normalizeWorkingDays(nextDays),
      };
    });
    if (saveAllStatus) {
      setSaveAllStatus(null);
    }
    if (profileStatus) {
      setProfileStatus(null);
    }
  };

  const handlePhotoFileChange = (event) => {
    const file = event?.target?.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const maxBytes = 5 * 1024 * 1024;
    const allowedLabel = 'PNG, JPG, or WEBP';

    setPhotoStatus(null);
    if (saveAllStatus) {
      setSaveAllStatus(null);
    }

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

  const handleSavePhoto = async ({ showStatus = true } = {}) => {
    if (!photoFile) return;
    if (showStatus) {
      setPhotoStatus(null);
    }
    setIsSavingPhoto(true);
    let success = false;
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
      if (showStatus) {
        setPhotoStatus({
          type: 'success',
          message: 'Profile photo updated.',
        });
      }
      success = true;
    } catch (error) {
      if (showStatus) {
        setPhotoStatus({
          type: 'error',
          message: error?.message || 'Failed to update photo.',
        });
      }
    } finally {
      setIsSavingPhoto(false);
    }
    return success;
  };

  const handleSaveProfile = async ({ showStatus = true } = {}) => {
    if (showStatus) {
      setProfileStatus(null);
    }
    if (isCompany && selectedCompanyDepartment === OTHER_DEPARTMENT_VALUE && !customCompanyDepartment.trim()) {
      if (showStatus) {
        setProfileStatus({
          type: 'error',
          message: 'Please specify your department when selecting "Other".',
        });
      }
      return false;
    }
    setIsSavingProfile(true);
    let success = false;
    try {
      const companyPayload = {
            fullName: profileForm.fullName,
            jobTitle: profileForm.jobTitle,
            department: normalizeOptionValue(profileForm.department) === OTHER_DEPARTMENT_VALUE
              ? null
              : profileForm.department || null,
            phoneNumber: profileForm.phoneNumber,
          };

      if (canManageInterviewAvailability) {
        companyPayload.timezone = recruiterInterviewAvailability.timezone || profileForm.timezone || null;
        companyPayload.interviewAvailability = normalizeRecruiterInterviewAvailability(
          recruiterInterviewAvailability,
          recruiterInterviewAvailability.timezone || profileForm.timezone || 'UTC',
        );
      }

      const payload = isCompany
        ? companyPayload
        : isAdmin
          ? {
              fullName: profileForm.fullName,
              jobTitle: profileForm.jobTitle || null,
              department: profileForm.department || null,
              phoneNumber: profileForm.phoneNumber || null,
              timezone: profileForm.timezone || null,
            }
          : {
              fullName: profileForm.fullName,
              targetRole: profileForm.targetRole,
              experienceLevel: profileForm.experienceLevel,
              location: profileForm.location,
              preferredLanguage: profileForm.preferredLanguage,
              industry: profileForm.industry,
              phoneNumber: profileForm.phoneNumber,
              // Education fields
              highestQualification: profileForm.highestQualification,
              fieldOfStudy: profileForm.fieldOfStudy,
              institutionName: profileForm.institutionName,
              graduationYear: profileForm.graduationYear,
              // Professional links
              linkedinUrl: profileForm.linkedinUrl,
              githubUrl: profileForm.githubUrl,
              portfolioUrl: profileForm.portfolioUrl,
              // Job preferences
              availability: profileForm.availability,
              preferredWorkType: profileForm.preferredWorkType,
              preferredEmploymentType: profileForm.preferredEmploymentType,
              expectedSalary: profileForm.expectedSalary,
            };

      const response = await apiClient.auth.updateProfile(payload);
      if (!response?.success || !response?.user) {
        throw new Error('Unable to update profile. Please try again.');
      }
      setAuthenticatedUser(response.user);
      if (showStatus) {
        setProfileStatus({ type: 'success', message: 'Profile updated successfully.' });
      }
      success = true;
    } catch (error) {
      if (showStatus) {
        setProfileStatus({
          type: 'error',
          message: error?.message || 'Failed to update profile.',
        });
      }
    } finally {
      setIsSavingProfile(false);
    }
    return success;
  };

  const handleDetectLocation = async () => {
    if (isDetectingLocation) {
      return;
    }

    if (typeof window === 'undefined' || !navigator?.geolocation) {
      setLocationFeedback({
        status: 'error',
        message: 'Your browser does not support location detection. Please enter it manually.',
      });
      return;
    }

    setIsDetectingLocation(true);
    setLocationFeedback({
      status: 'info',
      message: 'Requesting location permission...',
    });

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

      setLocationFeedback({
        status: 'info',
        message: 'Detecting your city...',
      });

      const { latitude, longitude } = position.coords || {};

      if (latitude == null || longitude == null) {
        throw new Error('We could not read your coordinates. Please enter your location manually.');
      }

      const response = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
      );

      if (!response.ok) {
        throw new Error('Unable to determine your location automatically.');
      }

      const data = await response.json();
      const formattedLocation = formatDetectedLocation(data, { latitude, longitude });

      if (!formattedLocation) {
        throw new Error('We could not convert your coordinates into a city. Please enter it manually.');
      }

      handleProfileFieldChange('location', formattedLocation);
      setLocationFeedback({ status: 'success', message: '' });
    } catch (error) {
      console.error('Location detection error:', error);

      let friendlyMessage = error?.message || 'Unable to detect your location. Please enter it manually.';

      if (error?.code === 1 || error?.message?.toLowerCase().includes('permission')) {
        friendlyMessage = 'Location permission was denied. You can enable it in your browser or enter it manually.';
      } else if (error?.code === 2) {
        friendlyMessage = 'We could not determine your position. Please try again or enter it manually.';
      } else if (error?.code === 3) {
        friendlyMessage = 'Location request timed out. Please try again or enter it manually.';
      }

      setLocationFeedback({
        status: 'error',
        message: friendlyMessage,
      });
    } finally {
      setIsDetectingLocation(false);
    }
  };

  const handleSavePreferences = ({ showStatus = true } = {}) => {
    if (showStatus) {
      setPreferencesStatus(null);
    }
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(preferencesKey, JSON.stringify(preferences));
      }
      if (showStatus) {
        setPreferencesStatus({ type: 'success', message: 'Preferences saved.' });
      }
      return true;
    } catch {
      if (showStatus) {
        setPreferencesStatus({ type: 'error', message: 'Unable to save preferences.' });
      }
      return false;
    }
  };

  const handlePreferenceChange = (key, value) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
    if (saveAllStatus) {
      setSaveAllStatus(null);
    }
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

  const handleResumeFileChange = (event) => {
    const file = event?.target?.files?.[0];
    if (!file) {
      setResumeFile(null);
      setResumeStatus(null);
      if (saveAllStatus) {
        setSaveAllStatus(null);
      }
      return;
    }

    // Validate file type (MIME and extension fallback for browsers that omit MIME)
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const allowedExtensions = ['.pdf', '.doc', '.docx'];
    const fileName = (file.name || '').toLowerCase();
    const hasAllowedType = allowedTypes.includes(file.type);
    const hasAllowedExtension = allowedExtensions.some((ext) => fileName.endsWith(ext));
    if (!hasAllowedType && !hasAllowedExtension) {
      setResumeStatus({
        type: 'error',
        message: 'Resume must be a PDF or Word document.',
      });
      setResumeFile(null);
      if (resumeInputRef.current) {
        resumeInputRef.current.value = '';
      }
      return;
    }

    // Validate file size (10 MB max)
    const maxSize = 10 * 1024 * 1024; // 10 MB
    if (file.size > maxSize) {
      setResumeStatus({
        type: 'error',
        message: 'Resume must be 10 MB or less.',
      });
      setResumeFile(null);
      if (resumeInputRef.current) {
        resumeInputRef.current.value = '';
      }
      return;
    }

    setResumeStatus(null);
    if (saveAllStatus) {
      setSaveAllStatus(null);
    }
    setResumeFile(file);
  };

  const handleSaveResume = async ({ showStatus = true } = {}) => {
    if (!resumeFile) return;
    if (showStatus) {
      setResumeStatus(null);
    }
    setIsSavingResume(true);
    let success = false;
    try {
      const response = await apiClient.auth.updateResume(resumeFile);
      if (!response?.success || !response?.user) {
        throw new Error('Unable to update the resume. Please try again.');
      }
      setAuthenticatedUser(response.user);
      setResumeFile(null);
      if (resumeInputRef.current) {
        resumeInputRef.current.value = '';
      }
      if (showStatus) {
        setResumeStatus({
          type: 'success',
          message: 'Resume updated successfully.',
        });
      }
      success = true;
    } catch (error) {
      if (showStatus) {
        setResumeStatus({
          type: 'error',
          message: error?.message || 'Failed to update resume.',
        });
      }
    } finally {
      setIsSavingResume(false);
    }
    return success;
  };

  const handleSaveAllCandidate = async () => {
    if (!isCandidate) return;

    setSaveAllStatus(null);
    const results = [];

    const profileSaved = await handleSaveProfile({ showStatus: true });
    results.push(profileSaved);

    if (photoFile) {
      const photoSaved = await handleSavePhoto({ showStatus: true });
      results.push(Boolean(photoSaved));
    }

    if (resumeFile) {
      const resumeSaved = await handleSaveResume({ showStatus: true });
      results.push(Boolean(resumeSaved));
    }

    const preferencesSaved = handleSavePreferences({ showStatus: true });
    results.push(Boolean(preferencesSaved));

    const hasFailure = results.some((value) => !value);
    if (hasFailure) {
      setSaveAllStatus({
        type: 'error',
        message: 'Some changes could not be saved. Please check the messages above.',
      });
      return;
    }

    setSaveAllStatus({
      type: 'success',
      message: 'All changes saved successfully.',
    });
  };

  const handleSaveAllCompany = async () => {
    if (!isCompany) return;

    setSaveAllStatus(null);
    const results = [];

    if (typeof saveOrganizationSettings === 'function') {
      const orgSaved = await saveOrganizationSettings({ showStatus: true });
      results.push(Boolean(orgSaved));
    }

    const profileSaved = await handleSaveProfile({ showStatus: true });
    results.push(Boolean(profileSaved));

    if (photoFile) {
      const photoSaved = await handleSavePhoto({ showStatus: true });
      results.push(Boolean(photoSaved));
    }

    const preferencesSaved = handleSavePreferences({ showStatus: true });
    results.push(Boolean(preferencesSaved));

    const hasFailure = results.some((value) => !value);
    if (hasFailure) {
      setSaveAllStatus({
        type: 'error',
        message: 'Some changes could not be saved. Please check the messages above.',
      });
      return;
    }

    setSaveAllStatus({
      type: 'success',
      message: 'All changes saved successfully.',
    });
  };

  const isSavingAny = isSavingProfile || isSavingPhoto || isSavingResume || isSavingOrganizationSettings;

  return (
    <section
      id={sectionId}
      className={`${
        variant === 'plain'
          ? 'rounded-3xl bg-transparent'
          : 'scroll-mt-24 rounded-3xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-6 shadow-[0_25px_70px_rgba(15,23,42,0.12)] dark:shadow-[0_25px_70px_rgba(0,0,0,0.4)] backdrop-blur'
      } ${className}`}
    >
      {isAdmin && (
        <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between ${headerMargin} ${headerGap}`}>
          <div className={`flex items-center ${headerGap}`}>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Icon name="Shield" size={22} color="white" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-blue-600 dark:text-blue-400">
                Profile Center
              </p>
              <h2 className={`${titleSize} font-semibold text-gray-900 dark:text-slate-100`}>
                Profile & Preferences
              </h2>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                Manage your administrator profile and alert preferences.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={`rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-900/60 text-xs text-gray-500 dark:text-slate-400 ${badgePadding}`}>
              Admin workspace
            </div>
            {headerAction}
          </div>
        </div>
      )}

      {/* Tabs for Company Users */}
      {isCompany && canManageOrganizationSettings && (
        <div className="mb-6">
          <div className="border-b border-gray-200 dark:border-slate-700">
            <nav className="-mb-px flex space-x-4 sm:space-x-6 lg:space-x-8 overflow-x-auto scrollbar-hide">
              <button
                onClick={() => setActiveTab('company')}
                className={`
                  whitespace-nowrap py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 flex-shrink-0
                  ${
                    activeTab === 'company'
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-slate-400 dark:hover:text-slate-300'
                  }
                `}
              >
                <Icon name="Building2" className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                <span>Company Profile</span>
              </button>
              <button
                onClick={() => setActiveTab('user')}
                className={`
                  whitespace-nowrap py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 flex-shrink-0
                  ${
                    activeTab === 'user'
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-slate-400 dark:hover:text-slate-300'
                  }
                `}
              >
                <Icon name="UserCircle" className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                <span>User Profile</span>
              </button>
            </nav>
          </div>
        </div>
      )}

      {/* Tab Content */}
      {isCompany && canManageOrganizationSettings && activeTab === 'company' ? (
        <motion.div
          key="company"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <OrganizationSettings
            hideSaveActions
            onRegisterSaveHandler={(handler) => setSaveOrganizationSettings(() => handler)}
            onSavingStateChange={setIsSavingOrganizationSettings}
          />
        </motion.div>
      ) : (
        <motion.div
          key={isCompany ? 'user' : 'profile'}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className={`flex flex-col ${gridGap}`}
        >
          <div className={columnSpacing}>
          <div className={`rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-900/60 ${cardPadding} ${cardSpacing}`}>
            <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between ${cardHeaderGap}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                  <Icon name="UserCircle" size={18} className="text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Profile Details</h3>
                  <p className="text-sm text-gray-500 dark:text-slate-400">
                    {isCompany
                      ? companyProfileDescription
                      : isAdmin
                        ? 'Keep your administrator identity and contact details current.'
                        : 'Keep your candidate profile up to date.'}
                  </p>
                </div>
              </div>
              {isAdmin && (
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
              )}
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
                    label="Job title"
                    value={profileForm.jobTitle}
                    onChange={(event) => handleProfileFieldChange('jobTitle', event.target.value)}
                  />
                  <Select
                    label="Department"
                    options={departmentOptions}
                    value={selectedCompanyDepartment}
                    onChange={(value) => handleProfileFieldChange('department', value)}
                    placeholder="Select department"
                  />
                  {selectedCompanyDepartment === OTHER_DEPARTMENT_VALUE && (
                    <div className="space-y-2">
                      <Input
                        label="Specify department"
                        value={customCompanyDepartment}
                        onChange={(event) => {
                          const nextValue = event?.target?.value || '';
                          handleProfileFieldChange(
                            'department',
                            nextValue.trim() ? nextValue : OTHER_DEPARTMENT_VALUE,
                          );
                        }}
                        placeholder="Type your department"
                      />
                      {hasCustomCompanyDepartment && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          iconName="X"
                          onClick={() => handleProfileFieldChange('department', OTHER_DEPARTMENT_VALUE)}
                          className="rounded-full text-rose-500 hover:text-rose-600"
                        >
                          Remove custom department
                        </Button>
                      )}
                    </div>
                  )}
                  <PhoneInput
                    label="Phone number"
                    value={profileForm.phoneNumber}
                    onChange={(value) => handleProfileFieldChange('phoneNumber', value)}
                  />
                </>
              ) : isAdmin ? (
                <>
                  <Input
                    label="Job title"
                    value={profileForm.jobTitle}
                    onChange={(event) => handleProfileFieldChange('jobTitle', event.target.value)}
                    placeholder="System Administrator"
                  />
                  <Select
                    label="Department"
                    options={resolvedAdminDepartmentOptions}
                    value={profileForm.department}
                    onChange={(value) => handleProfileFieldChange('department', value)}
                    placeholder="Select department"
                    clearable
                  />
                  <PhoneInput
                    label="Phone number"
                    value={profileForm.phoneNumber}
                    onChange={(value) => handleProfileFieldChange('phoneNumber', value)}
                  />
                  <Input
                    label="Timezone"
                    value={profileForm.timezone}
                    onChange={(event) => handleProfileFieldChange('timezone', event.target.value)}
                    placeholder={Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'}
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
                  <Select
                    label="Target role"
                    options={resolvedJobRoleOptions}
                    value={profileForm.targetRole}
                    onChange={(value) => handleProfileFieldChange('targetRole', value)}
                    placeholder="Select target role"
                    searchable
                  />
                  <div className="min-w-0 space-y-1.5 sm:space-y-2">
                    <label
                      htmlFor="profile-location"
                      className="text-sm sm:text-sm font-medium leading-none text-foreground"
                    >
                      Location
                    </label>
                    <div className="flex min-w-0 flex-col gap-2 sm:relative sm:block">
                      <input
                        id="profile-location"
                        type="text"
                        value={isDetectingLocation && locationFeedback?.message ? locationFeedback.message : profileForm.location}
                        onChange={(event) => handleProfileFieldChange('location', event.target.value)}
                        disabled={isDetectingLocation}
                        className="flex h-11 sm:h-12 min-h-[44px] w-full min-w-0 rounded-xl border border-input bg-background px-3 py-2.5 pr-3 text-base sm:px-4 sm:pr-[100px] sm:text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200"
                      />
                      <button
                        type="button"
                        onClick={handleDetectLocation}
                        disabled={isDetectingLocation}
                        className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl bg-blue-50 px-3 py-2 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 sm:absolute sm:right-2 sm:top-1/2 sm:min-h-0 sm:w-auto sm:-translate-y-1/2 sm:rounded-lg sm:px-2.5 sm:py-1.5 sm:text-xs"
                      >
                        {isDetectingLocation ? (
                          <>
                            <LoadingIndicator size={14} tone="current" />
                            <span className="sm:hidden">Detecting location</span>
                            <span className="hidden sm:inline">Detecting</span>
                          </>
                        ) : (
                          <>
                            <Icon name="MapPin" size={14} />
                            <span className="sm:hidden">Detect location</span>
                            <span className="hidden sm:inline">Detect</span>
                          </>
                        )}
                      </button>
                    </div>
                    {locationFeedback?.status === 'error' && locationFeedback?.message && (
                      <p className="text-xs sm:text-sm text-destructive flex items-start gap-1.5">
                        <Icon name="AlertCircle" size={12} className="mt-0.5 flex-shrink-0" />
                        {locationFeedback.message}
                      </p>
                    )}
                  </div>
                  <PhoneInput
                    label="Phone number"
                    value={profileForm.phoneNumber}
                    onChange={(value) => handleProfileFieldChange('phoneNumber', value)}
                  />
                  <Select
                    label="Preferred language"
                    options={languageOptions}
                    value={profileForm.preferredLanguage}
                    onChange={(value) => handleProfileFieldChange('preferredLanguage', value)}
                    placeholder="Select language"
                  />
                  <Select
                    label="Industry focus"
                    options={resolvedIndustryOptions}
                    value={profileForm.industry}
                    onChange={(value) => handleProfileFieldChange('industry', value)}
                    placeholder="Select industry"
                    searchable
                    dropdownPlacement="bottom"
                  />
                </>
              )}
            </div>
            <StatusMessage status={profileStatus} />
          </div>

          {isCompany && canManageInterviewAvailability && (
            <div className={`rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-900/60 ${cardPadding} ${cardSpacing}`}>
              <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between ${cardHeaderGap}`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center">
                    <Icon name="CalendarClock" size={18} className="text-violet-600 dark:text-violet-300" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Interview Availability</h3>
                    <p className="text-sm text-gray-500 dark:text-slate-400">
                      Auto-scheduling uses this weekly window for your account.
                    </p>
                  </div>
                </div>
              </div>

              <div className={formGrid}>
                <Input
                  label="Timezone"
                  value={recruiterInterviewAvailability.timezone}
                  onChange={(event) => handleRecruiterAvailabilityFieldChange('timezone', event.target.value)}
                  placeholder={Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'}
                />
                <Input
                  label="Business Start"
                  type="time"
                  value={recruiterInterviewAvailability.businessHoursStart}
                  onChange={(event) => handleRecruiterAvailabilityFieldChange('businessHoursStart', event.target.value)}
                />
                <Input
                  label="Business End"
                  type="time"
                  value={recruiterInterviewAvailability.businessHoursEnd}
                  onChange={(event) => handleRecruiterAvailabilityFieldChange('businessHoursEnd', event.target.value)}
                />
                <Input
                  label="Max interviews/day"
                  type="number"
                  min={1}
                  max={40}
                  value={recruiterInterviewAvailability.maxInterviewsPerDay}
                  onChange={(event) => handleRecruiterAvailabilityFieldChange('maxInterviewsPerDay', event.target.value)}
                />
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400 mb-2">
                  Working days
                </p>
                <div className="grid w-full grid-cols-7 gap-1.5 sm:gap-2">
                  {recruiterWorkingDayOptions.map((day) => {
                    const isActive = recruiterInterviewAvailability.workingDays.includes(day.value);
                    return (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => handleRecruiterWorkingDayToggle(day.value)}
                        className={`min-h-[44px] min-w-0 w-full rounded-lg border px-0 py-2 text-sm font-medium leading-none whitespace-nowrap transition-colors sm:min-h-0 sm:text-xs ${
                          isActive
                            ? 'bg-violet-100 border-violet-300 text-violet-700 dark:bg-violet-600/20 dark:border-violet-500/40 dark:text-violet-200'
                            : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300'
                        }`}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Educational Background Section - Only for Candidates */}
          {isCandidate && (
            <div className={`rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-900/60 ${cardPadding} ${cardSpacing}`}>
              <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between ${cardHeaderGap}`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center">
                    <Icon name="GraduationCap" size={18} className="text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Educational Background</h3>
                    <p className="text-sm text-gray-500 dark:text-slate-400">Your academic qualifications</p>
                  </div>
                </div>
              </div>
              <div className={formGrid}>
                <Select
                  label="Highest Qualification"
                  options={qualificationOptions}
                  value={profileForm.highestQualification}
                  onChange={(value) => handleProfileFieldChange('highestQualification', value)}
                  placeholder="Select qualification"
                />
                <Select
                  label="Field of Study"
                  options={resolvedFieldOfStudyOptions}
                  value={profileForm.fieldOfStudy}
                  onChange={(value) => handleProfileFieldChange('fieldOfStudy', value)}
                  placeholder="Select field of study"
                  searchable
                  clearable
                />
                <Select
                  label="Institution Name"
                  options={resolvedInstitutionOptions}
                  value={profileForm.institutionName}
                  onChange={(value) => handleProfileFieldChange('institutionName', value)}
                  placeholder="Select institution"
                  searchable
                  clearable
                />
                <Select
                  label="Graduation Year"
                  options={graduationYearOptions}
                  value={profileForm.graduationYear}
                  onChange={(value) => handleProfileFieldChange('graduationYear', value)}
                  placeholder="Select year"
                  searchable
                />
              </div>
            </div>
          )}

          {/* Professional Links Section - Only for Candidates */}
          {isCandidate && (
            <div className={`rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-900/60 ${cardPadding} ${cardSpacing}`}>
              <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between ${cardHeaderGap}`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-900/30 flex items-center justify-center">
                    <Icon name="Link" size={18} className="text-sky-600 dark:text-sky-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Professional Links</h3>
                    <p className="text-sm text-gray-500 dark:text-slate-400">Share your online presence</p>
                  </div>
                </div>
              </div>
              <div className={`grid gap-4 md:grid-cols-3`}>
                <Input
                  label="LinkedIn Profile"
                  type="url"
                  placeholder="https://linkedin.com/in/..."
                  value={profileForm.linkedinUrl}
                  onChange={(event) => handleProfileFieldChange('linkedinUrl', event.target.value)}
                />
                <Input
                  label="GitHub Profile"
                  type="url"
                  placeholder="https://github.com/..."
                  value={profileForm.githubUrl}
                  onChange={(event) => handleProfileFieldChange('githubUrl', event.target.value)}
                />
                <Input
                  label="Portfolio Website"
                  type="url"
                  placeholder="https://yourportfolio.com"
                  value={profileForm.portfolioUrl}
                  onChange={(event) => handleProfileFieldChange('portfolioUrl', event.target.value)}
                />
              </div>
            </div>
          )}

          {/* Job Preferences Section - Only for Candidates */}
          {isCandidate && (
            <div className={`rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-900/60 ${cardPadding} ${cardSpacing}`}>
              <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between ${cardHeaderGap}`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
                    <Icon name="Briefcase" size={18} className="text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Job Preferences</h3>
                    <p className="text-sm text-gray-500 dark:text-slate-400">Your availability and expectations</p>
                  </div>
                </div>
              </div>
              <div className={formGrid}>
                <Select
                  label="Availability / Notice Period"
                  options={availabilityOptions}
                  value={profileForm.availability}
                  onChange={(value) => handleProfileFieldChange('availability', value)}
                  placeholder="Select availability"
                />
                <Select
                  label="Preferred Work Type"
                  options={workTypeOptions}
                  value={profileForm.preferredWorkType}
                  onChange={(value) => handleProfileFieldChange('preferredWorkType', value)}
                  placeholder="Select work type"
                />
                <Select
                  label="Preferred Employment Type"
                  options={employmentTypeOptions}
                  value={profileForm.preferredEmploymentType}
                  onChange={(value) => handleProfileFieldChange('preferredEmploymentType', value)}
                  placeholder="Select employment type"
                />
                <Select
                  label="Expected Salary (Monthly)"
                  options={salaryRangeOptions}
                  value={profileForm.expectedSalary}
                  onChange={(value) => handleProfileFieldChange('expectedSalary', value)}
                  placeholder="Select salary range"
                />
              </div>
            </div>
          )}
        </div>

          <div className={columnSpacing}>
            {/* Candidate media cards in one row (left: photo, right: resume) */}
            {isCandidate && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Profile Photo Upload Section */}
                <div className={`rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-900/60 ${cardPadding} ${cardSpacing}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-900/30 flex items-center justify-center">
                        <Icon name="Image" size={18} className="text-cyan-600 dark:text-cyan-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{photoLabel}</h3>
                        <p className="text-sm text-gray-500 dark:text-slate-400">Keep your profile visuals fresh.</p>
                      </div>
                    </div>
                  </div>

                  <div className={`mx-auto flex w-fit max-w-full items-center justify-center ${photoGap}`}>
                    <div className={`relative rounded-full border border-white/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/80 flex items-center justify-center overflow-visible ${isCompact ? 'w-20 h-20' : 'w-24 h-24'}`}>
                      {photoSource ? (
                        <>
                          <div className={`w-full h-full rounded-full overflow-hidden ${isCompact ? 'w-20 h-20' : 'w-24 h-24'}`}>
                            <img
                              src={photoSource}
                              alt={photoLabel}
                              className="w-full h-full object-cover"
                              onError={handlePhotoError}
                            />
                          </div>
                          {photoFile && (
                            <button
                              type="button"
                              onClick={() => {
                                setPhotoFile(null);
                                setPhotoStatus(null);
                                if (saveAllStatus) {
                                  setSaveAllStatus(null);
                                }
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
                        <Icon name={photoIcon} size={28} className="text-blue-600 dark:text-blue-400" />
                      )}
                    </div>
                    <div className="min-w-0 max-w-[26rem]">
                      <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                        {photoFile?.name || (photoSource ? 'Current image' : 'No image uploaded')}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400">{photoHelper}</p>
                      <StatusMessage status={photoStatus} />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 justify-center">
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
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoFileChange}
                    className="hidden"
                  />
                </div>

                {/* Resume Upload Section */}
                <div className={`rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-900/60 ${cardPadding} ${cardSpacing}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                        <Icon name="FileText" size={18} className="text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Resume / CV</h3>
                        <p className="text-sm text-gray-500 dark:text-slate-400">Keep your resume up to date with your latest achievements.</p>
                      </div>
                    </div>
                  </div>

                  <div className={`mx-auto flex w-fit max-w-full items-center justify-center ${photoGap}`}>
                    <div className={`relative rounded-lg border border-white/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/80 flex items-center justify-center overflow-visible ${isCompact ? 'w-20 h-20' : 'w-24 h-24'}`}>
                      <Icon name="FileText" size={28} className="text-blue-600 dark:text-blue-400" />
                      {resumeFile && (
                        <button
                          type="button"
                          onClick={() => {
                            setResumeFile(null);
                            setResumeStatus(null);
                            if (saveAllStatus) {
                              setSaveAllStatus(null);
                            }
                            if (resumeInputRef.current) {
                              resumeInputRef.current.value = '';
                            }
                          }}
                          className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg transition-colors z-10 border-2 border-white dark:border-slate-800"
                          aria-label="Remove selected resume"
                        >
                          <Icon name="X" size={12} color="white" />
                        </button>
                      )}
                    </div>
                    <div className="min-w-0 max-w-[26rem]">
                      <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                        {resumeFile?.name || (user?.resumeOriginalName ? user.resumeOriginalName : 'No resume uploaded')}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400">
                        {user?.resumeUrl ? 'Current resume is on file. Upload a new one to replace it.' : 'Upload your resume (PDF or Word document, max 10 MB)'}
                      </p>
                      <StatusMessage status={resumeStatus} />
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-center gap-2">
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      iconName="Upload"
                      className="rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                      onClick={() => resumeInputRef.current?.click()}
                    >
                      Choose file
                    </Button>
                    {resumeSources[0] && !resumeFile && (
                      <a
                        href={resumeSources[0]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 rounded-full border border-blue-200 dark:border-blue-800 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
                      >
                        <Icon name="Download" size={14} />
                        View Current Resume
                      </a>
                    )}
                  </div>

                  <input
                    ref={resumeInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={handleResumeFileChange}
                    className="hidden"
                  />
                </div>
              </div>
            )}

            {isCompany && (
              <div className={`rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-900/60 ${cardPadding} ${cardSpacing}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-900/30 flex items-center justify-center">
                      <Icon name="Image" size={18} className="text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{photoLabel}</h3>
                      <p className="text-sm text-gray-500 dark:text-slate-400">
                        Keep your team-facing identity current for reviewer assignments and hiring collaboration.
                      </p>
                    </div>
                  </div>
                </div>

                <div className={`mx-auto flex w-fit max-w-full items-center justify-center ${photoGap}`}>
                  <div className={`relative rounded-full border border-white/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/80 flex items-center justify-center overflow-visible ${isCompact ? 'w-20 h-20' : 'w-24 h-24'}`}>
                    {photoSource ? (
                      <>
                        <div className={`w-full h-full rounded-full overflow-hidden ${isCompact ? 'w-20 h-20' : 'w-24 h-24'}`}>
                          <img
                            src={photoSource}
                            alt={photoLabel}
                            className="w-full h-full object-cover"
                            onError={handlePhotoError}
                          />
                        </div>
                        {photoFile && (
                          <button
                            type="button"
                            onClick={() => {
                              setPhotoFile(null);
                              setPhotoStatus(null);
                              if (saveAllStatus) {
                                setSaveAllStatus(null);
                              }
                              if (fileInputRef.current) {
                                fileInputRef.current.value = '';
                              }
                            }}
                            className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg transition-colors z-10 border-2 border-white dark:border-slate-800"
                            aria-label="Cancel photo upload"
                          >
                            <Icon name="X" size={12} color="white" />
                          </button>
                        )}
                      </>
                    ) : (
                      <Icon name={photoIcon} size={28} className="text-blue-600 dark:text-blue-400" />
                    )}
                  </div>
                  <div className="min-w-0 max-w-[26rem]">
                    <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                      {photoFile?.name || (photoSource ? 'Current image' : 'No profile photo uploaded')}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">{photoHelper}</p>
                    <StatusMessage status={photoStatus} />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 justify-center">
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
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoFileChange}
                  className="hidden"
                />
              </div>
            )}

          <div className={`rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-900/60 ${cardPadding} ${cardSpacing}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
                  <Icon name="SlidersHorizontal" size={18} className="text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Preferences</h3>
                  <p className="text-sm text-gray-500 dark:text-slate-400">
                    {isCompany ? companyPreferencesDescription : 'Configure notifications and workflow settings.'}
                  </p>
                </div>
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
              {isAdmin && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={handleSavePreferences}
                >
                  Save preferences
                </Button>
              )}
            </div>
          </div>

        </div>
        </motion.div>
      )}
      {(isCandidate || isCompany) && (
        <div className="mt-4 rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-900/55 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-h-[20px]">
            {saveAllStatus?.message ? (
              <p className={`text-sm ${saveAllStatus.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                {saveAllStatus.message}
              </p>
            ) : (
              <p className="text-sm text-gray-500 dark:text-slate-400">
                Save to publish your latest profile updates.
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="default"
            size="sm"
            iconName="Save"
            className="rounded-2xl px-6"
            onClick={isCompany ? handleSaveAllCompany : handleSaveAllCandidate}
            disabled={isSavingAny}
          >
            {isSavingAny ? 'Saving...' : 'Save profile'}
          </Button>
        </div>
      )}
    </section>
  );
};

export default ProfileSettingsPanel;
