import React from 'react';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';

const CompanyFields = ({ formData, onFieldChange, errors, className = '' }) => {
  const companySizes = [
    { value: '1-10', label: '1-10 employees (Startup)' },
    { value: '11-50', label: '11-50 employees (Small)' },
    { value: '51-200', label: '51-200 employees (Medium)' },
    { value: '201-1000', label: '201-1000 employees (Large)' },
    { value: '1000+', label: '1000+ employees (Enterprise)' }
  ];

  const industries = [
    { value: 'technology', label: 'Technology & Software' },
    { value: 'finance', label: 'Finance & Banking' },
    { value: 'healthcare', label: 'Healthcare & Medical' },
    { value: 'education', label: 'Education & Training' },
    { value: 'consulting', label: 'Consulting & Professional Services' },
    { value: 'manufacturing', label: 'Manufacturing & Engineering' },
    { value: 'retail', label: 'Retail & E-commerce' },
    { value: 'media', label: 'Media & Entertainment' },
    { value: 'nonprofit', label: 'Non-profit & Government' },
    { value: 'other', label: 'Other' }
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

  return (
    <div className={`space-y-4 ${className}`}>
      <Input
        label="Company Name"
        type="text"
        placeholder="Enter your company name"
        value={formData?.companyName}
        onChange={(e) => onFieldChange('companyName', e?.target?.value)}
        error={errors?.companyName}
        required
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select
          label="Company Size"
          placeholder="Select company size"
          options={companySizes}
          value={formData?.companySize}
          onChange={(value) => onFieldChange('companySize', value)}
          error={errors?.companySize}
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
      <Input
        label="Company Website"
        type="url"
        placeholder="https://www.yourcompany.com"
        description="Optional - helps us verify your company"
        value={formData?.companyWebsite}
        onChange={(e) => onFieldChange('companyWebsite', e?.target?.value)}
        error={errors?.companyWebsite}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Company Location"
          type="text"
          placeholder="e.g., San Francisco, CA"
          value={formData?.companyLocation}
          onChange={(e) => onFieldChange('companyLocation', e?.target?.value)}
          error={errors?.companyLocation}
        />

        <Input
          label="Phone Number"
          type="tel"
          placeholder="+1 (555) 123-4567"
          description="For account verification"
          value={formData?.phoneNumber}
          onChange={(e) => onFieldChange('phoneNumber', e?.target?.value)}
          error={errors?.phoneNumber}
        />
      </div>
    </div>
  );
};

export default CompanyFields;