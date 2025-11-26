import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const CandidatePipeline = ({ onCandidateMove, onBulkAction }) => {
  const [selectedCandidates, setSelectedCandidates] = useState([]);

  const pipelineStages = [
  {
    id: 'applied',
    title: 'Applied',
    count: 24,
    color: 'bg-slate-300',
    candidates: [
    { id: 1, name: 'Sarah Johnson', position: 'Frontend Developer', avatar: "https://images.unsplash.com/photo-1706565029071-f8f70ce91e71", avatarAlt: 'Professional headshot of woman with brown hair in white blazer' },
    { id: 2, name: 'Michael Chen', position: 'Backend Developer', avatar: "https://images.unsplash.com/photo-1629272039203-7d76fdaf1324", avatarAlt: 'Professional headshot of Asian man with black hair in navy suit' },
    { id: 3, name: 'Emily Rodriguez', position: 'UX Designer', avatar: "https://images.unsplash.com/photo-1510975866110-51c411b08b0b", avatarAlt: 'Professional headshot of Hispanic woman with long dark hair in blue shirt' }]

  },
  {
    id: 'screening',
    title: 'AI Screening',
    count: 12,
    color: 'bg-blue-400',
    candidates: [
    { id: 4, name: 'David Wilson', position: 'Full Stack Developer', avatar: "https://images.unsplash.com/photo-1585066047759-3438c34cf676", avatarAlt: 'Professional headshot of man with beard in gray suit' },
    { id: 5, name: 'Lisa Thompson', position: 'Product Manager', avatar: "https://images.unsplash.com/photo-1553984658-2b507d7bb3d9", avatarAlt: 'Professional headshot of blonde woman in black blazer' }]

  },
  {
    id: 'interview',
    title: 'Interview',
    count: 8,
    color: 'bg-purple-400',
    candidates: [
    { id: 6, name: 'James Anderson', position: 'DevOps Engineer', avatar: "https://images.unsplash.com/photo-1723607528434-21cde67167c4", avatarAlt: 'Professional headshot of man with short brown hair in white shirt' },
    { id: 7, name: 'Maria Garcia', position: 'Data Scientist', avatar: "https://images.unsplash.com/photo-1734456611474-13245d164868", avatarAlt: 'Professional headshot of woman with dark hair in professional attire' }]

  },
  {
    id: 'final',
    title: 'Final Review',
    count: 3,
    color: 'bg-emerald-400',
    candidates: [
    { id: 8, name: 'Robert Kim', position: 'Senior Developer', avatar: "https://images.unsplash.com/photo-1687256457585-3608dfa736c5", avatarAlt: 'Professional headshot of Asian man with glasses in dark suit' }]

  }];


  const handleCandidateSelect = (candidateId) => {
    setSelectedCandidates((prev) =>
    prev?.includes(candidateId) ?
    prev?.filter((id) => id !== candidateId) :
    [...prev, candidateId]
    );
  };

  const handleBulkAction = (action) => {
    if (selectedCandidates?.length > 0) {
      onBulkAction?.(action, selectedCandidates);
      setSelectedCandidates([]);
    }
  };

  return (
    <div className="rounded-3xl border border-white/30 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-6 shadow-[0_25px_70px_rgba(15,23,42,0.12)] dark:shadow-[0_25px_70px_rgba(0,0,0,0.4)] backdrop-blur">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">Candidate Pipeline</h2>
        
        {selectedCandidates?.length > 0 &&
        <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500 dark:text-slate-400">
              {selectedCandidates?.length} selected
            </span>
            <Button
            variant="outline"
            size="sm"
            iconName="Mail"
            iconPosition="left"
            onClick={() => handleBulkAction('email')}
            className="rounded-full border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400"
          >
              Email
            </Button>
            <Button
            variant="outline"
            size="sm"
            iconName="ArrowRight"
            iconPosition="left"
            onClick={() => handleBulkAction('move')}
            className="rounded-full border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400"
          >
              Move Stage
            </Button>
          </div>
        }
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {pipelineStages?.map((stage) =>
        <div key={stage?.id} className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 ${stage?.color} rounded-full`}></div>
                <h3 className="font-medium text-gray-900 dark:text-slate-100">{stage?.title}</h3>
              </div>
              <span className="text-sm font-medium text-gray-600 dark:text-slate-400 bg-white/70 dark:bg-slate-800/70 border border-white/40 dark:border-slate-700/50 px-2 py-1 rounded-full">
                {stage?.count}
              </span>
            </div>

            <div className="space-y-3 min-h-[200px] rounded-2xl border border-white/30 dark:border-slate-700/50 bg-white/60 dark:bg-slate-800/60 p-3">
              {stage?.candidates?.map((candidate) =>
            <div
              key={candidate?.id}
              className={`rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-3 cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_15px_50px_rgba(15,23,42,0.15)] dark:hover:shadow-[0_15px_50px_rgba(0,0,0,0.3)] ${
              selectedCandidates?.includes(candidate?.id) ? 'ring-2 ring-blue-500/70' : ''}`
              }
              onClick={() => handleCandidateSelect(candidate?.id)}>

                  <div className="flex items-center space-x-3">
                    <img
                  src={candidate?.avatar}
                  alt={candidate?.avatarAlt}
                  className="w-8 h-8 rounded-full object-cover" />

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                        {candidate?.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
                        {candidate?.position}
                      </p>
                    </div>
                    <Icon
                  name="MoreVertical"
                  size={16}
                  className="text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300" />

                  </div>
                </div>
            )}
            </div>
          </div>
        )}
      </div>
    </div>);

};

export default CandidatePipeline;