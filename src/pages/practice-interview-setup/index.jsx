import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/ui/Header';
import UserContextNavigation from '../../components/ui/UserContextNavigation';
import Button from '../../components/ui/Button';
import Icon from '../../components/AppIcon';
import apiClient from '../../services/apiClient.js';
import { useAuth } from '../../contexts/AuthContext.jsx';

// Import all components
import JobRoleSelector from './components/JobRoleSelector';
import ExperienceLevelSelector from './components/ExperienceLevelSelector';
import IndustrySelector from './components/IndustrySelector';
import InterviewTypeSelector from './components/InterviewTypeSelector';
import SessionDurationSelector from './components/SessionDurationSelector';
import AdvancedSettings from './components/AdvancedSettings';
import AIInterviewerPreview from './components/AIInterviewerPreview';
import PreparationChecklist from './components/PreparationChecklist';

const PracticeInterviewSetup = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const [isChecklistComplete, setIsChecklistComplete] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    jobRole: '',
    experienceLevel: '',
    industry: '',
    interviewTypes: [],
    sessionDuration: 30,
    interviewer: 'sarah',
    advancedSettings: {
      skillFocus: [],
      interviewStyle: 'conversational',
      language: 'en',
      realTimeFeedback: false,
      followUpQuestions: true,
      recordSession: true,
      practiceMode: false,
      difficulty: 'medium'
    }
  });

  const steps = [
    { id: 1, title: 'Job Details', icon: 'Briefcase' },
    { id: 2, title: 'Interview Setup', icon: 'Settings' },
    { id: 3, title: 'AI Interviewer', icon: 'Bot' },
    { id: 4, title: 'Preparation', icon: 'CheckSquare' }
  ];

  const viewportConfig = { once: true, amount: 0.25 };
  const sectionReveal = {
    hidden: { opacity: 0, y: 48 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.7, ease: 'easeOut' }
    }
  };
  const fadeUpChild = {
    hidden: { opacity: 0, y: 24 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: 'easeOut' }
    }
  };

  // Check if current step is complete
  const isStepComplete = (step) => {
    switch (step) {
      case 1:
        return formData?.jobRole && formData?.experienceLevel && formData?.industry;
      case 2:
        return formData?.interviewTypes?.length > 0 && formData?.sessionDuration;
      case 3:
        return formData?.interviewer;
      case 4:
        return isChecklistComplete;
      default:
        return false;
    }
  };

  const canProceedToNext = () => {
    return isStepComplete(currentStep);
  };

  const canStartInterview = () => {
    return steps?.every(step => isStepComplete(step?.id));
  };

  const handleNext = () => {
    if (canProceedToNext() && currentStep < steps?.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleStartInterview = async () => {
    if (!canStartInterview() || isCreating) return;

    setIsCreating(true);
    setError(null);

    try {
      if (!user) {
        setError('Your session has expired. Please sign in again.');
        await logout();
        navigate('/login');
        return;
      }

      if (user.accountType?.toUpperCase() !== 'CANDIDATE') {
        setError('Practice interviews are only available for candidate accounts.');
        return;
      }

      // Prepare interview data for API
      const interviewData = {
        mode: 'PRACTICE',
        jobRole: formData.jobRole,
        experienceLevel: formData.experienceLevel,
        industry: formData.industry,
        interviewTypes: formData.interviewTypes || [],
        skillFocus: formData.advancedSettings?.skillFocus || [],
        duration: formData.sessionDuration || 30,
      };

      // Create interview via API
      const result = await apiClient.interviews.create(interviewData);

      if (result.success && result.interview) {
        // Save interview ID and config for the session
        localStorage.setItem('currentInterviewId', result.interview.id);
        localStorage.setItem('interviewConfig', JSON.stringify({
          ...formData,
          interviewId: result.interview.id,
        }));

        // Navigate to live interview session
        navigate(`/live-interview-session?interviewId=${result.interview.id}`);
      } else {
        throw new Error('Failed to create interview');
      }
    } catch (err) {
      console.error('Failed to create interview:', err);
      setError(err.message || 'Failed to start interview. Please try again.');
      setIsCreating(false);
    }
  };

  const updateFormData = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const updateAdvancedSettings = (settings) => {
    setFormData(prev => ({
      ...prev,
      advancedSettings: settings
    }));
  };

  // Auto-save form data to localStorage
  useEffect(() => {
    const savedData = localStorage.getItem('interviewSetupDraft');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setFormData(prev => ({ ...prev, ...parsed }));
      } catch (error) {
        console.error('Failed to load saved form data:', error);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('interviewSetupDraft', JSON.stringify(formData));
  }, [formData]);

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-8">
            <JobRoleSelector
              selectedRole={formData?.jobRole}
              onRoleChange={(role) => updateFormData('jobRole', role)}
            />
            <ExperienceLevelSelector
              selectedLevel={formData?.experienceLevel}
              onLevelChange={(level) => updateFormData('experienceLevel', level)}
            />
            <IndustrySelector
              selectedIndustry={formData?.industry}
              onIndustryChange={(industry) => updateFormData('industry', industry)}
            />
          </div>
        );
      
      case 2:
        return (
          <div className="space-y-8">
            <InterviewTypeSelector
              selectedTypes={formData?.interviewTypes}
              onTypesChange={(types) => updateFormData('interviewTypes', types)}
            />
            <SessionDurationSelector
              selectedDuration={formData?.sessionDuration}
              onDurationChange={(duration) => updateFormData('sessionDuration', duration)}
            />
            <AdvancedSettings
              settings={formData?.advancedSettings}
              onSettingsChange={updateAdvancedSettings}
            />
          </div>
        );
      
      case 3:
        return (
          <AIInterviewerPreview
            selectedInterviewer={formData?.interviewer}
            onInterviewerChange={(interviewer) => updateFormData('interviewer', interviewer)}
          />
        );
      
      case 4:
        return (
          <PreparationChecklist
            onChecklistComplete={setIsChecklistComplete}
          />
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 transition-colors duration-300">
      <Header 
        userType="candidate" 
        isAuthenticated
        onLogout={async () => {
          localStorage.removeItem('interviewSetupDraft');
          localStorage.removeItem('interviewConfig');
          await logout();
          navigate('/login');
        }}
      />
      <div className="flex">
        <UserContextNavigation
          userType="candidate"
          isCollapsed={isNavCollapsed}
          onToggleCollapse={() => setIsNavCollapsed(!isNavCollapsed)}
        />
        
        <main className={`flex-1 transition-all duration-300 ${
          isNavCollapsed ? 'lg:ml-16' : 'lg:ml-64'
        }`}>
          <motion.section
            variants={sectionReveal}
            initial="hidden"
            whileInView="visible"
            viewport={viewportConfig}
            className="max-w-4xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8"
          >
            {/* Header */}
            <motion.div 
              variants={fadeUpChild}
              className="mb-6 sm:mb-7 md:mb-8"
            >
              <div className="relative overflow-hidden rounded-3xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-6 sm:p-8 shadow-[0_30px_80px_rgba(15,23,42,0.15)] dark:shadow-[0_30px_80px_rgba(0,0,0,0.5)] backdrop-blur">
                <div className="absolute inset-0 opacity-80 bg-[radial-gradient(circle_at_0%_0%,rgba(59,130,246,0.15),transparent_45%),radial-gradient(circle_at_100%_0%,rgba(147,51,234,0.15),transparent_40%)]" />
                <div className="relative z-10 flex items-center space-x-2 sm:space-x-3 mb-3 sm:mb-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                    <Icon name="Settings" size={20} className="sm:w-6 sm:h-6" color="white" />
                  </div>
                  <div>
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-slate-100">Practice Interview Setup</h1>
                    <p className="text-xs sm:text-sm md:text-base text-gray-600 dark:text-slate-300">
                      Configure your AI-powered interview session for optimal practice
                    </p>
                  </div>
                </div>

                {/* Progress Steps */}
                <div className="flex items-center justify-between mb-6 sm:mb-7 md:mb-8">
                  {steps?.map((step, index) => (
                    <React.Fragment key={step?.id}>
                      <div className="flex items-center space-x-2 sm:space-x-3">
                        <button
                          onClick={() => setCurrentStep(step?.id)}
                          disabled={step?.id > currentStep && !isStepComplete(step?.id - 1)}
                          className={`w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all duration-200 ${
                            currentStep === step?.id
                              ? 'bg-gradient-to-br from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/30'
                              : isStepComplete(step?.id)
                              ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md' 
                              : 'bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-500'
                          } ${
                            step?.id <= currentStep || isStepComplete(step?.id - 1)
                              ? 'cursor-pointer hover:scale-110' : 'cursor-not-allowed opacity-50'
                          }`}
                        >
                          {isStepComplete(step?.id) && currentStep !== step?.id ? (
                            <Icon name="Check" size={16} className="sm:w-5 sm:h-5" />
                          ) : (
                            <Icon name={step?.icon} size={16} className="sm:w-5 sm:h-5" />
                          )}
                        </button>
                        <div className="hidden md:block">
                          <p className={`text-xs sm:text-sm font-medium ${
                            currentStep === step?.id ? 'text-blue-600' : 
                            isStepComplete(step?.id) ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-slate-400'
                          }`}>
                            {step?.title}
                          </p>
                        </div>
                      </div>
                      
                      {index < steps?.length - 1 && (
                        <div className={`flex-1 h-1 mx-2 sm:mx-3 md:mx-4 rounded-full ${
                          isStepComplete(step?.id) ? 'bg-gradient-to-r from-emerald-500 to-teal-600' : 'bg-gray-200 dark:bg-slate-700'
                        }`}></div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Step Content */}
            <motion.div 
              variants={fadeUpChild}
              className="relative overflow-hidden rounded-3xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-6 sm:p-8 shadow-[0_25px_70px_rgba(15,23,42,0.12)] dark:shadow-[0_25px_70px_rgba(0,0,0,0.4)] backdrop-blur mb-6 sm:mb-7 md:mb-8"
            >
              <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_0%_0%,rgba(59,130,246,0.1),transparent_45%),radial-gradient(circle_at_100%_0%,rgba(147,51,234,0.1),transparent_40%)]" />
              <div className="relative z-10">
                {renderStepContent()}
              </div>
            </motion.div>

            {/* Navigation Controls */}
            <motion.div 
              variants={fadeUpChild}
              className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4"
            >
              <Button
                variant="outline"
                iconName="ChevronLeft"
                iconPosition="left"
                onClick={handlePrevious}
                disabled={currentStep === 1}
                className="rounded-full border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 text-xs sm:text-sm md:text-base w-full sm:w-auto"
              >
                Previous
              </Button>

              <div className="flex flex-col items-stretch sm:items-end space-y-2 sm:space-y-3">
                {error && (
                  <div className="p-3 sm:p-4 bg-red-50 border border-red-200 rounded-2xl">
                    <div className="flex items-center space-x-2">
                      <Icon name="AlertCircle" size={16} className="text-red-600" />
                      <p className="text-xs sm:text-sm text-red-600">{error}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center space-x-2 sm:space-x-3">
                  {currentStep < steps?.length ? (
                    <Button
                      variant="default"
                      iconName="ChevronRight"
                      iconPosition="right"
                      onClick={handleNext}
                      disabled={!canProceedToNext()}
                      className="rounded-full bg-gradient-to-r from-blue-600 to-purple-600 border-none text-white shadow-md shadow-blue-500/30 hover:from-blue-700 hover:to-purple-700 text-xs sm:text-sm md:text-base w-full sm:w-auto"
                    >
                      Next Step
                    </Button>
                  ) : (
                    <Button
                      variant="default"
                      iconName="Play"
                      iconPosition="left"
                      onClick={handleStartInterview}
                      disabled={!canStartInterview() || isCreating}
                      loading={isCreating}
                      className="rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 border-none text-white shadow-md shadow-emerald-500/30 hover:from-emerald-700 hover:to-teal-700 px-4 sm:px-6 md:px-8 text-xs sm:text-sm md:text-base w-full sm:w-auto"
                    >
                      {isCreating ? 'Creating Interview...' : 'Start Interview'}
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Quick Actions */}
            <motion.div 
              variants={fadeUpChild}
              className="mt-6 sm:mt-7 md:mt-8 relative overflow-hidden rounded-3xl border border-white/30 bg-white/80 p-4 sm:p-6 shadow-[0_20px_60px_rgba(15,23,42,0.12)] backdrop-blur"
            >
              <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_0%_0%,rgba(59,130,246,0.08),transparent_45%)]" />
              <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-md shadow-blue-500/20">
                    <Icon name="Lightbulb" size={16} className="text-white" />
                  </div>
                  <span className="text-xs sm:text-sm font-semibold text-gray-900">Quick Actions</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    iconName="RotateCcw"
                    iconPosition="left"
                    onClick={() => {
                      setFormData({
                        jobRole: '',
                        experienceLevel: '',
                        industry: '',
                        interviewTypes: [],
                        sessionDuration: 30,
                        interviewer: 'sarah',
                        advancedSettings: {
                          skillFocus: [],
                          interviewStyle: 'conversational',
                          language: 'en',
                          realTimeFeedback: false,
                          followUpQuestions: true,
                          recordSession: true,
                          practiceMode: false,
                          difficulty: 'medium'
                        }
                      });
                      setCurrentStep(1);
                      localStorage.removeItem('interviewSetupDraft');
                    }}
                    className="rounded-full border border-gray-200 text-gray-800 hover:bg-gray-50 text-xs sm:text-sm"
                  >
                    Reset Form
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    iconName="Save"
                    iconPosition="left"
                    onClick={() => {
                      const savedConfigs = JSON.parse(localStorage.getItem('savedInterviewConfigs') || '[]');
                      const newConfig = {
                        id: Date.now(),
                        name: `${formData?.jobRole || 'Custom'} Interview`,
                        config: formData,
                        createdAt: new Date()?.toISOString()
                      };
                      savedConfigs?.push(newConfig);
                      localStorage.setItem('savedInterviewConfigs', JSON.stringify(savedConfigs));
                      alert('Configuration saved successfully!');
                    }}
                    className="rounded-full border border-gray-200 text-gray-800 hover:bg-gray-50 text-xs sm:text-sm"
                  >
                    Save Config
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.section>
        </main>
      </div>
    </div>
  );
};

export default PracticeInterviewSetup;