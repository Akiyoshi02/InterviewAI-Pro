import React from 'react';
import Icon from '../../../components/AppIcon';
import Select from '../../../components/ui/Select';

const JobRoleSelector = ({ selectedRole, onRoleChange, className = '' }) => {
  const softwareRoles = [
    { value: 'software-engineer', label: 'Software Engineer' },
    { value: 'frontend-developer', label: 'Frontend Engineer' },
    { value: 'backend-developer', label: 'Backend Engineer' },
    { value: 'fullstack-developer', label: 'Full Stack Engineer' },
    { value: 'devops-engineer', label: 'DevOps Engineer' },
    { value: 'qa-engineer', label: 'QA Engineer' }
  ];

  const selectedRoleLabel = softwareRoles.find((role) => role.value === selectedRole)?.label;

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
        description="Choose the software engineering position you're preparing for"
        options={softwareRoles}
        value={selectedRole}
        onChange={onRoleChange}
        placeholder="Search for a software engineering role..."
        searchable
        required
      />
      {selectedRole && (
        <div className="rounded-2xl border border-blue-200 dark:border-blue-500/60 bg-blue-50/50 dark:bg-blue-500/10 p-4 backdrop-blur">
          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Icon name="Info" size={14} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-1">
                Interview Focus for {selectedRoleLabel || 'Software Engineering Role'}
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