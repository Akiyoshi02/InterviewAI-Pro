import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Select from '../../../components/ui/Select';
import { Checkbox } from '../../../components/ui/Checkbox';
import Button from '../../../components/ui/Button';

const AdvancedSettings = ({ settings, onSettingsChange, className = '' }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const skillAreas = [
    { value: 'communication', label: 'Communication Skills' },
    { value: 'leadership', label: 'Leadership & Management' },
    { value: 'problem-solving', label: 'Problem Solving' },
    { value: 'teamwork', label: 'Teamwork & Collaboration' },
    { value: 'adaptability', label: 'Adaptability & Learning' },
    { value: 'technical-depth', label: 'Technical Depth' },
    { value: 'system-design', label: 'System Design' },
    { value: 'coding', label: 'Coding & Algorithms' },
    { value: 'project-management', label: 'Project Management' },
    { value: 'customer-focus', label: 'Customer Focus' }
  ];

  const handleSettingChange = (key, value) => {
    onSettingsChange({
      ...settings,
      [key]: value
    });
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Icon name="Settings2" size={20} className="text-white" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Advanced Settings</h3>
        </div>
        <Button
          variant="outline"
          size="sm"
          iconName={isExpanded ? "ChevronUp" : "ChevronDown"}
          iconPosition="right"
          onClick={() => setIsExpanded(!isExpanded)}
          className="rounded-full border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800"
        >
          {isExpanded ? 'Hide' : 'Show'} Options
        </Button>
      </div>
      {isExpanded && (
        <div className="space-y-6 border-2 border-gray-200 dark:border-slate-700 rounded-2xl p-6 bg-white/50 dark:bg-slate-900/50 backdrop-blur">
          {/* Skill Focus Areas */}
          <div className="space-y-3">
            <Select
              label="Skill Focus Areas"
              description="Select specific skills to emphasize during the interview"
              options={skillAreas}
              value={settings?.skillFocus || []}
              onChange={(value) => handleSettingChange('skillFocus', value)}
              placeholder="Choose skills to focus on..."
              multiple
              searchable
              clearable
            />
          </div>

          {/* Additional Options */}
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-900 dark:text-slate-100">Additional Options</h4>
            
            <div className="space-y-3">
              <Checkbox
                label="Enable real-time feedback"
                description="Get immediate hints and suggestions during the interview"
                checked={settings?.realTimeFeedback || false}
                onChange={(e) => handleSettingChange('realTimeFeedback', e?.target?.checked)}
              />
              
              <Checkbox
                label="Include follow-up questions"
                description="AI will ask clarifying questions based on your responses"
                checked={settings?.followUpQuestions ?? true}
                onChange={(e) => handleSettingChange('followUpQuestions', e?.target?.checked)}
              />
              
              <Checkbox
                label="Record session for review"
                description="Save audio/video for later analysis and improvement"
                checked={settings?.recordSession ?? true}
                onChange={(e) => handleSettingChange('recordSession', e?.target?.checked)}
              />
              
              <Checkbox
                label="Enable practice mode"
                description="Allow pausing and retrying questions during the session"
                checked={settings?.practiceMode || false}
                onChange={(e) => handleSettingChange('practiceMode', e?.target?.checked)}
              />
            </div>
          </div>

          {/* Difficulty Adjustment */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-gray-900 dark:text-slate-100">Question Difficulty</label>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => handleSettingChange('difficulty', 'easy')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                  settings?.difficulty === 'easy' 
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/30' 
                    : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
                }`}
              >
                Easy
              </button>
              <button
                onClick={() => handleSettingChange('difficulty', 'medium')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                  settings?.difficulty === 'medium' || !settings?.difficulty
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md shadow-blue-500/30' 
                    : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
                }`}
              >
                Medium
              </button>
              <button
                onClick={() => handleSettingChange('difficulty', 'hard')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                  settings?.difficulty === 'hard' 
                    ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-md shadow-red-500/30' 
                    : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
                }`}
              >
                Hard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedSettings;