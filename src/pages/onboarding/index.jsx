import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Icon from '../../components/AppIcon';
import BrandMark from '../../components/BrandMark';
import Button from '../../components/ui/Button';
import CandidateFields from '../register/components/CandidateFields';
import CompanyFields from '../register/components/CompanyFields';
import TermsAndPrivacy from '../register/components/TermsAndPrivacy';
import { authHelpers } from '../../config/firebase.js';
import apiClient from '../../services/apiClient.js';

const Onboarding = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [accountType, setAccountType] = useState('candidate');
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  
  const [formData, setFormData] = useState({
    agreeToTerms: false,
    agreeToMarketing: false,
    
    // Candidate fields
    experienceLevel: '',
    industry: '',
    targetRole: '',
    careerGoals: '',
    location: '',
    preferredLanguage: 'english',
    
    // Company fields
    companyName: '',
    companySize: '',
    jobTitle: '',
    department: '',
    hiringVolume: '',
    companyWebsite: '',
    companyLocation: '',
    phoneNumber: ''
  });

  const viewportConfig = { once: true, amount: 0.2 };

  const sectionReveal = {
    hidden: { opacity: 0, y: 40 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: 'easeOut' }
    }
  };

  const fadeUpChild = {
    hidden: { opacity: 0, y: 24 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.45, ease: 'easeOut' }
    }
  };

  // Load user data and check if onboarding is needed
  useEffect(() => {
    const checkOnboardingStatus = async () => {
      try {
        const { data } = await authHelpers.getSession();
        const session = data?.session;
        if (!session) {
          navigate('/login');
          return;
        }

        // Get user data from backend
        try {
          const userData = await apiClient.auth.getMe();
          if (userData.success && userData.user) {
            setUser(userData.user);
            setAccountType(userData.user.accountType?.toLowerCase() || 'candidate');
            
            // Check if user has already completed onboarding
            const isCandidate = userData.user.accountType?.toUpperCase() === 'CANDIDATE';
            const isCompany = userData.user.accountType?.toUpperCase() === 'COMPANY';
            
            const candidateComplete = isCandidate && userData.user.experienceLevel && userData.user.industry;
            const companyComplete = isCompany && userData.user.companyName;
            
            if (candidateComplete || companyComplete) {
              // Already completed onboarding, redirect to dashboard
              const dashboardRoute = isCandidate ? '/candidate-dashboard' : '/company-dashboard';
              navigate(dashboardRoute);
            }
          } else {
            // User doesn't exist in backend
            throw new Error('User not found');
          }
        } catch (apiError) {
          console.error('Failed to get user from backend:', apiError);
          // Clear session and redirect to register
          await authHelpers.signOut();
          localStorage.clear();
          navigate('/register');
        }
      } catch (error) {
        console.error('Failed to check onboarding status:', error);
        localStorage.clear();
        navigate('/register');
      }
    };

    checkOnboardingStatus();
  }, [navigate]);

  const handleFieldChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateStep = (step) => {
    const newErrors = {};

    if (step === 1) {
      if (accountType === 'candidate') {
        if (!formData.experienceLevel) {
          newErrors.experienceLevel = 'Experience level is required';
        }
        if (!formData.industry) {
          newErrors.industry = 'Industry is required';
        }
        if (!formData.targetRole) {
          newErrors.targetRole = 'Target role is required';
        }
      } else {
        if (!formData.companyName?.trim()) {
          newErrors.companyName = 'Company name is required';
        }
        if (!formData.companySize) {
          newErrors.companySize = 'Company size is required';
        }
        if (!formData.jobTitle?.trim()) {
          newErrors.jobTitle = 'Job title is required';
        }
      }
    }

    if (step === 2) {
      if (!formData.agreeToTerms) {
        newErrors.agreeToTerms = 'You must agree to the terms and conditions';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 2));
    }
  };

  const handlePrevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateStep(2)) return;

    setIsLoading(true);
    setErrors({});

    try {
      // Update user profile with onboarding data
      const updateData = accountType === 'candidate' 
        ? {
            experienceLevel: formData.experienceLevel,
            industry: formData.industry,
            targetRole: formData.targetRole || undefined,
            careerGoals: formData.careerGoals || undefined,
            location: formData.location || undefined,
            preferredLanguage: formData.preferredLanguage || undefined,
          }
        : {
            companyName: formData.companyName,
            companySize: formData.companySize,
            jobTitle: formData.jobTitle,
            department: formData.department || undefined,
            hiringVolume: formData.hiringVolume || undefined,
            companyWebsite: formData.companyWebsite || undefined,
            companyLocation: formData.companyLocation || undefined,
            phoneNumber: formData.phoneNumber || undefined,
          };

      const response = await apiClient.auth.updateProfile(updateData);

      if (response.success && response.user) {
        // Update localStorage with complete user data
        localStorage.setItem('user', JSON.stringify(response.user));
        localStorage.setItem('isAuthenticated', 'true');
        
        // Clear onboarding flags
        localStorage.removeItem('needsOnboarding');
        localStorage.removeItem('pendingRegistration');
        localStorage.removeItem('socialAuthIntent');
        
        // Redirect to dashboard
        const dashboardRoute = accountType === 'candidate' 
          ? '/candidate-dashboard' 
          : '/company-dashboard';
        navigate(dashboardRoute);
      } else {
        throw new Error('Failed to update profile');
      }
    } catch (error) {
      console.error('Onboarding error:', error);
      setErrors({ 
        submit: error.message || 'Failed to complete onboarding. Please try again.' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStepTitle = () => {
    if (currentStep === 1) {
      return accountType === 'candidate' ? 'Professional Details' : 'Company Information';
    }
    return 'Terms & Completion';
  };

  const getStepDescription = () => {
    if (currentStep === 1) {
      return accountType === 'candidate' 
        ? 'Tell us about your professional background'
        : 'Tell us about your company';
    }
    return 'Review and accept our terms';
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Complete Your Profile - InterviewAI Pro</title>
      </Helmet>
      
      <div className="relative min-h-screen bg-gradient-to-b from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 p-2 md:p-4 lg:p-6 flex items-center justify-center overflow-hidden transition-colors duration-300">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div className="absolute -top-24 right-0 h-96 w-96 bg-gradient-to-br from-blue-500/35 via-purple-500/20 to-transparent blur-[150px]" />
          <div className="absolute bottom-0 -left-24 h-[520px] w-[520px] bg-gradient-to-tr from-indigo-300/25 via-cyan-200/20 to-transparent blur-[140px]" />
        </div>
        <div className="relative z-10 w-full max-w-6xl h-[calc(100vh-1rem)] md:h-[calc(100vh-2rem)] lg:h-[calc(100vh-3rem)] flex flex-col lg:flex-row lg:gap-6 overflow-hidden">
          
          {/* Sidebar */}
          <div className="hidden lg:block lg:w-80 flex-shrink-0">
            <div className="rounded-3xl border border-white/30 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 shadow-[0_25px_80px_rgba(15,23,42,0.12)] dark:shadow-[0_25px_80px_rgba(0,0,0,0.4)] p-6 h-full flex flex-col backdrop-blur">
              <div className="flex items-center space-x-3 mb-6">
                <BrandMark
                  showTagline
                  className="items-start"
                  iconWrapperClassName="w-12 h-12 rounded-2xl"
                  textClassName="text-lg font-semibold"
                  taglineClassName="text-xs text-gray-500 dark:text-slate-400"
                />
              </div>

              <div className="space-y-4 mb-6">
                <div className={`flex items-start space-x-3 p-3 rounded-2xl border ${currentStep === 1 ? 'border-blue-500/40 dark:border-blue-500/60 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'border-white/30 dark:border-slate-700/50 bg-white/70 dark:bg-slate-800/70 text-gray-500 dark:text-slate-400'}`}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-white/80 dark:bg-slate-700/80 shadow-inner">
                    <span className="text-sm font-medium">1</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-medium">Professional Details</h3>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Your background info</p>
                  </div>
                </div>

                <div className={`flex items-start space-x-3 p-3 rounded-2xl border ${currentStep === 2 ? 'border-purple-500/40 dark:border-purple-500/60 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' : 'border-white/30 dark:border-slate-700/50 bg-white/70 dark:bg-slate-800/70 text-gray-500 dark:text-slate-400'}`}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-white/80 dark:bg-slate-700/80 shadow-inner">
                    <span className="text-sm font-medium">2</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-medium">Terms & Completion</h3>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Accept terms & finish</p>
                  </div>
                </div>
              </div>

              <div className="mt-auto pt-6 border-t border-white/30 dark:border-slate-700">
                <h4 className="text-sm font-medium text-gray-900 dark:text-slate-100 mb-3">Why Complete Your Profile?</h4>
                <ul className="space-y-2 text-xs text-gray-500 dark:text-slate-400">
                  <li className="flex items-center space-x-2">
                    <Icon name="Zap" size={12} className="text-purple-500" />
                    <span>Personalized recommendations</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Icon name="Target" size={12} className="text-emerald-500" />
                    <span>Tailored interview prep</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Icon name="TrendingUp" size={12} className="text-blue-500" />
                    <span>Better insights & analytics</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Main Form */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="rounded-3xl border border-white/30 dark:border-slate-700/50 bg-white/85 dark:bg-slate-800/85 shadow-[0_25px_80px_rgba(15,23,42,0.15)] dark:shadow-[0_25px_80px_rgba(0,0,0,0.5)] p-4 md:p-5 lg:p-6 h-full flex flex-col overflow-hidden backdrop-blur">
              {/* Header */}
              <div className="text-center mb-4 lg:mb-5 flex-shrink-0">
                <h1 className="text-lg md:text-xl lg:text-2xl xl:text-3xl font-semibold text-gray-900 dark:text-slate-100 mb-1 md:mb-2">
                  {getStepTitle()}
                </h1>
                <p className="text-xs md:text-sm lg:text-base text-gray-600 dark:text-slate-300">
                  {getStepDescription()}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-y-auto pr-2">
                <div className="flex-1 space-y-3 md:space-y-4 px-1">
                  {/* Step 1: Professional/Company Details */}
                  {currentStep === 1 && (
                    <div className="space-y-3">
                      {accountType === 'candidate' ? (
                        <CandidateFields
                          formData={formData}
                          onFieldChange={handleFieldChange}
                          errors={errors}
                        />
                      ) : (
                        <CompanyFields
                          formData={formData}
                          onFieldChange={handleFieldChange}
                          errors={errors}
                        />
                      )}
                    </div>
                  )}

                  {/* Step 2: Terms & Privacy */}
                  {currentStep === 2 && (
                    <div className="space-y-3">
                      <TermsAndPrivacy
                        agreeToTerms={formData.agreeToTerms}
                        agreeToMarketing={formData.agreeToMarketing}
                        onTermsChange={(checked) => handleFieldChange('agreeToTerms', checked)}
                        onMarketingChange={(checked) => handleFieldChange('agreeToMarketing', checked)}
                        errors={errors}
                      />
                    </div>
                  )}

                  {/* Error Display */}
                  {errors.submit && (
                    <div className="p-4 rounded-2xl border border-rose-200 bg-rose-50 text-rose-600 flex items-center space-x-2">
                      <Icon name="AlertCircle" size={16} className="text-rose-500" />
                      <p className="text-sm">{errors.submit}</p>
                    </div>
                  )}

                  {/* Navigation Buttons */}
                  <div className="flex items-center justify-between pt-3 md:pt-4 border-t border-border flex-shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handlePrevStep}
                      disabled={currentStep === 1}
                      iconName="ChevronLeft"
                      iconPosition="left"
                      className="h-10 rounded-full text-sm text-gray-600 hover:text-blue-600"
                    >
                      Previous
                    </Button>

                    <div className="flex items-center space-x-1.5 md:space-x-2">
                      {[1, 2].map((step) => (
                        <div
                          key={step}
                          className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full transition-colors duration-200 ${
                            step === currentStep ? 'bg-primary' : 'bg-muted'
                          }`}
                        />
                      ))}
                    </div>

                    {currentStep < 2 ? (
                      <Button
                        type="button"
                        variant="default"
                        onClick={handleNextStep}
                        iconName="ChevronRight"
                        iconPosition="right"
                        className="h-10 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6"
                      >
                        Next
                      </Button>
                    ) : (
                      <Button
                        type="submit"
                        variant="default"
                        disabled={isLoading}
                        className="h-10 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6"
                      >
                        {isLoading ? (
                          <span className="flex items-center">
                            <Icon name="Loader2" className="w-4 h-4 mr-2 animate-spin" />
                            Completing...
                          </span>
                        ) : (
                          'Complete Profile'
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Onboarding;
