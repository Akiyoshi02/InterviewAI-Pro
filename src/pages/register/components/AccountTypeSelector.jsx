import React from 'react';
import Icon from '../../../components/AppIcon';

// Reuse the same visual language as the Sign In "I am signing in as" selector
const AccountTypeSelector = ({ selectedType, onTypeChange, className = '' }) => {
  const accountTypes = [
    {
      type: 'candidate',
      title: 'Job Seeker',
      description: 'Practice interviews and improve your skills',
      icon: 'User',
      highlightColor:
        'border-blue-500/60 bg-blue-50 text-blue-700 shadow-[0_10px_30px_rgba(59,130,246,0.25)]',
      iconBg: 'bg-blue-600',
      bulletColor: 'text-emerald-500',
      features: ['AI-powered practice sessions', 'Performance analytics']
    },
    {
      type: 'company',
      title: 'Employer',
      description: 'Conduct standardized AI interviews',
      icon: 'Building',
      highlightColor:
        'border-purple-500/60 bg-purple-50 text-purple-700 shadow-[0_10px_30px_rgba(147,51,234,0.25)]',
      iconBg: 'bg-purple-600',
      bulletColor: 'text-cyan-500',
      features: ['Candidate screening', 'Custom interview templates']
    }
  ];

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="text-center">
        <h3 className="text-sm md:text-base font-semibold text-gray-900 dark:text-slate-100 mb-1">
          Choose Your Account Type
        </h3>
        <p className="text-xs md:text-sm text-gray-500 dark:text-slate-400">
          Select how you plan to use InterviewAI Pro
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3">
        {accountTypes.map((type) => {
          const isSelected = selectedType === type.type;
          return (
            <button
              key={type.type}
              type="button"
              onClick={() => onTypeChange(type.type)}
              className={`p-3 md:p-4 rounded-2xl border transition-all duration-200 min-w-0 text-left ${
                isSelected
                  ? type.highlightColor.includes('blue') 
                    ? 'border-blue-500/60 dark:border-blue-500/60 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 shadow-[0_10px_30px_rgba(59,130,246,0.25)]'
                    : 'border-purple-500/60 dark:border-purple-500/60 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 shadow-[0_10px_30px_rgba(147,51,234,0.25)]'
                  : 'border-white/40 dark:border-slate-700/50 bg-white/70 dark:bg-slate-800/70 text-gray-500 dark:text-slate-400 hover:border-blue-200 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400'
              }`}
            >
              <div className="flex flex-col space-y-2">
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-9 h-9 md:w-10 md:h-10 rounded-2xl flex items-center justify-center text-white ${
                      isSelected ? type.iconBg : 'bg-slate-900/80'
                    }`}
                  >
                    <Icon name={type.icon} size={18} className="text-current" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{type.title}</div>
                    <p className="text-[11px] md:text-xs opacity-80">{type.description}</p>
                  </div>
                </div>

                <ul className="space-y-1 mt-1">
                  {type.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-center space-x-1 text-[10px] md:text-xs opacity-80"
                    >
                      <Icon
                        name="Check"
                        size={10}
                        className={isSelected ? type.bulletColor : 'text-emerald-500'}
                      />
                      <span className="truncate">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default AccountTypeSelector;