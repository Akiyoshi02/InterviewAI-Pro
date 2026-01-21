import React from 'react';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/AppIcon';
import LoadingIndicator from '../../../components/ui/LoadingIndicator';

const CompanyFields = ({
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
  const companySizes = [
    { value: '1-10', label: '1-10 employees (Startup)' },
    { value: '11-50', label: '11-50 employees (Small)' },
    { value: '51-200', label: '51-200 employees (Medium)' },
    { value: '201-1000', label: '201-1000 employees (Large)' },
    { value: '1000+', label: '1000+ employees (Enterprise)' }
  ];

  const companyTypes = [
    { value: 'private-limited', label: 'Private Limited Company (Pvt Ltd)' },
    { value: 'public-limited', label: 'Public Limited Company (PLC)' },
    { value: 'partnership', label: 'Partnership' },
    { value: 'sole-proprietorship', label: 'Sole Proprietorship' },
    { value: 'startup', label: 'Startup' },
    { value: 'ngo', label: 'NGO / Non-Profit Organization' },
    { value: 'government', label: 'Government / Semi-Government' },
    { value: 'multinational', label: 'Multinational Corporation (MNC)' },
  ];

  const industries = [
    { value: 'technology', label: 'Technology & Software' }
  ];

  const hiringVolumes = [
    { value: '1-5', label: '1-5 hires per month' },
    { value: '6-20', label: '6-20 hires per month' },
    { value: '21-50', label: '21-50 hires per month' },
    { value: '50+', label: '50+ hires per month' }
  ];

  const departments = [
    { value: 'hr', label: 'Human Resources' },
    { value: 'engineering', label: 'Engineering & Development' },
    { value: 'sales', label: 'Sales & Marketing' },
    { value: 'operations', label: 'Operations' },
    { value: 'finance', label: 'Finance & Accounting' },
    { value: 'executive', label: 'Executive Leadership' },
    { value: 'other', label: 'Other' }
  ];

  const currentYear = new Date().getFullYear();
  const establishedYears = Array.from({ length: 100 }, (_, i) => {
    const year = currentYear - i;
    return { value: year.toString(), label: year.toString() };
  });

  const locationFeedback = locationHelper?.targetField === 'companyLocation' ? locationHelper : null;
  const locationStatusClass = locationFeedback?.status === 'success'
    ? 'text-emerald-600 dark:text-emerald-400'
    : locationFeedback?.status === 'error'
      ? 'text-rose-500 dark:text-rose-400'
      : 'text-slate-500 dark:text-slate-400';
  const detectingForCompany = isDetectingLocation && locationHelper?.targetField === 'companyLocation';

  const logoUploadRef = React.useRef(null);
  const proofUploadRef = React.useRef(null);

  const formatFileSize = (bytes) => {
    if (!bytes || Number.isNaN(bytes)) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const size = bytes / (1024 ** exponent);
    return `${size.toFixed(size >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
  };

  const fileUploads = [
    {
      fieldKey: 'companyLogo',
      label: 'Company Logo',
      description: 'Upload an official logo so candidates can recognize your brand.',
      helper: 'SVG, PNG, JPG · Max 5 MB',
      icon: 'Building2',
      accept: 'image/*,.svg',
      inputRef: logoUploadRef,
      previewMode: 'image',
      required: true,
      onValidateFile: onModerateUpload ? (file) => onModerateUpload('companyLogo', file) : null,
      moderationState: uploadModeration?.companyLogo,
      onReset: onResetModeration ? () => onResetModeration('companyLogo') : null,
    },
    {
      fieldKey: 'companyProof',
      label: 'Business Verification Document',
      description: 'Provide proof of incorporation, tax certificate, or another legitimacy document.',
      helper: 'PDF, DOC, DOCX · Max 15 MB',
      icon: 'ShieldCheck',
      accept: '.pdf,.doc,.docx',
      inputRef: proofUploadRef,
      previewMode: 'document',
      required: true,
      onValidateFile: onModerateUpload
        ? (file) => onModerateUpload('companyProof', file, {
            metadata: {
              expectedCompanyName: formData?.companyName?.trim() || '',
              expectedCountry: formData?.companyLocation?.trim() || '',
            },
          })
        : null,
      moderationState: uploadModeration?.companyProof,
      onReset: onResetModeration ? () => onResetModeration('companyProof') : null,
    },
  ];

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
    const hasFile = Boolean(fileValue);
    const stateClass = error
      ? 'border-rose-400/70 bg-rose-50/60 dark:border-rose-500/60 dark:bg-rose-900/30'
      : hasFile
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

    const handleFileInputClick = () => {
      if (!inputRef?.current) return;
      inputRef.current.value = '';
      inputRef.current.click();
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

        {hasFile ? (
          <div className="mt-4 rounded-2xl border border-white/40 dark:border-slate-800/60 bg-white/80 dark:bg-slate-900/60 p-3 space-y-3">
            {isImagePreviewable && previewUrl && (
              <div className="flex self-center flex-col items-center gap-3">
                <div className="w-44 h-44 rounded-full overflow-hidden border-2 border-white/80 dark:border-slate-700/80 shadow-lg">
                  <img src={previewUrl} alt={`${label} preview`} className="w-full h-full object-contain" />
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
                onClick={handleFileInputClick}
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
              onClick={handleFileInputClick}
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
        {currentModeration?.status === 'approved' && hasFile && (
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Company Name"
          type="text"
          placeholder="Enter your company name"
          value={formData?.companyName}
          onChange={(e) => onFieldChange('companyName', e?.target?.value)}
          error={errors?.companyName}
          required
        />
        <Input
          label="Business Registration Number"
          type="text"
          placeholder="e.g., PV 12345"
          description="BR number for verification (optional)"
          value={formData?.businessRegistrationNumber}
          onChange={(e) => onFieldChange('businessRegistrationNumber', e?.target?.value)}
          error={errors?.businessRegistrationNumber}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select
          label="Company Type"
          placeholder="Select company type"
          options={companyTypes}
          value={formData?.companyType}
          onChange={(value) => onFieldChange('companyType', value)}
          error={errors?.companyType}
          required
        />
        <Select
          label="Company Size"
          placeholder="Select company size"
          options={companySizes}
          value={formData?.companySize}
          onChange={(value) => onFieldChange('companySize', value)}
          error={errors?.companySize}
          required
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        <Select
          label="Established Year"
          placeholder="Select year founded"
          options={establishedYears}
          value={formData?.establishedYear}
          onChange={(value) => onFieldChange('establishedYear', value)}
          error={errors?.establishedYear}
          searchable
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Job Title"
          type="text"
          placeholder="e.g., HR Manager, Talent Acquisition Lead"
          value={formData?.jobTitle}
          onChange={(e) => onFieldChange('jobTitle', e?.target?.value)}
          error={errors?.jobTitle}
          required
        />

        <Select
          label="Department"
          placeholder="Select your department"
          options={departments}
          value={formData?.department}
          onChange={(value) => onFieldChange('department', value)}
          error={errors?.department}
          required
        />
      </div>
      <Select
        label="Monthly Hiring Volume"
        placeholder="Select typical hiring volume"
        description="This helps us recommend the right plan for your needs"
        options={hiringVolumes}
        value={formData?.hiringVolume}
        onChange={(value) => onFieldChange('hiringVolume', value)}
        error={errors?.hiringVolume}
        required
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5 sm:space-y-2">
          <label className="text-sm font-medium leading-none text-foreground">
            Company Location
          </label>
          <div className="relative">
            <input
              type="text"
              value={detectingForCompany && locationFeedback?.message ? locationFeedback.message : formData?.companyLocation || ''}
              onChange={(e) => onFieldChange('companyLocation', e?.target?.value)}
              placeholder="e.g., Colombo, Sri Lanka"
              disabled={isDetectingLocation}
              className={`flex h-11 sm:h-12 w-full rounded-xl border bg-background px-3 sm:px-4 pr-[90px] sm:pr-[100px] py-2.5 text-base sm:text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 min-h-[44px] ${
                errors?.companyLocation ? 'border-destructive focus-visible:ring-destructive' : 'border-input'
              }`}
            />
            <button
              type="button"
              onClick={() => onDetectLocation?.('companyLocation')}
              disabled={isDetectingLocation}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {detectingForCompany ? (
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
          {errors?.companyLocation && (
            <p className="text-xs sm:text-sm text-destructive flex items-start gap-1.5">
              <Icon name="AlertCircle" size={12} className="mt-0.5 flex-shrink-0" />
              {errors.companyLocation}
            </p>
          )}
          {locationFeedback?.status === 'error' && locationFeedback?.message && !errors?.companyLocation && (
            <p className="text-xs sm:text-sm text-destructive flex items-start gap-1.5">
              <Icon name="AlertCircle" size={12} className="mt-0.5 flex-shrink-0" />
              {locationFeedback.message}
            </p>
          )}
        </div>

        <Input
          label="Phone Number"
          type="tel"
          placeholder="+94 XX XXX XXXX or 0XX XXX XXXX"
          description="For account verification"
          value={formData?.companyPhoneNumber}
          onChange={(e) => onFieldChange('companyPhoneNumber', e?.target?.value)}
          error={errors?.companyPhoneNumber}
        />
      </div>
      
      <Input
        label="Official Company Email"
        type="email"
        placeholder="info@yourcompany.com"
        description="Company's official contact email (optional)"
        value={formData?.companyEmail}
        onChange={(e) => onFieldChange('companyEmail', e?.target?.value)}
        error={errors?.companyEmail}
      />
      
      {/* Company Address */}
      <div className="space-y-1.5 sm:space-y-2">
        <label className="text-sm font-medium leading-none text-foreground">
          Physical Address
        </label>
        <textarea
          value={formData?.companyAddress || ''}
          onChange={(e) => onFieldChange('companyAddress', e?.target?.value)}
          placeholder="No.215, Nawala Road, Narahenpita, Colombo 05, Sri Lanka"
          rows={3}
          className={`flex w-full rounded-xl border bg-background px-3 sm:px-4 py-2.5 text-base sm:text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 resize-none ${
            errors?.companyAddress ? 'border-destructive focus-visible:ring-destructive' : 'border-input'
          }`}
        />
        {errors?.companyAddress && (
          <p className="text-xs sm:text-sm text-destructive flex items-start gap-1.5">
            <Icon name="AlertCircle" size={12} className="mt-0.5 flex-shrink-0" />
            {errors.companyAddress}
          </p>
        )}
        <p className="text-xs text-muted-foreground">Complete physical address of your company headquarters</p>
      </div>

      {/* Company Description */}
      <div className="space-y-1.5 sm:space-y-2">
        <label className="text-sm font-medium leading-none text-foreground">
          Company Description
        </label>
        <textarea
          value={formData?.companyDescription || ''}
          onChange={(e) => onFieldChange('companyDescription', e?.target?.value)}
          placeholder="Tell candidates about your company, its history, mission, products/services, and values..."
          rows={6}
          maxLength={2000}
          className={`flex w-full rounded-xl border bg-background px-3 sm:px-4 py-2.5 text-base sm:text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 resize-none ${
            errors?.companyDescription ? 'border-destructive focus-visible:ring-destructive' : 'border-input'
          }`}
        />
        <div className="flex items-center justify-between">
          {errors?.companyDescription && (
            <p className="text-xs sm:text-sm text-destructive flex items-start gap-1.5">
              <Icon name="AlertCircle" size={12} className="mt-0.5 flex-shrink-0" />
              {errors.companyDescription}
            </p>
          )}
          <p className="text-xs text-muted-foreground ml-auto">
            {(formData?.companyDescription || '').length}/2000 characters
          </p>
        </div>
        <p className="text-xs text-muted-foreground">This will be displayed on your company profile and job listings</p>
      </div>

      {/* Social Media Links */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-base font-semibold text-gray-900 dark:text-slate-100">
              Social Media
            </p>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Optional - Help candidates learn more about your company
            </p>
          </div>
          <div className="hidden md:flex w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-900/30 items-center justify-center text-blue-600 dark:text-blue-300">
            <Icon name="Share2" size={18} />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="Company Website"
            type="url"
            placeholder="https://www.yourcompany.com"
            value={formData?.companyWebsite || ''}
            onChange={(e) => onFieldChange('companyWebsite', e?.target?.value)}
            error={errors?.companyWebsite}
          />
          <Input
            label="Facebook Page URL"
            type="url"
            placeholder="https://www.facebook.com/yourcompany"
            value={formData?.facebookUrl || ''}
            onChange={(e) => onFieldChange('facebookUrl', e?.target?.value)}
            error={errors?.facebookUrl}
          />
          <Input
            label="LinkedIn Company Page"
            type="url"
            placeholder="https://www.linkedin.com/company/yourcompany"
            value={formData?.companyLinkedinUrl || ''}
            onChange={(e) => onFieldChange('companyLinkedinUrl', e?.target?.value)}
            error={errors?.companyLinkedinUrl}
          />
        </div>
      </div>

      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-base font-semibold text-gray-900 dark:text-slate-100">
              Company Verification
            </p>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Help us verify that you represent a legitimate organization.
            </p>
          </div>
          <div className="hidden md:flex w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-900/30 items-center justify-center text-blue-600 dark:text-blue-300">
            <Icon name="Briefcase" size={18} />
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

export default CompanyFields;
