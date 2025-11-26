import React from 'react';
import Icon from '../../../components/AppIcon';

const SessionDurationSelector = ({ selectedDuration, onDurationChange, className = '' }) => {
  const durationOptions = [
    {
      id: 15,
      title: '15 Minutes',
      subtitle: 'Quick Practice',
      description: 'Perfect for focused skill practice',
      questionCount: '4-6 questions',
      icon: 'Clock3',
      color: 'bg-success'
    },
    {
      id: 30,
      title: '30 Minutes',
      subtitle: 'Standard Session',
      description: 'Comprehensive interview simulation',
      questionCount: '8-12 questions',
      icon: 'Clock6',
      color: 'bg-primary'
    },
    {
      id: 45,
      title: '45 Minutes',
      subtitle: 'Extended Practice',
      description: 'In-depth preparation with detailed feedback',
      questionCount: '12-18 questions',
      icon: 'Clock9',
      color: 'bg-secondary'
    }
  ];

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center space-x-3 mb-4">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <Icon name="Timer" size={20} className="text-white" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Session Duration</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {durationOptions?.map((option) => (
          <button
            key={option?.id}
            onClick={() => onDurationChange(option?.id)}
            className={`p-5 rounded-2xl border-2 transition-all duration-200 text-center group hover:-translate-y-1 hover:shadow-lg ${
              selectedDuration === option?.id
                ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-500/10 shadow-md shadow-blue-500/20'
                : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-500 bg-white dark:bg-slate-800'
            }`}
          >
            <div className="space-y-3">
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${option?.color === 'bg-success' ? 'from-emerald-500 to-teal-600' : option?.color === 'bg-primary' ? 'from-blue-600 to-purple-600' : 'from-purple-600 to-pink-600'} flex items-center justify-center mx-auto group-hover:scale-110 transition-transform duration-200 shadow-lg`}>
                <Icon name={option?.icon} size={24} color="white" />
              </div>
              
              <div>
                <h4 className={`font-semibold mb-1 ${
                  selectedDuration === option?.id ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-slate-100'
                }`}>
                  {option?.title}
                </h4>
                <p className="text-sm text-gray-600 dark:text-slate-400 mb-2">
                  {option?.subtitle}
                </p>
                <p className="text-xs text-gray-500 dark:text-slate-500 mb-2">
                  {option?.description}
                </p>
                <div className="inline-flex items-center space-x-1 bg-gray-100 dark:bg-slate-900/70 rounded-full px-3 py-1">
                  <Icon name="MessageCircle" size={12} className="text-gray-500 dark:text-slate-400" />
                  <span className="text-xs font-medium text-gray-700 dark:text-slate-200">
                    {option?.questionCount}
                  </span>
                </div>
              </div>
              
              {selectedDuration === option?.id && (
                <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center mx-auto">
                  <Icon name="CheckCircle" size={16} className="text-white" />
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
      {selectedDuration && (
        <div className="rounded-2xl border border-blue-200 dark:border-blue-500/60 bg-blue-50/50 dark:bg-blue-500/10 p-4 backdrop-blur">
          <div className="flex items-center space-x-2 mb-3">
            <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center">
              <Icon name="Info" size={14} className="text-white" />
            </div>
            <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
              Session Overview
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 text-xs text-gray-600 dark:text-slate-400">
            <div>
              <span className="font-semibold text-gray-900 dark:text-slate-100">Duration:</span> {selectedDuration} minutes
            </div>
            <div>
              <span className="font-semibold text-gray-900 dark:text-slate-100">Questions:</span> {
                durationOptions?.find(opt => opt?.id === selectedDuration)?.questionCount
              }
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionDurationSelector;