import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';

const CandidateTable = ({ interviews = [], onViewRecording, onViewAnalysis, onUpdateStatus }) => {
  const [sortBy, setSortBy] = useState('date');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPosition, setFilterPosition] = useState('all');

  // Use provided interviews or fallback to demo data
  const candidates = interviews.length > 0 ? interviews.map((interview, idx) => ({
    id: interview.id || idx,
    name: interview.candidate?.fullName || 'Candidate',
    email: interview.candidate?.email || '',
    position: interview.jobRole || 'Position',
    interviewDate: interview.scheduledFor ? new Date(interview.scheduledFor).toLocaleDateString() : 'TBD',
    aiScore: interview.overallScore || Math.floor(Math.random() * 20) + 80,
    status: interview.status?.toLowerCase() || 'completed',
    avatar: interview.candidate?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(interview.candidate?.fullName || 'C')}&background=6366f1&color=fff`,
    duration: interview.duration ? `${Math.round(interview.duration / 60)} min` : '—',
    experience: '—'
  })) : [
    {
      id: 1,
      name: 'Sarah Johnson',
      email: 'sarah.johnson@email.com',
      position: 'Frontend Developer',
      interviewDate: '2025-10-30',
      aiScore: 92,
      status: 'completed',
      avatar: "https://images.unsplash.com/photo-1706565029071-f8f70ce91e71",
      avatarAlt: 'Professional headshot of woman with brown hair in white blazer',
      duration: '45 min',
      experience: '3 years'
    },
    {
      id: 2,
      name: 'Michael Chen',
      email: 'michael.chen@email.com',
      position: 'Backend Developer',
      interviewDate: '2025-10-29',
      aiScore: 88,
      status: 'under_review',
      avatar: "https://images.unsplash.com/photo-1629272039203-7d76fdaf1324",
      avatarAlt: 'Professional headshot of Asian man with black hair in navy suit',
      duration: '52 min',
      experience: '5 years'
    },
    {
      id: 3,
      name: 'Emily Rodriguez',
      email: 'emily.rodriguez@email.com',
      position: 'UX Designer',
      interviewDate: '2025-10-28',
      aiScore: 95,
      status: 'approved',
      avatar: "https://images.unsplash.com/photo-1510975866110-51c411b08b0b",
      avatarAlt: 'Professional headshot of Hispanic woman with long dark hair in blue shirt',
      duration: '38 min',
      experience: '4 years'
    },
    {
      id: 4,
      name: 'David Wilson',
      email: 'david.wilson@email.com',
      position: 'Full Stack Developer',
      interviewDate: '2025-10-27',
      aiScore: 85,
      status: 'rejected',
      avatar: "https://images.unsplash.com/photo-1585066047759-3438c34cf676",
      avatarAlt: 'Professional headshot of man with beard in gray suit',
      duration: '41 min',
      experience: '2 years'
    },
    {
      id: 5,
      name: 'Lisa Thompson',
      email: 'lisa.thompson@email.com',
      position: 'Product Manager',
      interviewDate: '2025-10-26',
      aiScore: 90,
      status: 'completed',
      avatar: "https://images.unsplash.com/photo-1553984658-2b507d7bb3d9",
      avatarAlt: 'Professional headshot of blonde woman in black blazer',
      duration: '48 min',
      experience: '6 years'
    }
  ];


  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'completed', label: 'Completed' },
    { value: 'under_review', label: 'Under Review' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' }
  ];


  const positionOptions = [
    { value: 'all', label: 'All Positions' },
    { value: 'frontend', label: 'Frontend Developer' },
    { value: 'backend', label: 'Backend Developer' },
    { value: 'fullstack', label: 'Full Stack Developer' },
    { value: 'ux', label: 'UX Designer' },
    { value: 'pm', label: 'Product Manager' }
  ];


  const getStatusBadge = (status) => {
    const statusConfig = {
      completed: { color: 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow shadow-blue-500/20', label: 'Completed' },
      under_review: { color: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow shadow-amber-500/20', label: 'Under Review' },
      approved: { color: 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow shadow-emerald-500/20', label: 'Approved' },
      rejected: { color: 'bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow shadow-rose-500/20', label: 'Rejected' }
    };

    const config = statusConfig?.[status] || statusConfig?.completed;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config?.color}`}>
        {config?.label}
      </span>
    );
  };

  const getScoreColor = (score) => {
    if (score >= 90) return 'text-emerald-600';
    if (score >= 80) return 'text-amber-500';
    return 'text-rose-500';
  };

  return (
    <div className="rounded-2xl border border-white/30 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-3 sm:p-4 shadow-[0_20px_60px_rgba(15,23,42,0.12)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-3 sm:mb-4 space-y-3 lg:space-y-0">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100">Recent Interviews</h2>
        
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
          <Select
            placeholder="Filter by status"
            options={statusOptions}
            value={filterStatus}
            onChange={setFilterStatus}
            className="w-full sm:w-40"
          />

          <Select
            placeholder="Filter by position"
            options={positionOptions}
            value={filterPosition}
            onChange={setFilterPosition}
            className="w-full sm:w-48"
          />

          <Button
            variant="outline"
            iconName="Download"
            iconPosition="left"
            className="w-full sm:w-auto rounded-full border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400"
          >
            Export
          </Button>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/30 dark:border-slate-700 text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400">
              <th className="text-left py-3 px-4 font-medium">Candidate</th>
              <th className="text-center py-3 px-4 font-medium">Position</th>
              <th className="text-left py-3 px-4 font-medium">Interview Date</th>
              <th className="text-center py-3 px-4 font-medium">AI Score</th>
              <th className="text-center py-3 px-4 font-medium">Status</th>
              <th className="text-center py-3 px-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {candidates?.map((candidate) => (
              <tr key={candidate?.id} className="border-b border-white/20 dark:border-slate-700/50 hover:bg-white/60 dark:hover:bg-slate-800/60 transition-colors duration-200">
                <td className="py-4 px-4">
                  <div className="flex items-center space-x-3">
                    <img
                      src={candidate?.avatar}
                      alt={candidate?.avatarAlt}
                      className="w-10 h-10 rounded-full object-cover"
                    />

                    <div>
                      <p className="font-medium text-gray-900 dark:text-slate-100">{candidate?.name}</p>
                      <p className="text-sm text-gray-500 dark:text-slate-400">{candidate?.email}</p>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-4">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-slate-100">{candidate?.position}</p>
                    <p className="text-sm text-gray-500 dark:text-slate-400">{candidate?.experience} experience</p>
                  </div>
                </td>
                <td className="py-4 px-4">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-slate-100">{candidate?.interviewDate}</p>
                    <p className="text-sm text-gray-500 dark:text-slate-400">{candidate?.duration}</p>
                  </div>
                </td>
                <td className="py-4 px-4 text-center">
                  <span className={`text-lg font-bold ${getScoreColor(candidate?.aiScore)}`}>
                    {candidate?.aiScore}%
                  </span>
                </td>
                <td className="py-4 px-4 text-center">
                  {getStatusBadge(candidate?.status)}
                </td>
                <td className="py-4 px-4">
                  <div className="flex items-center justify-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      iconName="Play"
                      onClick={() => onViewRecording?.(candidate?.id)}
                      title="View Recording"
                      className="rounded-full text-gray-500 hover:text-blue-600"
                    />

                    <Button
                      variant="ghost"
                      size="sm"
                      iconName="FileText"
                      onClick={() => onViewAnalysis?.(candidate?.id)}
                      title="View Analysis"
                      className="rounded-full text-gray-500 hover:text-blue-600"
                    />

                    <Button
                      variant="ghost"
                      size="sm"
                      iconName="Edit"
                      onClick={() => onUpdateStatus?.(candidate?.id)}
                      title="Update Status"
                      className="rounded-full text-gray-500 hover:text-blue-600"
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="lg:hidden space-y-3">
        {candidates?.map((candidate) => (
          <div key={candidate?.id} className="bg-white/70 dark:bg-slate-900/60 border border-white/40 dark:border-slate-700/50 rounded-xl p-3 sm:p-4 space-y-3 backdrop-blur">
            <div className="flex items-center space-x-3">
              <img
                src={candidate?.avatar}
                alt={candidate?.avatarAlt}
                className="w-12 h-12 rounded-full object-cover"
              />

              <div className="flex-1">
                <p className="font-medium text-gray-900 dark:text-slate-100">{candidate?.name}</p>
                <p className="text-sm text-gray-500 dark:text-slate-400">{candidate?.position}</p>
              </div>
              {getStatusBadge(candidate?.status)}
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500 dark:text-slate-400">Interview Date</p>
                <p className="font-medium text-gray-900 dark:text-slate-100">{candidate?.interviewDate}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-slate-400">AI Score</p>
                <p className={`font-bold ${getScoreColor(candidate?.aiScore)}`}>
                  {candidate?.aiScore}%
                </p>
              </div>
            </div>
            
            <div className="flex space-x-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                iconName="Play"
                iconPosition="left"
                onClick={() => onViewRecording?.(candidate?.id)}
                className="flex-1 rounded-full border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400"
              >
                Recording
              </Button>
              <Button
                variant="outline"
                size="sm"
                iconName="FileText"
                iconPosition="left"
                onClick={() => onViewAnalysis?.(candidate?.id)}
                className="flex-1 rounded-full border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400"
              >
                Analysis
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CandidateTable;
