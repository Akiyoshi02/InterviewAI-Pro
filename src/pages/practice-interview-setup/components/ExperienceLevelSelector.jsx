import React from 'react';
import Icon from '../../../components/AppIcon';

const ExperienceLevelSelector = ({ selectedLevel, onLevelChange, className = '' }) => {
  const experienceLevels = [
    {
      id: 'entry',
      title: 'Entry Level',
      subtitle: '0-2 years',
      description: 'Focus on fundamentals, learning ability, and basic technical concepts',
      icon: 'GraduationCap',
      color: 'bg-success'
    },
    {
      id: 'mid',
      title: 'Mid Level',
      subtitle: '2-5 years',
      description: 'Emphasis on practical experience, problem-solving, and project ownership',
      icon: 'TrendingUp',
      color: 'bg-primary'
    },
    {
      id: 'senior',
      title: 'Senior Level',
      subtitle: '5-10 years',
      description: 'Advanced technical skills, leadership, and system design capabilities',
      icon: 'Award',
      color: 'bg-secondary'
    },
    {
      id: 'executive',
      title: 'Executive',
      subtitle: '10+ years',
      description: 'Strategic thinking, team management, and high-level decision making',
      icon: 'Crown',
      color: 'bg-accent'
    }
  ];

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center space-x-3 mb-4">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <Icon name="BarChart3" size={20} className="text-white" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Experience Level</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {experienceLevels?.map((level) => (
          <button
            key={level?.id}
            onClick={() => onLevelChange(level?.id)}
            className={`p-5 rounded-2xl border-2 transition-all duration-200 text-left group hover:-translate-y-1 hover:shadow-lg ${
              selectedLevel === level?.id
                ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-500/10 shadow-md shadow-blue-500/20'
                : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-500 bg-white dark:bg-slate-800'
            }`}
          >
            <div className="flex items-start space-x-3">
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${level?.color === 'bg-success' ? 'from-emerald-500 to-teal-600' : level?.color === 'bg-primary' ? 'from-blue-600 to-purple-600' : level?.color === 'bg-secondary' ? 'from-purple-600 to-pink-600' : 'from-amber-500 to-orange-600'} flex items-center justify-center group-hover:scale-110 transition-transform duration-200 shadow-lg`}>
                <Icon name={level?.icon} size={20} color="white" />
              </div>
              
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <h4 className={`font-semibold ${
                    selectedLevel === level?.id ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-slate-100'
                  }`}>
                    {level?.title}
                  </h4>
                  <span className="text-sm text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-900/70 px-2 py-0.5 rounded-full">
                    {level?.subtitle}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-slate-400 leading-relaxed">
                  {level?.description}
                </p>
              </div>
              
              {selectedLevel === level?.id && (
                <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center">
                  <Icon name="CheckCircle" size={16} className="text-white" />
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ExperienceLevelSelector;