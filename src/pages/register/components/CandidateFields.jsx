import React from 'react';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/AppIcon';
import LoadingIndicator from '../../../components/ui/LoadingIndicator';
import PhoneInput from '../../../components/ui/PhoneInput';

const CandidateFields = ({
  formData,
  onFieldChange,
  errors,
  onDetectLocation,
  isDetectingLocation = false,
  locationHelper,
  className = '',
  uploadModeration = {},
  onModerateUpload,
  onResetModeration,
}) => {
  const genders = [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
  ];

  const experienceLevels = [
    { value: 'entry', label: 'Entry Level (0-2 years)' },
    { value: 'mid', label: 'Mid Level (3-5 years)' },
    { value: 'senior', label: 'Senior Level (6-10 years)' },
    { value: 'lead', label: 'Lead/Principal (10+ years)' },
    { value: 'executive', label: 'Executive/C-Level' }
  ];

  const industries = [
    { value: 'technology', label: 'Technology & Software' }
  ];

  const jobRoles = [
    { value: 'software-engineer', label: 'Software Engineer' },
    { value: 'frontend-developer', label: 'Frontend Engineer' },
    { value: 'backend-developer', label: 'Backend Engineer' },
    { value: 'fullstack-developer', label: 'Full Stack Engineer' },
    { value: 'devops-engineer', label: 'DevOps Engineer' },
    { value: 'qa-engineer', label: 'QA Engineer' }
  ];

  const qualifications = [
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

  const currentYear = new Date().getFullYear();
  const graduationYears = Array.from({ length: 40 }, (_, i) => {
    const year = currentYear - i;
    return { value: year.toString(), label: year.toString() };
  });

  const otherSkillValue = 'other-skill';
  const otherCertificationValue = 'other';

  const availableSkills = [
    { value: 'javascript', label: 'JavaScript' },
    { value: 'typescript', label: 'TypeScript' },
    { value: 'python', label: 'Python' },
    { value: 'java', label: 'Java' },
    { value: 'csharp', label: 'C#' },
    { value: 'cpp', label: 'C++' },
    { value: 'react', label: 'React' },
    { value: 'angular', label: 'Angular' },
    { value: 'vue', label: 'Vue.js' },
    { value: 'nodejs', label: 'Node.js' },
    { value: 'express', label: 'Express.js' },
    { value: 'django', label: 'Django' },
    { value: 'spring', label: 'Spring Boot' },
    { value: 'dotnet', label: '.NET' },
    { value: 'sql', label: 'SQL' },
    { value: 'mongodb', label: 'MongoDB' },
    { value: 'postgresql', label: 'PostgreSQL' },
    { value: 'aws', label: 'AWS' },
    { value: 'azure', label: 'Azure' },
    { value: 'docker', label: 'Docker' },
    { value: 'kubernetes', label: 'Kubernetes' },
    { value: 'git', label: 'Git' },
    { value: 'agile', label: 'Agile/Scrum' },
    { value: 'testing', label: 'Testing/QA' },
    { value: otherSkillValue, label: 'Other Skill' },
  ];

  const availableCertifications = [
    { value: 'aws-solutions-architect', label: 'AWS Solutions Architect' },
    { value: 'aws-developer', label: 'AWS Developer' },
    { value: 'aws-sysops', label: 'AWS SysOps Administrator' },
    { value: 'azure-fundamentals', label: 'Azure Fundamentals' },
    { value: 'azure-administrator', label: 'Azure Administrator' },
    { value: 'azure-developer', label: 'Azure Developer' },
    { value: 'gcp-associate', label: 'Google Cloud Associate' },
    { value: 'gcp-professional', label: 'Google Cloud Professional' },
    { value: 'kubernetes-cka', label: 'Kubernetes CKA' },
    { value: 'kubernetes-ckad', label: 'Kubernetes CKAD' },
    { value: 'docker-dca', label: 'Docker DCA' },
    { value: 'comptia-security', label: 'CompTIA Security+' },
    { value: 'comptia-network', label: 'CompTIA Network+' },
    { value: 'cisco-ccna', label: 'Cisco CCNA' },
    { value: 'pmp', label: 'PMP (Project Management)' },
    { value: 'scrum-master', label: 'Certified Scrum Master' },
    { value: 'istqb', label: 'ISTQB Testing' },
    { value: 'oracle-java', label: 'Oracle Java Certification' },
    { value: 'microsoft-mcsa', label: 'Microsoft MCSA' },
    { value: otherCertificationValue, label: 'Other Certification' },
  ];

  const [customSkill, setCustomSkill] = React.useState('');
  const [customCertification, setCustomCertification] = React.useState('');
  const [showCustomSkillInput, setShowCustomSkillInput] = React.useState(false);
  const [showCustomCertificationInput, setShowCustomCertificationInput] = React.useState(false);
  const hasManualSkillToggle = React.useRef(false);
  const hasManualCertificationToggle = React.useRef(false);

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

  const locationFeedback = locationHelper?.targetField === 'location' ? locationHelper : null;
  const locationStatusClass = locationFeedback?.status === 'success'
    ? 'text-emerald-600 dark:text-emerald-400'
    : locationFeedback?.status === 'error'
      ? 'text-rose-500 dark:text-rose-400'
      : 'text-slate-500 dark:text-slate-400';
  const detectingForCandidate = isDetectingLocation && locationHelper?.targetField === 'location';

  const profileUploadRef = React.useRef(null);
  const resumeUploadRef = React.useRef(null);

  const normalizeValue = (value) => value?.toString().toLowerCase().trim();

  const buildCombinedOptions = (baseOptions, selectedValues) => {
    const baseLookup = new Set(baseOptions.map((option) => normalizeValue(option.value)));
    const extraOptions = (selectedValues || [])
      .filter((value) => value && !baseLookup.has(normalizeValue(value)))
      .map((value) => ({ value, label: value }));
    return [...baseOptions, ...extraOptions];
  };

  const combinedSkillOptions = buildCombinedOptions(availableSkills, formData?.skills);
  const combinedCertificationOptions = buildCombinedOptions(availableCertifications, formData?.certifications);
  const selectedSkills = (formData?.skills || [])
    .filter((value) => normalizeValue(value) !== normalizeValue(otherSkillValue));
  const selectedCertifications = (formData?.certifications || [])
    .filter((value) => normalizeValue(value) !== normalizeValue(otherCertificationValue));
  const baseSkillLookup = new Set(availableSkills.map((option) => normalizeValue(option.value)));
  const baseCertificationLookup = new Set(availableCertifications.map((option) => normalizeValue(option.value)));
  const hasCustomSkill = selectedSkills.some((value) => !baseSkillLookup.has(normalizeValue(value)));
  const hasCustomCertification = selectedCertifications.some((value) => !baseCertificationLookup.has(normalizeValue(value)));
  const customSkillValues = selectedSkills.filter((value) => !baseSkillLookup.has(normalizeValue(value)));
  const customCertificationValues = selectedCertifications.filter((value) => !baseCertificationLookup.has(normalizeValue(value)));
  const shouldShowCustomSkillInput = showCustomSkillInput;
  const shouldShowCustomCertificationInput = showCustomCertificationInput;

  React.useEffect(() => {
    if (hasManualSkillToggle.current) return;
    if (hasCustomSkill) {
      setShowCustomSkillInput(true);
    }
  }, [hasCustomSkill]);

  React.useEffect(() => {
    if (hasManualCertificationToggle.current) return;
    if (hasCustomCertification) {
      setShowCustomCertificationInput(true);
    }
  }, [hasCustomCertification]);

  const handleAddCustomSkill = () => {
    const trimmed = customSkill.trim();
    if (!trimmed) return;

    const matchedOption = availableSkills.find((option) => (
      normalizeValue(option.value) !== normalizeValue(otherSkillValue)
      && (
        normalizeValue(option.label) === normalizeValue(trimmed)
        || normalizeValue(option.value) === normalizeValue(trimmed)
      )
    ));
    const valueToAdd = matchedOption ? matchedOption.value : trimmed;
    const currentSkills = selectedSkills;

    if (!currentSkills.some((value) => normalizeValue(value) === normalizeValue(valueToAdd))) {
      onFieldChange('skills', [...currentSkills, valueToAdd]);
    }
    setCustomSkill('');
  };

  const handleAddCustomCertification = () => {
    const trimmed = customCertification.trim();
    if (!trimmed) return;

    const matchedOption = availableCertifications.find((option) => (
      normalizeValue(option.value) !== normalizeValue(otherCertificationValue)
      && (
        normalizeValue(option.label) === normalizeValue(trimmed)
        || normalizeValue(option.value) === normalizeValue(trimmed)
      )
    ));
    const valueToAdd = matchedOption ? matchedOption.value : trimmed;
    const currentCerts = selectedCertifications;

    if (!currentCerts.some((value) => normalizeValue(value) === normalizeValue(valueToAdd))) {
      onFieldChange('certifications', [...currentCerts, valueToAdd]);
    }
    setCustomCertification('');
  };

  const handleRemoveCustomSkill = (targetValue) => {
    const nextSkills = selectedSkills.filter(
      (value) => normalizeValue(value) !== normalizeValue(targetValue),
    );
    onFieldChange('skills', nextSkills);
  };

  const handleRemoveCustomCertification = (targetValue) => {
    const nextCertifications = selectedCertifications.filter(
      (value) => normalizeValue(value) !== normalizeValue(targetValue),
    );
    onFieldChange('certifications', nextCertifications);
  };

  const fileUploads = [
    {
      fieldKey: 'profilePhoto',
      label: 'Profile Picture',
      description: 'Add a friendly photo so interview coaches can recognize you.',
      helper: 'JPG or PNG · Max 5 MB',
      icon: 'UserRound',
      accept: 'image/*',
      inputRef: profileUploadRef,
      previewMode: 'image',
      required: true,
      onValidateFile: onModerateUpload ? (file) => onModerateUpload('profilePhoto', file) : null,
      moderationState: uploadModeration?.profilePhoto,
      onReset: onResetModeration ? () => onResetModeration('profilePhoto') : null,
    },
    {
      fieldKey: 'resumeFile',
      label: 'CV / Résumé',
      description: 'Upload your latest CV to tailor interview content.',
      helper: 'PDF, DOC, DOCX · Max 10 MB',
      icon: 'FileText',
      accept: '.pdf,.doc,.docx',
      inputRef: resumeUploadRef,
      previewMode: 'document',
      required: true,
      onValidateFile: onModerateUpload
        ? (file) => onModerateUpload('resumeFile', file, {
            metadata: {
              expectedFullName: formData?.fullName?.trim() || '',
              expectedEmail: formData?.email?.trim() || '',
            },
          })
        : null,
      moderationState: uploadModeration?.resumeFile,
      onReset: onResetModeration ? () => onResetModeration('resumeFile') : null,
    },
  ];

  const formatFileSize = (bytes) => {
    if (!bytes || Number.isNaN(bytes)) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const size = bytes / (1024 ** exponent);
    return `${size.toFixed(size >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
  };

  const UploadCard = ({
    fieldKey,
    label,
    description,
    helper,
    icon,
    accept,
    inputRef,
    previewMode = 'none',
    required = false,
    onValidateFile,
    moderationState,
    onReset,
  }) => {
    const inputId = React.useId();
    const fileValue = formData?.[fieldKey];
    const error = errors?.[fieldKey];
    const stateClass = error
      ? 'border-rose-400/70 bg-rose-50/60 dark:border-rose-500/60 dark:bg-rose-900/30'
      : fileValue
        ? 'border-blue-400/60 bg-blue-50/70 dark:border-blue-500/60 dark:bg-blue-900/30'
        : 'border-white/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-900/40';

    const [previewUrl, setPreviewUrl] = React.useState(null);
    const [isUploading, setIsUploading] = React.useState(false);
    const isImagePreviewable = previewMode === 'image'
      && fileValue instanceof File
      && fileValue.type?.startsWith('image/');
    const isPdfPreviewable = previewMode === 'document'
      && fileValue instanceof File
      && fileValue.type === 'application/pdf';
    const currentModeration = moderationState || { status: 'idle', error: '' };
    const moderationError = currentModeration?.error && currentModeration.error !== error ? currentModeration.error : null;
    const isChecking = currentModeration?.status === 'checking' || isUploading;
    const checkingMessage = previewMode === 'image' ? 'Analyzing image…' : 'Verifying document…';

    React.useEffect(() => {
      if (!fileValue || (!isImagePreviewable && !isPdfPreviewable)) {
        setPreviewUrl(null);
        return undefined;
      }
      const url = URL.createObjectURL(fileValue);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }, [fileValue, isImagePreviewable, isPdfPreviewable]);

    const handleFileChange = async (event) => {
      const file = event?.target?.files?.[0];
      if (!file) return;

      setIsUploading(true);
      onFieldChange(fieldKey, file);
      try {
        if (onValidateFile) {
          await onValidateFile(file);
        }
      } catch (validationError) {
        onFieldChange(fieldKey, null);
      } finally {
        if (inputRef?.current) {
          inputRef.current.value = '';
        }
        setIsUploading(false);
      }
    };

    const handleRemoveFile = () => {
      if (inputRef?.current) {
        inputRef.current.value = '';
      }
      onFieldChange(fieldKey, null);
      onReset?.();
    };

    return (
      <div
        className={`rounded-2xl border p-4 shadow-[0_10px_36px_rgba(15,23,42,0.08)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.45)] transition-colors duration-200 ${stateClass}`}
      >
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-white/80 dark:bg-slate-900/70 flex items-center justify-center shadow-inner">
            <Icon name={icon} size={22} className="text-blue-600 dark:text-blue-300" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{label}{required && <span className="ml-1 text-rose-500">*</span>}</p>
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400">{description}</p>
          </div>
        </div>

        {fileValue ? (
          <div className="mt-4 rounded-2xl border border-white/40 dark:border-slate-800/60 bg-white/80 dark:bg-slate-900/60 p-3 space-y-3">
            {isImagePreviewable && previewUrl && (
              <div className="flex flex-col items-center gap-3">
                <div className="w-44 h-44 rounded-full overflow-hidden border-2 border-white/80 dark:border-slate-700/80 shadow-lg">
                  <img src={previewUrl} alt={`${label} preview`} className="w-full h-full object-cover" />
                </div>
                <div className="text-center min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-slate-100 break-words max-w-[240px] mx-auto">{fileValue?.name}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">{formatFileSize(fileValue?.size)}</p>
                </div>
              </div>
            )}
            {isPdfPreviewable && previewUrl && (
              <div className="space-y-2">
                <div className="w-full h-40 rounded-2xl overflow-hidden border border-white/50 dark:border-slate-800/60 shadow-inner">
                  <iframe
                    src={`${previewUrl}#toolbar=0&navpanes=0`}
                    title={`${label} preview`}
                    className="w-full h-full"
                    scrolling="yes"
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-slate-100 break-words max-w-[240px] mx-auto text-center">{fileValue?.name}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">{formatFileSize(fileValue?.size)}</p>
                </div>
              </div>
            )}
            {!previewUrl && !isPdfPreviewable && (
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-slate-100 break-words max-w-[240px] mx-auto text-center">{fileValue?.name}</p>
                <p className="text-xs text-gray-500 dark:text-slate-400">{formatFileSize(fileValue?.size)}</p>
                {previewMode === 'document' && fileValue instanceof File && fileValue.type !== 'application/pdf' && (
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                    Preview available for PDF files. You can still replace or remove this document.
                  </p>
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-2 justify-center">
              {isChecking ? (
                <span className="inline-flex items-center justify-center h-9 sm:h-10 rounded-full px-3 sm:px-4 min-h-[40px] border border-input bg-background opacity-50 cursor-not-allowed text-sm font-medium">
                  <LoadingIndicator size={14} tone="current" className="mr-2" />
                  Replace
                </span>
              ) : (
                <label
                  htmlFor={inputId}
                  className="inline-flex items-center justify-center h-9 sm:h-10 rounded-full px-3 sm:px-4 min-h-[40px] border border-input bg-background hover:bg-accent cursor-pointer text-sm font-medium"
                >
                  <Icon name="Upload" size={14} className="mr-2" />
                  Replace
                </label>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                iconName="Trash2"
                className="rounded-full text-rose-500 hover:text-rose-600"
                onClick={handleRemoveFile}
                disabled={isChecking}
              >
                Remove
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500 dark:text-slate-400">{helper}</p>
            {isChecking ? (
              <span className="inline-flex items-center justify-center h-9 sm:h-10 rounded-full px-3 sm:px-4 min-h-[40px] bg-gradient-to-r from-blue-600 to-purple-600 text-white opacity-50 cursor-not-allowed text-sm font-medium">
                <LoadingIndicator size={14} tone="current" className="mr-2" />
                Upload
              </span>
            ) : (
              <label
                htmlFor={inputId}
                className="inline-flex items-center justify-center h-9 sm:h-10 rounded-full px-3 sm:px-4 min-h-[40px] bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:opacity-90 cursor-pointer text-sm font-medium transition-opacity"
              >
                <Icon name="Upload" size={14} className="mr-2" />
                Upload
              </label>
            )}
          </div>
        )}

        {currentModeration?.status === 'checking' && (
          <p className="mt-2 text-xs text-sky-500 dark:text-sky-400 text-center">{checkingMessage}</p>
        )}
        {currentModeration?.status === 'approved' && fileValue && (
          <p className="mt-2 text-xs text-emerald-500 dark:text-emerald-400 text-center">Looks good!</p>
        )}
        {moderationError && (
          <p className="mt-2 text-xs text-rose-500 dark:text-rose-400 text-center">{moderationError}</p>
        )}

        {error && (
          <p className="mt-2 text-sm text-rose-500 dark:text-rose-400">{error}</p>
        )}

        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    );
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select
          label="Gender"
          placeholder="Select your gender"
          options={genders}
          value={formData?.gender}
          onChange={(value) => onFieldChange('gender', value)}
          error={errors?.gender}
          required
        />
        <PhoneInput
          label="Phone Number"
          value={formData?.phoneNumber}
          onChange={(value) => onFieldChange('phoneNumber', value)}
          error={errors?.phoneNumber}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select
          label="Experience Level"
          placeholder="Select your experience level"
          options={experienceLevels}
          value={formData?.experienceLevel}
          onChange={(value) => onFieldChange('experienceLevel', value)}
          error={errors?.experienceLevel}
          required
        />

        <Select
          label="Industry"
          placeholder="Select your industry"
          options={industries}
          value={formData?.industry}
          onChange={(value) => onFieldChange('industry', value)}
          error={errors?.industry}
          searchable
          required
        />
      </div>
      <Select
        label="Target Job Role"
        placeholder="Select your target job role"
        description="This helps us customize interview questions for you"
        options={jobRoles}
        value={formData?.targetRole}
        onChange={(value) => onFieldChange('targetRole', value)}
        error={errors?.targetRole}
        searchable
        required
      />
      <Input
        label="Career Goals"
        type="text"
        placeholder="e.g., Become a senior software engineer at a tech company"
        description="Brief description of your career aspirations (optional)"
        value={formData?.careerGoals}
        onChange={(e) => onFieldChange('careerGoals', e?.target?.value)}
        error={errors?.careerGoals}
        maxLength={200}
      />

      {/* Educational Background Section */}
      <div className="space-y-3 pt-2 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-base font-semibold text-gray-900 dark:text-slate-100">
              Educational Background
            </p>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Help us tailor interview questions to your education level.
            </p>
          </div>
          <div className="hidden md:flex w-10 h-10 rounded-2xl bg-purple-50 dark:bg-purple-900/30 items-center justify-center text-purple-600 dark:text-purple-300">
            <Icon name="GraduationCap" size={18} />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Highest Qualification"
            placeholder="Select your qualification"
            options={qualifications}
            value={formData?.highestQualification}
            onChange={(value) => onFieldChange('highestQualification', value)}
            error={errors?.highestQualification}
            required
          />
          <Select
            label="Field of Study"
            placeholder="Select your field of study"
            options={fieldOfStudyOptions}
            value={formData?.fieldOfStudy}
            onChange={(value) => onFieldChange('fieldOfStudy', value)}
            error={errors?.fieldOfStudy}
            searchable
            clearable
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Institution Name"
            placeholder="Select your institution"
            options={institutionOptions}
            value={formData?.institutionName}
            onChange={(value) => onFieldChange('institutionName', value)}
            error={errors?.institutionName}
            searchable
            clearable
          />
          <Select
            label="Graduation Year"
            placeholder="Select year"
            options={graduationYears}
            value={formData?.graduationYear}
            onChange={(value) => onFieldChange('graduationYear', value)}
            error={errors?.graduationYear}
            searchable
          />
        </div>
      </div>

      {/* Skills Section */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-base font-semibold text-gray-900 dark:text-slate-100">
              Technical Skills
            </p>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Select skills relevant to your target role (optional).
            </p>
          </div>
          <div className="hidden md:flex w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 items-center justify-center text-emerald-600 dark:text-emerald-300">
            <Icon name="Code2" size={18} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {combinedSkillOptions.map((skill) => {
            const isOtherSkill = normalizeValue(skill.value) === normalizeValue(otherSkillValue);
            const isSelected = !isOtherSkill && selectedSkills.includes(skill.value);
            const isOtherSelected = isOtherSkill && showCustomSkillInput;
            const isActive = isOtherSkill ? isOtherSelected : isSelected;
            return (
              <button
                key={skill.value}
                type="button"
                onClick={() => {
                  if (isOtherSkill) {
                    hasManualSkillToggle.current = true;
                    setShowCustomSkillInput((prev) => !prev);
                    return;
                  }
                  const currentSkills = selectedSkills;
                  const newSkills = isSelected
                    ? currentSkills.filter((s) => s !== skill.value)
                    : [...currentSkills, skill.value];
                  onFieldChange('skills', newSkills);
                }}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                    : 'bg-white/80 dark:bg-slate-800/80 text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600'
                }`}
              >
                {skill.label}
              </button>
            );
          })}
        </div>
        {shouldShowCustomSkillInput && (
          <div className="flex flex-col sm:flex-row sm:items-end gap-2 max-w-xl">
            <div className="flex-1">
              <Input
                label="Add a custom skill"
                type="text"
                placeholder="e.g., Figma, NestJS, Tableau"
                value={customSkill}
                onChange={(e) => setCustomSkill(e?.target?.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomSkill();
                  }
                }}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddCustomSkill}
              className="rounded-full"
            >
              Add
            </Button>
          </div>
        )}
        {customSkillValues.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Custom skills
            </p>
            <div className="flex flex-wrap gap-2">
              {customSkillValues.map((skillValue) => (
                <button
                  key={skillValue}
                  type="button"
                  onClick={() => handleRemoveCustomSkill(skillValue)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-blue-300/70 text-blue-700 bg-blue-50 hover:bg-blue-100 dark:border-blue-500/60 dark:text-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 transition-colors"
                  title={`Remove ${skillValue}`}
                  aria-label={`Remove custom skill ${skillValue}`}
                >
                  <span>{skillValue}</span>
                  <Icon name="X" size={12} />
                </button>
              ))}
            </div>
          </div>
        )}
        {selectedSkills.length > 0 && (
          <p className="text-xs text-gray-500 dark:text-slate-400">
            {selectedSkills.length} skill{selectedSkills.length !== 1 ? 's' : ''} selected
          </p>
        )}
      </div>

      {/* Professional Certifications Section */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-base font-semibold text-gray-900 dark:text-slate-100">
              Professional Certifications
            </p>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Select any certifications you hold (optional).
            </p>
          </div>
          <div className="hidden md:flex w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-900/30 items-center justify-center text-amber-600 dark:text-amber-300">
            <Icon name="Award" size={18} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {combinedCertificationOptions.map((cert) => {
            const isOtherCertification = normalizeValue(cert.value) === normalizeValue(otherCertificationValue);
            const isSelected = !isOtherCertification && selectedCertifications.includes(cert.value);
            const isOtherSelected = isOtherCertification && showCustomCertificationInput;
            const isActive = isOtherCertification ? isOtherSelected : isSelected;
            return (
              <button
                key={cert.value}
                type="button"
                onClick={() => {
                  if (isOtherCertification) {
                    hasManualCertificationToggle.current = true;
                    setShowCustomCertificationInput((prev) => !prev);
                    return;
                  }
                  const currentCerts = selectedCertifications;
                  const newCerts = isSelected
                    ? currentCerts.filter((c) => c !== cert.value)
                    : [...currentCerts, cert.value];
                  onFieldChange('certifications', newCerts);
                }}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-500/30'
                    : 'bg-white/80 dark:bg-slate-800/80 text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-700 hover:border-amber-300 dark:hover:border-amber-600'
                }`}
              >
                {cert.label}
              </button>
            );
          })}
        </div>
        {shouldShowCustomCertificationInput && (
          <div className="flex flex-col sm:flex-row sm:items-end gap-2 max-w-xl">
            <div className="flex-1">
              <Input
                label="Add a custom certification"
                type="text"
                placeholder="e.g., Terraform Associate, Scrum@Scale"
                value={customCertification}
                onChange={(e) => setCustomCertification(e?.target?.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomCertification();
                  }
                }}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddCustomCertification}
              className="rounded-full"
            >
              Add
            </Button>
          </div>
        )}
        {customCertificationValues.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Custom certifications
            </p>
            <div className="flex flex-wrap gap-2">
              {customCertificationValues.map((certValue) => (
                <button
                  key={certValue}
                  type="button"
                  onClick={() => handleRemoveCustomCertification(certValue)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-amber-300/70 text-amber-700 bg-amber-50 hover:bg-amber-100 dark:border-amber-500/60 dark:text-amber-200 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 transition-colors"
                  title={`Remove ${certValue}`}
                  aria-label={`Remove custom certification ${certValue}`}
                >
                  <span>{certValue}</span>
                  <Icon name="X" size={12} />
                </button>
              ))}
            </div>
          </div>
        )}
        {selectedCertifications.length > 0 && (
          <p className="text-xs text-gray-500 dark:text-slate-400">
            {selectedCertifications.length} certification{selectedCertifications.length !== 1 ? 's' : ''} selected
          </p>
        )}
      </div>

      {/* Professional Links Section */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-base font-semibold text-gray-900 dark:text-slate-100">
              Professional Links
            </p>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Share your online profiles to showcase your work (optional).
            </p>
          </div>
          <div className="hidden md:flex w-10 h-10 rounded-2xl bg-sky-50 dark:bg-sky-900/30 items-center justify-center text-sky-600 dark:text-sky-300">
            <Icon name="Link" size={18} />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="LinkedIn Profile"
            type="url"
            placeholder="https://linkedin.com/in/yourprofile"
            value={formData?.linkedinUrl}
            onChange={(e) => onFieldChange('linkedinUrl', e?.target?.value)}
            error={errors?.linkedinUrl}
            iconName="Linkedin"
          />
          <Input
            label="GitHub Profile"
            type="url"
            placeholder="https://github.com/yourusername"
            value={formData?.githubUrl}
            onChange={(e) => onFieldChange('githubUrl', e?.target?.value)}
            error={errors?.githubUrl}
            iconName="Github"
          />
          <Input
            label="Portfolio Website"
            type="url"
            placeholder="https://yourportfolio.com"
            value={formData?.portfolioUrl}
            onChange={(e) => onFieldChange('portfolioUrl', e?.target?.value)}
            error={errors?.portfolioUrl}
            iconName="Globe"
          />
        </div>
      </div>

      {/* Job Preferences Section */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-base font-semibold text-gray-900 dark:text-slate-100">
              Job Preferences
            </p>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Help companies understand your availability and expectations.
            </p>
          </div>
          <div className="hidden md:flex w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 items-center justify-center text-indigo-600 dark:text-indigo-300">
            <Icon name="Briefcase" size={18} />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Availability / Notice Period"
            placeholder="Select your availability"
            options={availabilityOptions}
            value={formData?.availability}
            onChange={(value) => onFieldChange('availability', value)}
            error={errors?.availability}
          />
          <Select
            label="Preferred Work Type"
            placeholder="Select work type"
            options={workTypeOptions}
            value={formData?.preferredWorkType}
            onChange={(value) => onFieldChange('preferredWorkType', value)}
            error={errors?.preferredWorkType}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Preferred Employment Type"
            placeholder="Select employment type"
            options={employmentTypeOptions}
            value={formData?.preferredEmploymentType}
            onChange={(value) => onFieldChange('preferredEmploymentType', value)}
            error={errors?.preferredEmploymentType}
          />
          <Select
            label="Expected Salary Range (Monthly)"
            placeholder="Select salary range"
            options={salaryRangeOptions}
            value={formData?.expectedSalary}
            onChange={(value) => onFieldChange('expectedSalary', value)}
            error={errors?.expectedSalary}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5 sm:space-y-2">
          <label className="text-sm font-medium leading-none text-foreground">
            Current Location
          </label>
          <div className="relative">
            <input
              type="text"
              value={detectingForCandidate && locationFeedback?.message ? locationFeedback.message : formData?.location || ''}
              onChange={(e) => onFieldChange('location', e?.target?.value)}
              placeholder="e.g., Colombo, Sri Lanka"
              disabled={isDetectingLocation}
              className={`flex h-11 sm:h-12 w-full rounded-xl border bg-background px-3 sm:px-4 pr-[90px] sm:pr-[100px] py-2.5 text-base sm:text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 min-h-[44px] ${
                errors?.location ? 'border-destructive focus-visible:ring-destructive' : 'border-input'
              }`}
            />
            <button
              type="button"
              onClick={() => onDetectLocation?.('location')}
              disabled={isDetectingLocation}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {detectingForCandidate ? (
                <>
                  <LoadingIndicator size={14} tone="current" />
                  <span className="hidden sm:inline">Detecting</span>
                </>
              ) : (
                <>
                  <Icon name="MapPin" size={14} />
                  <span className="hidden sm:inline">Detect</span>
                </>
              )}
            </button>
          </div>
          {errors?.location && (
            <p className="text-xs sm:text-sm text-destructive flex items-start gap-1.5">
              <Icon name="AlertCircle" size={12} className="mt-0.5 flex-shrink-0" />
              {errors.location}
            </p>
          )}
          {locationFeedback?.status === 'error' && locationFeedback?.message && !errors?.location && (
            <p className="text-xs sm:text-sm text-destructive flex items-start gap-1.5">
              <Icon name="AlertCircle" size={12} className="mt-0.5 flex-shrink-0" />
              {locationFeedback.message}
            </p>
          )}
        </div>

        <div className="pt-1">
          <Select
            label="Preferred Interview Language"
            placeholder="Select language"
            options={[
              { value: 'english', label: 'English' }
            ]}
            value={formData?.preferredLanguage}
            onChange={(value) => onFieldChange('preferredLanguage', value)}
            error={errors?.preferredLanguage}
          />
        </div>
      </div>
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-base font-semibold text-gray-900 dark:text-slate-100">
              Profile & Documents
            </p>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Upload a photo and CV to personalize your practice experience.
            </p>
          </div>
          <div className="hidden md:flex w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-900/30 items-center justify-center text-blue-600 dark:text-blue-300">
            <Icon name="Sparkles" size={18} />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fileUploads.map((config) => (
            <UploadCard key={config.fieldKey} {...config} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default CandidateFields;
