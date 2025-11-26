import React from 'react';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';

const CandidateFields = ({ formData, onFieldChange, errors, className = '' }) => {
  const experienceLevels = [
    { value: 'entry', label: 'Entry Level (0-2 years)' },
    { value: 'mid', label: 'Mid Level (3-5 years)' },
    { value: 'senior', label: 'Senior Level (6-10 years)' },
    { value: 'lead', label: 'Lead/Principal (10+ years)' },
    { value: 'executive', label: 'Executive/C-Level' }
  ];

  const industries = [
    { value: 'technology', label: 'Technology & Software' },
    { value: 'finance', label: 'Finance & Banking' },
    { value: 'healthcare', label: 'Healthcare & Medical' },
    { value: 'education', label: 'Education & Training' },
    { value: 'marketing', label: 'Marketing & Advertising' },
    { value: 'sales', label: 'Sales & Business Development' },
    { value: 'consulting', label: 'Consulting & Professional Services' },
    { value: 'manufacturing', label: 'Manufacturing & Engineering' },
    { value: 'retail', label: 'Retail & E-commerce' },
    { value: 'other', label: 'Other' }
  ];

  const jobRoles = [
    { value: 'software-engineer', label: 'Software Engineer' },
    { value: 'data-scientist', label: 'Data Scientist' },
    { value: 'product-manager', label: 'Product Manager' },
    { value: 'designer', label: 'UX/UI Designer' },
    { value: 'marketing-manager', label: 'Marketing Manager' },
    { value: 'sales-representative', label: 'Sales Representative' },
    { value: 'business-analyst', label: 'Business Analyst' },
    { value: 'project-manager', label: 'Project Manager' },
    { value: 'consultant', label: 'Consultant' },
    { value: 'other', label: 'Other' }
  ];

  return (
    <div className={`space-y-4 ${className}`}>
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
        <Input
          label="Current Location"
          type="text"
          placeholder="e.g., San Francisco, CA"
          value={formData?.location}
          onChange={(e) => onFieldChange('location', e?.target?.value)}
          error={errors?.location}
        />

        <Select
          label="Preferred Interview Language"
          placeholder="Select language"
          options={[
            { value: 'english', label: 'English' },
            { value: 'spanish', label: 'Spanish' },
            { value: 'french', label: 'French' },
            { value: 'german', label: 'German' },
            { value: 'mandarin', label: 'Mandarin' }
          ]}
          value={formData?.preferredLanguage}
          onChange={(value) => onFieldChange('preferredLanguage', value)}
          error={errors?.preferredLanguage}
        />
      </div>
    </div>
  );
};

export default CandidateFields;