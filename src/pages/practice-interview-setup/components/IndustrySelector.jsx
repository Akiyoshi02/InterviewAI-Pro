import React from 'react';
import Icon from '../../../components/AppIcon';
import Select from '../../../components/ui/Select';

const IndustrySelector = ({ selectedIndustry, onIndustryChange, className = '' }) => {
  const industries = [
    { value: 'technology', label: 'Technology & Software' }
  ];

  const technologyDescription = 'Questions stay focused on building scalable systems, software craftsmanship, and collaborative engineering practices.';

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center space-x-3 mb-4">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <Icon name="Building2" size={20} className="text-white" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Industry</h3>
      </div>

      <Select
        label="Select your target industry"
        description="Industry context helps tailor questions to relevant scenarios"
        options={industries}
        value={selectedIndustry}
        onChange={onIndustryChange}
        placeholder="Choose an industry..."
        searchable
        required
      />

      {selectedIndustry && (
        <div className="rounded-2xl border border-blue-200 dark:border-blue-500/60 bg-blue-50/50 dark:bg-blue-500/10 p-4 backdrop-blur">
          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Icon name="Target" size={14} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-1">
                Industry Focus
              </p>
              <p className="text-xs text-gray-600 dark:text-slate-400">
                {technologyDescription}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IndustrySelector;