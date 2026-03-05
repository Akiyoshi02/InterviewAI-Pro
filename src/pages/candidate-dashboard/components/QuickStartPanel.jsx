import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';

const QuickStartPanel = ({ onStartPractice }) => {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('');

  const jobRoles = [
    { value: 'software-engineer', label: 'Software Engineer' },
    { value: 'frontend-developer', label: 'Frontend Engineer' },
    { value: 'backend-developer', label: 'Backend Engineer' },
    { value: 'fullstack-developer', label: 'Full Stack Engineer' },
    { value: 'devops-engineer', label: 'DevOps Engineer' },
    { value: 'qa-engineer', label: 'QA Engineer' }
  ];

  const difficultyLevels = [
    { value: 'beginner', label: 'Beginner', description: 'Basic questions for entry-level positions' },
    { value: 'intermediate', label: 'Intermediate', description: 'Moderate complexity for mid-level roles' },
    { value: 'advanced', label: 'Advanced', description: 'Challenging questions for senior positions' },
    { value: 'expert', label: 'Expert', description: 'Complex scenarios for leadership roles' }
  ];

  const handleStartPractice = () => {
    if (selectedRole && selectedDifficulty) {
      const payload = { role: selectedRole, difficulty: selectedDifficulty };
      if (typeof onStartPractice === 'function') {
        onStartPractice(payload);
        return;
      }

      const params = new URLSearchParams(payload);
      navigate(`/practice-interview-setup?${params.toString()}`);
    }
  };

  const isReadyToStart = selectedRole && selectedDifficulty;

  return (
    <div className="rounded-2xl border border-white/30 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4 sm:p-5 shadow-[0_20px_60px_rgba(15,23,42,0.12)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur">
      <div className="flex items-center space-x-2.5 mb-4 sm:mb-5">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
          <Icon name="Play" size={16} color="white" />
        </div>
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100">Quick Start Practice</h2>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 leading-relaxed">Begin your AI interview session</p>
        </div>
      </div>

      <div className="space-y-4 mb-5">
        <Select
          label="Job Role"
          placeholder="Select your target role"
          options={jobRoles}
          value={selectedRole}
          onChange={setSelectedRole}
          searchable
          required
        />

        <Select
          label="Difficulty Level"
          placeholder="Choose difficulty level"
          options={difficultyLevels}
          value={selectedDifficulty}
          onChange={setSelectedDifficulty}
          required
        />
      </div>

      <div className="space-y-3">
        <Button
          variant="default"
          fullWidth
          iconName="Play"
          iconPosition="left"
          onClick={handleStartPractice}
          disabled={!isReadyToStart}
          className="rounded-full bg-gradient-to-r from-blue-600 to-purple-600 border-none text-white shadow-md shadow-blue-500/30 hover:from-blue-700 hover:to-purple-700"
        >
          Start Practice Interview
        </Button>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            iconName="BookOpen"
            iconPosition="left"
            onClick={() => navigate('/practice-interview-setup')}
            className="rounded-full border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400"
          >
            Custom Setup
          </Button>
          <Button
            variant="ghost"
            iconName="History"
            iconPosition="left"
            onClick={() => navigate('/candidate-dashboard#recent-activity')}
            className="rounded-full text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
          >
            View History
          </Button>
        </div>
      </div>

      {/* Quick Tips */}
      <div className="mt-5 p-3.5 rounded-xl border border-white/40 dark:border-slate-700/50 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30">
        <div className="flex items-start space-x-2">
          <Icon name="Lightbulb" size={16} className="text-blue-600 dark:text-blue-400 mt-0.5" />
          <div>
            <div className="text-sm font-medium text-gray-900 dark:text-slate-100">Pro Tip</div>
            <div className="text-xs sm:text-sm text-gray-600 dark:text-slate-300 leading-relaxed">
              Practice regularly to improve your confidence and interview skills. Aim for 2-3 sessions per week.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuickStartPanel;
