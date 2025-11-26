import React from 'react';
import Icon from '../../../components/AppIcon';
import Select from '../../../components/ui/Select';

const IndustrySelector = ({ selectedIndustry, onIndustryChange, className = '' }) => {
  const industries = [
    { value: 'technology', label: 'Technology & Software' },
    { value: 'finance', label: 'Finance & Banking' },
    { value: 'healthcare', label: 'Healthcare & Medical' },
    { value: 'ecommerce', label: 'E-commerce & Retail' },
    { value: 'consulting', label: 'Consulting Services' },
    { value: 'education', label: 'Education & Training' },
    { value: 'manufacturing', label: 'Manufacturing & Industrial' },
    { value: 'media', label: 'Media & Entertainment' },
    { value: 'automotive', label: 'Automotive & Transportation' },
    { value: 'energy', label: 'Energy & Utilities' },
    { value: 'real-estate', label: 'Real Estate & Construction' },
    { value: 'telecommunications', label: 'Telecommunications' },
    { value: 'government', label: 'Government & Public Sector' },
    { value: 'nonprofit', label: 'Non-profit & NGO' },
    { value: 'startup', label: 'Startup & Entrepreneurship' },
    { value: 'other', label: 'Other Industry' }
  ];

  const getIndustryDescription = (industry) => {
    const descriptions = {
      'technology': 'Questions focus on innovation, scalability, and technical problem-solving',
      'finance': 'Emphasis on analytical thinking, risk management, and regulatory compliance',
      'healthcare': 'Patient-centered approach, ethical considerations, and safety protocols',
      'ecommerce': 'Customer experience, market dynamics, and digital transformation',
      'consulting': 'Client relationship management, strategic thinking, and communication skills',
      'education': 'Learning methodologies, student engagement, and educational technology',
      'manufacturing': 'Process optimization, quality control, and operational efficiency',
      'media': 'Creative thinking, audience engagement, and content strategy',
      'automotive': 'Innovation in mobility, sustainability, and manufacturing excellence',
      'energy': 'Sustainability, regulatory compliance, and technological advancement',
      'real-estate': 'Market analysis, client relations, and project management',
      'telecommunications': 'Network infrastructure, customer service, and technology adoption',
      'government': 'Public service, policy implementation, and stakeholder management',
      'nonprofit': 'Mission-driven work, community impact, and resource management',
      'startup': 'Agility, innovation, and rapid growth strategies',
      'other': 'General business principles and transferable skills'
    };
    return descriptions?.[industry] || '';
  };

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
                {getIndustryDescription(selectedIndustry)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IndustrySelector;