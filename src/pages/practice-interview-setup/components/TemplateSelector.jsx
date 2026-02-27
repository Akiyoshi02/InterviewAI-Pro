import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const PRESET_TEMPLATES = [
  {
    id: 'swe-behavioral',
    name: 'Software Engineer — Behavioral',
    description: 'STAR-based behavioral questions for engineering roles. Great for FAANG prep.',
    icon: 'Code2',
    color: 'from-blue-500 to-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-200 dark:border-blue-700/50',
    config: {
      jobRole: 'Software Engineer',
      experienceLevel: 'mid',
      industry: 'Technology',
      interviewTypes: ['behavioral'],
      sessionDuration: 30,
      advancedSettings: {
        skillFocus: ['Leadership', 'Problem Solving', 'Communication'],
        difficulty: 'medium',
        realTimeFeedback: true,
        followUpQuestions: true,
        recordSession: true,
        practiceMode: false,
        language: 'en',
      },
    },
  },
  {
    id: 'swe-technical',
    name: 'Software Engineer — Technical',
    description: 'System design and technical problem-solving for engineering interviews.',
    icon: 'Cpu',
    color: 'from-indigo-500 to-indigo-600',
    bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
    borderColor: 'border-indigo-200 dark:border-indigo-700/50',
    config: {
      jobRole: 'Software Engineer',
      experienceLevel: 'mid',
      industry: 'Technology',
      interviewTypes: ['technical'],
      sessionDuration: 45,
      advancedSettings: {
        skillFocus: ['System Design', 'Algorithms', 'Technical Communication'],
        difficulty: 'hard',
        realTimeFeedback: false,
        followUpQuestions: true,
        recordSession: true,
        practiceMode: false,
        language: 'en',
      },
    },
  },
  {
    id: 'ds-technical',
    name: 'Data Scientist — Technical',
    description: 'Statistics, ML concepts, and case study questions for data roles.',
    icon: 'BarChart2',
    color: 'from-purple-500 to-purple-600',
    bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    borderColor: 'border-purple-200 dark:border-purple-700/50',
    config: {
      jobRole: 'Data Scientist',
      experienceLevel: 'mid',
      industry: 'Technology',
      interviewTypes: ['technical', 'case-study'],
      sessionDuration: 40,
      advancedSettings: {
        skillFocus: ['Machine Learning', 'Statistics', 'Python'],
        difficulty: 'medium',
        realTimeFeedback: true,
        followUpQuestions: true,
        recordSession: true,
        practiceMode: false,
        language: 'en',
      },
    },
  },
  {
    id: 'pm-strategic',
    name: 'Product Manager — Strategic',
    description: 'Product sense, prioritization, and strategic thinking questions.',
    icon: 'Layers',
    color: 'from-emerald-500 to-emerald-600',
    bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
    borderColor: 'border-emerald-200 dark:border-emerald-700/50',
    config: {
      jobRole: 'Product Manager',
      experienceLevel: 'senior',
      industry: 'Technology',
      interviewTypes: ['behavioral', 'case-study'],
      sessionDuration: 35,
      advancedSettings: {
        skillFocus: ['Product Strategy', 'Prioritization', 'User Empathy'],
        difficulty: 'medium',
        realTimeFeedback: true,
        followUpQuestions: true,
        recordSession: true,
        practiceMode: false,
        language: 'en',
      },
    },
  },
  {
    id: 'ux-portfolio',
    name: 'UX Designer — Portfolio',
    description: 'Design process, case study presentation, and portfolio walkthrough.',
    icon: 'Palette',
    color: 'from-pink-500 to-pink-600',
    bgColor: 'bg-pink-50 dark:bg-pink-900/20',
    borderColor: 'border-pink-200 dark:border-pink-700/50',
    config: {
      jobRole: 'UX Designer',
      experienceLevel: 'mid',
      industry: 'Technology',
      interviewTypes: ['behavioral', 'case-study'],
      sessionDuration: 30,
      advancedSettings: {
        skillFocus: ['Design Process', 'User Research', 'Presentation'],
        difficulty: 'medium',
        realTimeFeedback: true,
        followUpQuestions: true,
        recordSession: true,
        practiceMode: false,
        language: 'en',
      },
    },
  },
  {
    id: 'mgt-leadership',
    name: 'Manager — Leadership',
    description: 'Leadership scenarios, team management, and executive communication.',
    icon: 'Users',
    color: 'from-amber-500 to-amber-600',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    borderColor: 'border-amber-200 dark:border-amber-700/50',
    config: {
      jobRole: 'Engineering Manager',
      experienceLevel: 'senior',
      industry: 'Technology',
      interviewTypes: ['behavioral'],
      sessionDuration: 30,
      advancedSettings: {
        skillFocus: ['Leadership', 'Team Management', 'Conflict Resolution'],
        difficulty: 'hard',
        realTimeFeedback: true,
        followUpQuestions: true,
        recordSession: true,
        practiceMode: false,
        language: 'en',
      },
    },
  },
];

const TemplateSelector = ({ onApplyTemplate, onClose }) => {
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState('all');

  const filters = [
    { id: 'all', label: 'All' },
    { id: 'behavioral', label: 'Behavioral' },
    { id: 'technical', label: 'Technical' },
    { id: 'case-study', label: 'Case Study' },
  ];

  const filteredTemplates = filter === 'all'
    ? PRESET_TEMPLATES
    : PRESET_TEMPLATES.filter((t) => t.config.interviewTypes.includes(filter));

  const handleApply = () => {
    const template = PRESET_TEMPLATES.find((t) => t.id === selectedId);
    if (template) onApplyTemplate(template.config, template.name);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100">Start from a Template</h3>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Choose a pre-built configuration to get started quickly</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 transition-colors">
            <Icon name="X" size={18} />
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === f.id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Template Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
        {filteredTemplates.map((template) => (
          <button
            key={template.id}
            onClick={() => setSelectedId(template.id === selectedId ? null : template.id)}
            className={`text-left p-4 rounded-xl border-2 transition-all duration-150 ${
              selectedId === template.id
                ? `border-blue-500 ${template.bgColor} shadow-md`
                : `${template.borderColor} ${template.bgColor} hover:border-blue-300 dark:hover:border-blue-600`
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg bg-gradient-to-br ${template.color} text-white shrink-0`}>
                <Icon name={template.icon} size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate">{template.name}</p>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 line-clamp-2">{template.description}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {template.config.interviewTypes.map((type) => (
                    <span key={type} className="px-1.5 py-0.5 rounded text-xs bg-white/60 dark:bg-slate-700/60 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-600">
                      {type}
                    </span>
                  ))}
                  <span className="px-1.5 py-0.5 rounded text-xs bg-white/60 dark:bg-slate-700/60 text-gray-500 dark:text-slate-400 border border-gray-200 dark:border-slate-600">
                    {template.config.sessionDuration}m
                  </span>
                </div>
              </div>
              {selectedId === template.id && (
                <div className="shrink-0 h-5 w-5 rounded-full bg-blue-600 flex items-center justify-center">
                  <Icon name="Check" size={12} color="white" />
                </div>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Apply Button */}
      <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100 dark:border-slate-700">
        {onClose && (
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        )}
        <Button
          variant="primary"
          size="sm"
          disabled={!selectedId}
          onClick={handleApply}
          iconName="Zap"
          iconPosition="left"
        >
          Use Template
        </Button>
      </div>
    </div>
  );
};

export { PRESET_TEMPLATES };
export default TemplateSelector;
