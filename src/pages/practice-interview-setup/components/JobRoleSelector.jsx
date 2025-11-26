import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Select from '../../../components/ui/Select';
import Input from '../../../components/ui/Input';

const JobRoleSelector = ({ selectedRole, onRoleChange, className = '' }) => {
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customRole, setCustomRole] = useState('');

  const popularRoles = [
    { value: 'biotechnology', label: 'Biotechnology' },
    { value: 'software-engineer', label: 'Software Engineer' },
    { value: 'frontend-developer', label: 'Frontend Developer' },
    { value: 'backend-developer', label: 'Backend Developer' },
    { value: 'fullstack-developer', label: 'Full Stack Developer' },
    { value: 'data-scientist', label: 'Data Scientist' },
    { value: 'product-manager', label: 'Product Manager' },
    { value: 'ui-ux-designer', label: 'UI/UX Designer' },
    { value: 'devops-engineer', label: 'DevOps Engineer' },
    { value: 'qa-engineer', label: 'QA Engineer' },
    { value: 'business-analyst', label: 'Business Analyst' },
    { value: 'project-manager', label: 'Project Manager' },
    { value: 'marketing-manager', label: 'Marketing Manager' },
    { value: 'sales-representative', label: 'Sales Representative' },
    { value: 'hr-specialist', label: 'HR Specialist' },
    { value: 'financial-analyst', label: 'Financial Analyst' },
    { value: 'custom', label: 'Other (Specify)' }
  ];

  const handleRoleSelect = (value) => {
    if (value === 'custom') {
      setShowCustomInput(true);
      onRoleChange('');
    } else {
      setShowCustomInput(false);
      setCustomRole('');
      onRoleChange(value);
    }
  };

  const handleCustomRoleChange = (e) => {
    const value = e?.target?.value;
    setCustomRole(value);
    onRoleChange(value);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center space-x-3 mb-4">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <Icon name="Briefcase" size={20} className="text-white" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Job Role</h3>
      </div>
      <Select
        label="Select your target job role"
        description="Choose the position you're preparing for"
        options={popularRoles}
        value={showCustomInput ? 'custom' : selectedRole}
        onChange={handleRoleSelect}
        placeholder="Search for a job role..."
        searchable
        required
      />
      {showCustomInput && (
        <Input
          label="Custom Job Role"
          type="text"
          placeholder="Enter your specific job role"
          value={customRole}
          onChange={handleCustomRoleChange}
          description="Be specific about the role you're targeting"
          required
        />
      )}
      {selectedRole && selectedRole !== 'custom' && (
        <div className="rounded-2xl border border-blue-200 dark:border-blue-500/60 bg-blue-50/50 dark:bg-blue-500/10 p-4 backdrop-blur">
          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Icon name="Info" size={14} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-1">
                Interview Focus for {popularRoles?.find(r => r?.value === selectedRole)?.label}
              </p>
              <p className="text-xs text-gray-600 dark:text-slate-400">
                Questions will be tailored to assess technical skills, problem-solving abilities, and role-specific competencies relevant to this position.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobRoleSelector;