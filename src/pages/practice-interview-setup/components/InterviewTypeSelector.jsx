import React from 'react';
import Icon from '../../../components/AppIcon';
import { Checkbox } from '../../../components/ui/Checkbox';

const InterviewTypeSelector = ({ selectedTypes, onTypesChange, className = '' }) => {
  const interviewTypes = [
    {
      id: 'behavioral',
      title: 'Behavioral Questions',
      description: 'STAR method scenarios, past experiences, and soft skills assessment',
      icon: 'Users',
      examples: ['Tell me about a time you overcame a challenge', 'Describe your leadership style']
    },
    {
      id: 'technical',
      title: 'Technical Questions',
      description: 'Role-specific technical knowledge, problem-solving, and coding challenges',
      icon: 'Code',
      examples: ['Explain REST API design principles', 'Write a function to reverse a string']
    },
    {
      id: 'situational',
      title: 'Situational Questions',
      description: 'Hypothetical scenarios, decision-making, and problem-solving approaches',
      icon: 'Lightbulb',
      examples: ['How would you handle a difficult client?', 'What would you do if a project deadline was at risk?']
    }
  ];

  const handleTypeToggle = (typeId) => {
    const newTypes = selectedTypes?.includes(typeId)
      ? selectedTypes?.filter(id => id !== typeId)
      : [...selectedTypes, typeId];
    onTypesChange(newTypes);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center space-x-3 mb-4">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <Icon name="MessageSquare" size={20} className="text-white" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Interview Types</h3>
        <span className="text-sm text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-900/70 px-2 py-1 rounded-full">(Select multiple)</span>
      </div>
      <div className="space-y-4">
        {interviewTypes?.map((type) => (
            <div
            key={type?.id}
            className={`border-2 rounded-2xl p-5 transition-all duration-200 hover:-translate-y-1 ${
              selectedTypes?.includes(type?.id)
                ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-500/10 shadow-md shadow-blue-500/20' : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-500 bg-white dark:bg-slate-800'
            }`}
          >
            <div className="flex items-start space-x-3">
              <Checkbox
                checked={selectedTypes?.includes(type?.id)}
                onChange={() => handleTypeToggle(type?.id)}
                className="mt-1"
              />
              
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
                    <Icon name={type?.icon} size={16} className="text-white" />
                  </div>
                  <h4 className="font-semibold text-gray-900 dark:text-slate-100">{type?.title}</h4>
                </div>
                
                <p className="text-sm text-gray-600 dark:text-slate-400 mb-3">
                  {type?.description}
                </p>
                
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-gray-900 dark:text-slate-100">Example Questions:</p>
                  {type?.examples?.map((example, index) => (
                    <p key={index} className="text-xs text-gray-600 dark:text-slate-400 pl-3 border-l-2 border-blue-200 dark:border-blue-500/40">
                      • {example}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      {selectedTypes?.length === 0 && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-500/60 bg-amber-50/50 dark:bg-amber-500/10 p-4 backdrop-blur">
          <div className="flex items-center space-x-2">
          <div className="w-6 h-6 rounded-lg bg-amber-500 flex items-center justify-center">
              <Icon name="AlertTriangle" size={14} className="text-white" />
          </div>
          <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
              Please select at least one interview type to continue
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default InterviewTypeSelector;