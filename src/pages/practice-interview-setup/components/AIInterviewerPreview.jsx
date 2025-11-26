import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Image from '../../../components/AppImage';
import Button from '../../../components/ui/Button';

const AIInterviewerPreview = ({ selectedInterviewer, onInterviewerChange, className = '' }) => {
  const [previewMode, setPreviewMode] = useState(false);

  const interviewers = [
  {
    id: 'sarah',
    name: 'Sarah Chen',
    title: 'Senior Technical Interviewer',
    avatar: "https://images.unsplash.com/photo-1646041805292-fd77781436f9",
    avatarAlt: 'Professional Asian woman with shoulder-length black hair wearing navy blazer',
    personality: 'Professional, thorough, and encouraging',
    specialties: ['Technical Skills', 'Problem Solving', 'System Design'],
    sampleQuestions: [
    "Can you walk me through your approach to solving complex technical problems?",
    "Tell me about a challenging project you\'ve worked on recently."],

    voice: 'Clear and professional tone'
  },
  {
    id: 'marcus',
    name: 'Marcus Johnson',
    title: 'Behavioral Interview Specialist',
    avatar: "https://images.unsplash.com/photo-1724128195747-dd25cba7860f",
    avatarAlt: 'Professional African American man with short hair wearing dark suit and tie',
    personality: 'Warm, insightful, and detail-oriented',
    specialties: ['Leadership', 'Communication', 'Team Dynamics'],
    sampleQuestions: [
    "Describe a time when you had to lead a team through a difficult situation.",
    "How do you handle conflicts within your team?"],

    voice: 'Warm and conversational tone'
  },
  {
    id: 'elena',
    name: 'Elena Rodriguez',
    title: 'Product & Strategy Expert',
    avatar: "https://images.unsplash.com/photo-1603562380012-2f58e2c8ad21",
    avatarAlt: 'Professional Hispanic woman with long brown hair wearing white blouse',
    personality: 'Strategic, analytical, and forward-thinking',
    specialties: ['Product Management', 'Strategy', 'Market Analysis'],
    sampleQuestions: [
    "How would you prioritize features for a new product launch?",
    "Walk me through your process for market research and validation."],

    voice: 'Confident and analytical tone'
  },
  {
    id: 'david',
    name: 'David Kim',
    title: 'Executive Interview Coach',
    avatar: "https://images.unsplash.com/photo-1735653194261-040d376e0658",
    avatarAlt: 'Professional Asian man with glasses wearing gray suit jacket',
    personality: 'Experienced, challenging, and insightful',
    specialties: ['Executive Presence', 'Strategic Thinking', 'Leadership'],
    sampleQuestions: [
    "What\'s your vision for leading organizational change?",
    "How do you make decisions when facing uncertainty?"],

    voice: 'Authoritative and thoughtful tone'
  }];


  const currentInterviewer = interviewers?.find((i) => i?.id === selectedInterviewer) || interviewers?.[0];

  const handlePreviewInteraction = () => {
    setPreviewMode(true);
    setTimeout(() => setPreviewMode(false), 3000);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center space-x-3 mb-4">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <Icon name="Bot" size={20} className="text-white" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">AI Interviewer</h3>
      </div>
      {/* Interviewer Selection Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {interviewers?.map((interviewer) =>
        <button
          key={interviewer?.id}
          onClick={() => onInterviewerChange(interviewer?.id)}
          className={`p-5 rounded-2xl border-2 transition-all duration-200 text-left hover:-translate-y-1 hover:shadow-lg ${
          selectedInterviewer === interviewer?.id ?
          'border-blue-500 bg-blue-50/50 dark:bg-blue-500/10 shadow-md shadow-blue-500/20' :
          'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-500 bg-white dark:bg-slate-800'}`
          }>

            <div className="flex items-start space-x-3">
              <div className="relative">
                <Image
                src={interviewer?.avatar}
                alt={interviewer?.avatarAlt}
                className="w-12 h-12 rounded-full object-cover" />

                {selectedInterviewer === interviewer?.id &&
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center shadow-md">
                    <Icon name="Check" size={12} color="white" />
                  </div>
              }
              </div>
              
              <div className="flex-1">
                <h4 className={`font-semibold mb-1 ${
              selectedInterviewer === interviewer?.id ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-slate-100'}`
              }>
                  {interviewer?.name}
                </h4>
                <p className="text-sm text-gray-600 dark:text-slate-400 mb-2">
                  {interviewer?.title}
                </p>
                <p className="text-xs text-gray-500 dark:text-slate-500">
                  {interviewer?.personality}
                </p>
              </div>
            </div>
          </button>
        )}
      </div>
      {/* Selected Interviewer Preview */}
      <div className="relative overflow-hidden rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.12)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur">
        <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_0%_0%,rgba(59,130,246,0.1),transparent_45%)]" />
        <div className="relative z-10">
          <div className="flex items-start space-x-4 mb-4">
            <div className="relative">
              <Image
                src={currentInterviewer?.avatar}
                alt={currentInterviewer?.avatarAlt}
                className="w-16 h-16 rounded-full object-cover border-2 border-blue-200 shadow-md" />
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center border-2 border-white">
                <Icon name="Check" size={12} color="white" />
              </div>
            </div>

            
            <div className="flex-1">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-1">
                {currentInterviewer?.name}
              </h4>
              <p className="text-sm text-gray-600 dark:text-slate-400 mb-2">
                {currentInterviewer?.title}
              </p>
              <p className="text-sm text-gray-700 dark:text-slate-300">
                {currentInterviewer?.personality}
              </p>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              iconName="Play"
              iconPosition="left"
              onClick={handlePreviewInteraction}
              disabled={previewMode}
              className="rounded-full border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800">

              {previewMode ? 'Playing...' : 'Preview'}
            </Button>
          </div>

          {/* Specialties */}
          <div className="mb-4">
            <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-2">Specialties:</p>
            <div className="flex flex-wrap gap-2">
              {currentInterviewer?.specialties?.map((specialty, index) =>
              <span
                key={index}
                className="px-3 py-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs font-medium rounded-full shadow-sm">

                  {specialty}
                </span>
              )}
            </div>
          </div>

          {/* Sample Questions */}
          <div className="mb-4">
            <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-2">Sample Questions:</p>
            <div className="space-y-2">
              {currentInterviewer?.sampleQuestions?.map((question, index) =>
              <div key={index} className="flex items-start space-x-2 p-3 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-700/60">
                  <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon name="MessageCircle" size={12} className="text-white" />
                  </div>
                  <p className="text-sm text-gray-700 dark:text-slate-300 italic">
                    "{question}"
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Voice Preview */}
          {previewMode &&
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/60 bg-emerald-50/50 dark:bg-emerald-500/10 p-4 mb-4 backdrop-blur">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-emerald-600 dark:bg-emerald-400 rounded-full animate-pulse"></div>
                <p className="text-sm text-gray-900 dark:text-slate-100 font-medium">
                  "Hello! I'm {currentInterviewer?.name}. I'm excited to help you practice your interview skills today. 
                  Let's start with a simple question to get warmed up..."
                </p>
              </div>
            </div>
          }

          <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-slate-400">
            <div className="w-5 h-5 rounded-lg bg-gray-100 dark:bg-slate-900/70 flex items-center justify-center">
              <Icon name="Volume2" size={14} className="text-gray-600 dark:text-slate-300" />
            </div>
            <span className="font-medium">{currentInterviewer?.voice}</span>
          </div>
        </div>
      </div>
    </div>);

};

export default AIInterviewerPreview;