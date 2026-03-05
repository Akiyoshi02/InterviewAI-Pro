import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/ui/Header';
import UserContextNavigation from '../../components/ui/UserContextNavigation';
import Button from '../../components/ui/Button';
import Icon from '../../components/AppIcon';
import apiClient from '../../services/apiClient.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useToast } from '../../components/ui/Toast';

// Import all components
import JobRoleSelector from './components/JobRoleSelector';
import ExperienceLevelSelector from './components/ExperienceLevelSelector';
import IndustrySelector from './components/IndustrySelector';
import InterviewTypeSelector from './components/InterviewTypeSelector';
import SessionDurationSelector from './components/SessionDurationSelector';
import AdvancedSettings from './components/AdvancedSettings';
import AIInterviewerPreview from './components/AIInterviewerPreview';
import PreparationChecklist from './components/PreparationChecklist';
import TemplateSelector from './components/TemplateSelector';

const PracticeInterviewSetup = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { success: showSuccessToast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const [isChecklistComplete, setIsChecklistComplete] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState(null);
  const [savedConfigs, setSavedConfigs] = useState([]);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    jobRole: '',
    experienceLevel: '',
    industry: '',
    interviewTypes: [],
    sessionDuration: 30,
    personality: null, // AI interviewer personality traits
    voice: null, // Voice/actor selection (separate from personality)
    interviewerName: null, // Generated or custom interviewer name
    prepNotes: '',
    advancedSettings: {
      skillFocus: [],
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
        return formData?.personality && formData?.voice;
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
        setIsCreating(false);
        await logout();
        navigate('/login');
        return;
      }

      if (user.accountType?.toUpperCase() !== 'CANDIDATE') {
        setError('Practice interviews are only available for candidate accounts.');
        setIsCreating(false);
        return;
      }

      // Prepare interview data for API
      // Include all configuration data for backend storage and retrieval
      const interviewData = {
        mode: 'PRACTICE',
        jobRole: formData.jobRole,
        experienceLevel: formData.experienceLevel,
        industry: formData.industry,
        interviewTypes: formData.interviewTypes || [],
        skillFocus: formData.advancedSettings?.skillFocus || [],
        duration: formData.sessionDuration || 30,
        // Include additional configuration for backend storage
        config: {
          personality: formData.personality,
          voice: formData.voice,
          interviewerName: formData.interviewerName,
          advancedSettings: formData.advancedSettings,
          prepNotes: formData.prepNotes || '',
        }
      };

      // Create interview via API
      const result = await apiClient.interviews.create(interviewData);

      if (result.success && result.interview) {
        // Save interview ID and config for the session
        localStorage.setItem('currentInterviewId', result.interview.id);
        localStorage.setItem('interviewConfig', JSON.stringify({
          ...formData,
          interviewId: result.interview.id,
          prepNotes: formData.prepNotes || '',
        }));

        // Navigate to live interview session
        navigate(`/live-interview-session?interviewId=${result.interview.id}`);
      } else {
        throw new Error('Failed to create interview');
      }
    } catch (err) {
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

  const loadSavedConfigs = useCallback(() => {
    try {
      const configs = JSON.parse(localStorage.getItem('savedInterviewConfigs') || '[]');
      setSavedConfigs(Array.isArray(configs) ? configs : []);
    } catch {
      setSavedConfigs([]);
    }
  }, []);

  const applySavedConfig = useCallback((savedConfig) => {
    if (!savedConfig?.config) return;
    setFormData({
      ...savedConfig.config,
      advancedSettings: {
        skillFocus: [],
        language: 'en',
        realTimeFeedback: false,
        followUpQuestions: true,
        recordSession: true,
        practiceMode: false,
        difficulty: 'medium',
        ...(savedConfig.config?.advancedSettings || {}),
      },
    });
    setCurrentStep(1);
    showSuccessToast(`Loaded config: ${savedConfig.name || 'Saved configuration'}`);
  }, [showSuccessToast]);

  const applyTemplate = useCallback((templateConfig, templateName) => {
    setFormData((prev) => ({
      ...prev,
      ...templateConfig,
      advancedSettings: {
        skillFocus: [],
        language: 'en',
        realTimeFeedback: false,
        followUpQuestions: true,
        recordSession: true,
        practiceMode: false,
        difficulty: 'medium',
        ...(templateConfig?.advancedSettings || {}),
      },
    }));
    setShowTemplateSelector(false);
    showSuccessToast(`Template applied: ${templateName}`);
  }, [showSuccessToast]);

  // Auto-save form data to localStorage
  useEffect(() => {
    const savedData = localStorage.getItem('interviewSetupDraft');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setFormData(prev => ({ ...prev, ...parsed }));
      } catch {
        // Ignore invalid saved draft data
      }
    }
    loadSavedConfigs();
  }, [loadSavedConfigs]);

  useEffect(() => {
    localStorage.setItem('interviewSetupDraft', JSON.stringify(formData));
  }, [formData]);

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            {/* Template Quick-start */}
            {!showTemplateSelector ? (
              <div className="rounded-xl border border-blue-100 dark:border-blue-800/40 bg-blue-50/60 dark:bg-blue-900/10 p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Start from a template</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">Use a pre-built configuration for common roles</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTemplateSelector(true)}
                  iconName="Zap"
                  iconPosition="left"
                >
                  Browse Templates
                </Button>
              </div>
            ) : (
              <div className="rounded-xl border border-blue-200 dark:border-blue-700/50 bg-white/80 dark:bg-slate-800/80 p-4 shadow-sm">
                <TemplateSelector
                  onApplyTemplate={applyTemplate}
                  onClose={() => setShowTemplateSelector(false)}
                />
              </div>
            )}

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
            selectedPersonality={formData?.personality}
            onPersonalityChange={(personality) => updateFormData('personality', personality)}
            selectedVoice={formData?.voice}
            onVoiceChange={(voice) => updateFormData('voice', voice)}
            interviewerName={formData?.interviewerName}
            onInterviewerNameChange={(name) => updateFormData('interviewerName', name)}
          />
        );
      
      case 4:
        return (
          <div className="space-y-6">
            <div>
              <label htmlFor="prep-notes" className="block text-sm font-medium text-gray-900 dark:text-slate-100 mb-2">
                Prep notes
              </label>
              <textarea
                id="prep-notes"
                value={formData.prepNotes || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, prepNotes: e.target.value }))}
                placeholder="Key points to remember, STAR examples, or questions you want to ask. These will be saved with your session."
                rows={4}
                className="w-full rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder:text-gray-500 dark:placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent p-3 text-sm resize-y min-h-[100px]"
              />
            </div>
            <PreparationChecklist
              onChecklistComplete={setIsChecklistComplete}
            />
          </div>
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
      {/* Spacer for fixed header */}
      <div className="h-14 xs:h-16" />
      <div className="relative z-10">
        <div className="flex flex-col lg:flex-row">
          <UserContextNavigation
            userType="candidate"
            isCollapsed={isNavCollapsed}
            onToggleCollapse={() => setIsNavCollapsed(!isNavCollapsed)}
          />

          <main className={`flex-1 transition-all duration-300 pb-20 lg:pb-0 ${
            isNavCollapsed ? 'lg:ml-20' : 'lg:ml-72 xl:ml-80'
          }`}>
            <motion.section
              variants={sectionReveal}
              initial="hidden"
              whileInView="visible"
              viewport={viewportConfig}
              className="container-responsive py-4 xs:py-6 sm:py-8 min-h-[calc(100vh-3.5rem)] xs:min-h-[calc(100vh-4rem)]"
            >
            {/* Header */}
            <motion.div
              variants={fadeUpChild}
              className="mb-6 xs:mb-8"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 shadow-lg shadow-blue-500/30">
                    <Icon name="Settings" size={24} color="white" />
                  </div>
                  <div>
                    <h1 className="text-2xl xs:text-3xl sm:text-4xl font-bold text-gray-900 dark:text-slate-100">
                      Practice Interview Setup
                    </h1>
                    <p className="text-sm xs:text-base text-gray-600 dark:text-slate-400 mt-1">
                      Configure your AI-powered interview session for optimal practice
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Progress Steps */}
            <motion.div
              variants={fadeUpChild}
              className="card-base relative overflow-hidden p-4 xs:p-5 sm:p-6 md:p-8 shadow-glass dark:shadow-glass-dark mb-4 xs:mb-5 sm:mb-6 md:mb-8"
            >
              <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_0%_0%,rgba(59,130,246,0.1),transparent_45%),radial-gradient(circle_at_100%_0%,rgba(147,51,234,0.1),transparent_40%)]" />
              <div className="relative z-10 flex items-center justify-between gap-1">
                {steps?.map((step, index) => (
                  <React.Fragment key={step?.id}>
                    <div className="flex items-center gap-1 xs:gap-2 sm:gap-3">
                      <button
                        onClick={() => setCurrentStep(step?.id)}
                        disabled={step?.id > currentStep && !isStepComplete(step?.id - 1)}
                        className={`w-9 h-9 xs:w-10 xs:h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all duration-200 flex-shrink-0 ${
                          currentStep === step?.id
                            ? 'bg-gradient-to-br from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/30'
                            : isStepComplete(step?.id)
                            ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md'
                            : 'bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-500'
                        } ${
                          step?.id <= currentStep || isStepComplete(step?.id - 1)
                            ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-not-allowed opacity-50'
                        }`}
                      >
                        {isStepComplete(step?.id) && currentStep !== step?.id ? (
                          <Icon name="Check" size={14} className="xs:w-4 xs:h-4 sm:w-5 sm:h-5" />
                        ) : (
                          <Icon name={step?.icon} size={14} className="xs:w-4 xs:h-4 sm:w-5 sm:h-5" />
                        )}
                      </button>
                      <div className="hidden lg:block">
                        <p className={`text-xs sm:text-sm font-medium ${
                          currentStep === step?.id ? 'text-blue-600' :
                          isStepComplete(step?.id) ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-slate-400'
                        }`}>
                          {step?.title}
                        </p>
                      </div>
                    </div>

                    {index < steps?.length - 1 && (
                      <div className={`flex-1 h-1 mx-1 xs:mx-2 sm:mx-3 md:mx-4 rounded-full min-w-[16px] ${
                        isStepComplete(step?.id) ? 'bg-gradient-to-r from-emerald-500 to-teal-600' : 'bg-gray-200 dark:bg-slate-700'
                      }`}></div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </motion.div>

            {/* Step Content */}
            <motion.div 
              variants={fadeUpChild}
              className="card-base p-4 xs:p-5 sm:p-6 md:p-8 shadow-glass dark:shadow-glass-dark mb-4 xs:mb-5 sm:mb-6 md:mb-8"
            >
              <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_0%_0%,rgba(59,130,246,0.1),transparent_45%),radial-gradient(circle_at_100%_0%,rgba(147,51,234,0.1),transparent_40%)]" />
              <div className="relative z-10">
                {renderStepContent()}
              </div>
            </motion.div>

            {/* Navigation Controls */}
            <motion.div 
              variants={fadeUpChild}
              className="flex flex-col xs:flex-row items-stretch xs:items-center justify-between gap-3 xs:gap-4"
            >
              <Button
                variant="outline"
                iconName="ChevronLeft"
                iconPosition="left"
                onClick={handlePrevious}
                disabled={currentStep === 1}
                className="rounded-full border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 text-xs sm:text-sm md:text-base w-full xs:w-auto"
              >
                Previous
              </Button>

              <div className="flex flex-col items-stretch xs:items-end gap-2 xs:gap-3">
                {error && (
                  <div className="p-3 sm:p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl sm:rounded-2xl">
                    <div className="flex items-center gap-2">
                      <Icon name="AlertCircle" size={14} className="text-red-600 dark:text-red-400 flex-shrink-0" />
                      <p className="text-xs sm:text-sm text-red-600 dark:text-red-400">{error}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2 xs:gap-3 w-full xs:w-auto">
                  {currentStep < steps?.length ? (
                    <Button
                      variant="default"
                      iconName="ChevronRight"
                      iconPosition="right"
                      onClick={handleNext}
                      disabled={!canProceedToNext()}
                      className="rounded-full bg-gradient-to-r from-blue-600 to-purple-600 border-none text-white shadow-md shadow-blue-500/30 hover:from-blue-700 hover:to-purple-700 text-xs sm:text-sm md:text-base flex-1 xs:flex-none"
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
                      className="rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 border-none text-white shadow-md shadow-emerald-500/30 hover:from-emerald-700 hover:to-teal-700 px-4 sm:px-6 md:px-8 text-xs sm:text-sm md:text-base flex-1 xs:flex-none"
                    >
                      {isCreating ? 'Creating...' : 'Start Interview'}
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Quick Actions */}
            <motion.div 
              variants={fadeUpChild}
              className="mt-4 xs:mt-5 sm:mt-6 md:mt-8 card-base p-4 xs:p-5 sm:p-6 shadow-glass dark:shadow-glass-dark"
            >
              <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_0%_0%,rgba(59,130,246,0.08),transparent_45%)] dark:bg-[radial-gradient(circle_at_0%_0%,rgba(59,130,246,0.15),transparent_45%)]" />
              <div className="relative z-10 flex flex-col xs:flex-row items-start xs:items-center justify-between gap-3 xs:gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-md shadow-blue-500/20 flex-shrink-0">
                    <Icon name="Lightbulb" size={14} className="text-white" />
                  </div>
                  <span className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-slate-100">Quick Actions</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full xs:w-auto">
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
                        personality: null,
                        voice: null,
                        interviewerName: null,
                        prepNotes: '',
                        advancedSettings: {
                          skillFocus: [],
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
                      showSuccessToast('Form reset successfully!');
                    }}
                    className="rounded-full border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 text-xs sm:text-sm flex-1 xs:flex-none"
                  >
                    Reset Form
                  </Button>
                  {savedConfigs.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      iconName="Upload"
                      iconPosition="left"
                      onClick={() => applySavedConfig(savedConfigs[savedConfigs.length - 1])}
                      className="rounded-full border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 text-xs sm:text-sm flex-1 xs:flex-none"
                    >
                      Load Last Saved
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    iconName="Save"
                    iconPosition="left"
                    onClick={() => {
                      const existingConfigs = JSON.parse(localStorage.getItem('savedInterviewConfigs') || '[]');
                      const newConfig = {
                        id: Date.now(),
                        name: `${formData?.jobRole || 'Custom'} Interview`,
                        config: formData,
                        createdAt: new Date()?.toISOString()
                      };
                      existingConfigs?.push(newConfig);
                      localStorage.setItem('savedInterviewConfigs', JSON.stringify(existingConfigs));
                      loadSavedConfigs();
                      showSuccessToast('Configuration saved successfully!');
                    }}
                    className="rounded-full border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 text-xs sm:text-sm flex-1 xs:flex-none"
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
    </div>
  );
};

export default PracticeInterviewSetup;
