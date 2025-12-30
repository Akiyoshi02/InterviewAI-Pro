import React from 'react';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/AppIcon';

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

  const locationFeedback = locationHelper?.targetField === 'location' ? locationHelper : null;
  const locationStatusClass = locationFeedback?.status === 'success'
    ? 'text-emerald-600 dark:text-emerald-400'
    : locationFeedback?.status === 'error'
      ? 'text-rose-500 dark:text-rose-400'
      : 'text-slate-500 dark:text-slate-400';
  const detectingForCandidate = isDetectingLocation && locationHelper?.targetField === 'location';

  const profileUploadRef = React.useRef(null);
  const resumeUploadRef = React.useRef(null);

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
      try {
        if (onValidateFile) {
          await onValidateFile(file);
        }
        onFieldChange(fieldKey, file);
      } catch (validationError) {
        if (inputRef?.current) {
          inputRef.current.value = '';
        }
        onFieldChange(fieldKey, null);
      } finally {
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                iconName="Upload"
                className="rounded-full"
                onClick={() => inputRef?.current?.click()}
                disabled={isChecking}
                loading={isChecking}
              >
                Replace
              </Button>
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
            <Button
              type="button"
              variant="default"
              size="sm"
              iconName="Upload"
              className="rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white"
              onClick={() => inputRef?.current?.click()}
              disabled={isChecking}
              loading={isChecking}
            >
              Upload
            </Button>
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
      <Select
        label="Gender"
        placeholder="Select your gender"
        options={genders}
        value={formData?.gender}
        onChange={(value) => onFieldChange('gender', value)}
        error={errors?.gender}
        required
      />
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Input
            label="Current Location"
            type="text"
            placeholder="e.g., San Francisco, CA"
            value={formData?.location}
            onChange={(e) => onFieldChange('location', e?.target?.value)}
            error={errors?.location}
          />
          <div className="flex justify-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              iconName="MapPin"
              onClick={() => onDetectLocation?.('location')}
              loading={detectingForCandidate}
              disabled={isDetectingLocation}
              className="rounded-full"
            >
              Use current location
            </Button>
          </div>
          {locationFeedback?.status === 'error' && locationFeedback?.message && (
            <div className="flex justify-center">
              <span className={`text-xs ${locationStatusClass}`}>
                {locationFeedback.message}
              </span>
            </div>
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