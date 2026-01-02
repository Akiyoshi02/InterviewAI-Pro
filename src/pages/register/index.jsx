import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import Icon from '../../components/AppIcon';
import BrandMark from '../../components/BrandMark';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import AccountTypeSelector from './components/AccountTypeSelector';
import PasswordStrengthIndicator from './components/PasswordStrengthIndicator';
import PasswordMatchIndicator from './components/PasswordMatchIndicator';
import SocialRegistration from './components/SocialRegistration';
import CandidateFields from './components/CandidateFields';
import CompanyFields from './components/CompanyFields';
import TermsAndPrivacy from './components/TermsAndPrivacy';
import { authHelpers } from '../../config/firebase.js';
import apiClient from '../../services/apiClient.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import {
  passwordMeetsAllRequirements,
  PASSWORD_REQUIREMENT_MESSAGE,
} from '../../utils/passwordValidation';

const Register = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setAuthenticatedUser } = useAuth();
  const [formData, setFormData] = useState({
    // Common fields
    accountType: 'candidate',
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    agreeToTerms: false,
    agreeToMarketing: false,
    
    // Candidate specific fields
    experienceLevel: '',
    industry: '',
    targetRole: '',
    careerGoals: '',
    location: '',
    preferredLanguage: 'english',
    profilePhoto: null,
    resumeFile: null,
    gender: '',
    
    // Company specific fields
    companyName: '',
    companySize: '',
    jobTitle: '',
    department: '',
    hiringVolume: '',
    companyWebsite: '',
    companyLocation: '',
    phoneNumber: '',
    companyLogo: null,
    companyProof: null,
  });

  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [status, setStatus] = useState(''); // For showing success messages
  const [message, setMessage] = useState(''); // For showing success/info messages
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [locationHelper, setLocationHelper] = useState({
    targetField: null,
    status: 'idle',
    message: '',
  });
  const [uploadModeration, setUploadModeration] = useState({
    profilePhoto: { status: 'idle', error: '' },
    resumeFile: { status: 'idle', error: '' },
    companyLogo: { status: 'idle', error: '' },
    companyProof: { status: 'idle', error: '' },
  });

  const getSafeRedirectPath = (value) => {
    if (!value || typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return null;
    if (trimmed.startsWith('/login') || trimmed.startsWith('/register')) return null;
    return trimmed;
  };

  const redirectAfterAuth = getSafeRedirectPath(searchParams.get('redirect'));
  const loginHref = redirectAfterAuth ? `/login?redirect=${encodeURIComponent(redirectAfterAuth)}` : '/login';

  const viewportConfig = { once: true, amount: 0.2 };
  const friendlyRateLimitMessage = (text) => {
    if (!text) return '';
    const normalized = text.toLowerCase();
    if (normalized.includes('too many authentication attempts')) {
      return 'You’ve tried a few times. Please wait 15 minutes before trying again.';
    }
    return text;
  };

  const formatDetectedLocation = (data, coords) => {
    if (!data && !coords) {
      return '';
    }

    const administrative = data?.localityInfo?.administrative || [];
    const locality = data?.city
      || data?.locality
      || data?.principalSubdivision
      || administrative.find((item) => (item.order ?? 0) >= 4)?.name;

    const region = data?.principalSubdivision
      || administrative.find((item) => (item.order ?? 0) <= 3)?.name;

    const country = data?.countryName || data?.countryCode;

    const parts = [locality, region, country].filter(Boolean);

    if (parts.length > 0) {
      return parts.join(', ');
    }

    if (coords) {
      const { latitude, longitude } = coords;
      return `Lat ${latitude.toFixed(3)}, Long ${longitude.toFixed(3)}`;
    }

    return '';
  };

  const sectionReveal = {
    hidden: { opacity: 0, y: 48 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: 'easeOut' }
    }
  };

  const moderateUpload = async (type, file, options = {}) => {
    if (!file || !type) return;
    const metadata = options.metadata || {};
    setUploadModeration((prev) => ({
      ...prev,
      [type]: { status: 'checking', error: '' },
    }));

    try {
      if (type === 'profilePhoto') {
        await apiClient.uploads.moderateProfilePhoto(file);
      } else if (type === 'companyLogo') {
        await apiClient.uploads.moderateCompanyLogo(file);
      } else if (type === 'resumeFile') {
        await apiClient.uploads.moderateResume(file, metadata);
      } else if (type === 'companyProof') {
        await apiClient.uploads.moderateCompanyProof(file, metadata);
      } else {
        throw new Error('Unsupported file type provided for moderation.');
      }

      setUploadModeration((prev) => ({
        ...prev,
        [type]: { status: 'approved', error: '' },
      }));
      return true;
    } catch (error) {
      const isDocumentType = type === 'resumeFile' || type === 'companyProof';
      const defaultMessage = isDocumentType
        ? 'Document failed verification. Please upload an official PDF or Word document.'
        : 'Image failed moderation. Please upload a different file.';
      const message = friendlyRateLimitMessage(error.message) || defaultMessage;
      setUploadModeration((prev) => ({
        ...prev,
        [type]: { status: 'error', error: message },
      }));
      throw new Error(message);
    }
  };

  const resetUploadModeration = (type) => {
    if (!type) return;
    setUploadModeration((prev) => ({
      ...prev,
      [type]: { status: 'idle', error: '' },
    }));
  };

  useEffect(() => {
    if (formData.accountType === 'candidate') {
      setUploadModeration((prev) => ({
        ...prev,
        companyLogo: { status: 'idle', error: '' },
        companyProof: { status: 'idle', error: '' },
      }));
    } else {
      setUploadModeration((prev) => ({
        ...prev,
        profilePhoto: { status: 'idle', error: '' },
        resumeFile: { status: 'idle', error: '' },
      }));
    }
  }, [formData.accountType]);

  const fadeUpChild = {
    hidden: { opacity: 0, y: 24 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.45, ease: 'easeOut' }
    }
  };

  const prepareRegistrationRequestBody = (payload) => {
    if (!payload) return payload;
    const derivedAccountType = (payload?.accountType || formData?.accountType || '')
      .toString()
      .toUpperCase();

    if (!['CANDIDATE', 'COMPANY'].includes(derivedAccountType)) {
      return payload;
    }

    const multipartPayload = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        multipartPayload.append(key, value);
      }
    });

    if (derivedAccountType === 'CANDIDATE') {
      if (formData?.profilePhoto) {
        multipartPayload.append('profilePhoto', formData.profilePhoto);
      }
      if (formData?.resumeFile) {
        multipartPayload.append('resumeFile', formData.resumeFile);
      }
    }

    if (derivedAccountType === 'COMPANY') {
      if (formData?.companyLogo) {
        multipartPayload.append('companyLogo', formData.companyLogo);
      }
      if (formData?.companyProof) {
        multipartPayload.append('companyProof', formData.companyProof);
      }
    }

    return multipartPayload;
  };

  useEffect(() => {
    const pendingRegistration = localStorage.getItem('pendingRegistration');
    const pendingAccountType = localStorage.getItem('pendingAccountType');

    if (!pendingRegistration && !pendingAccountType) {
      return;
    }

    setFormData((prev) => {
      let pendingData = {};
      if (pendingRegistration) {
        try {
          pendingData = JSON.parse(pendingRegistration) || {};
        } catch (error) {
          pendingData = {};
        }
      }

      const rawAccountType = (pendingData.accountType || pendingAccountType || prev.accountType || '')
        .toString()
        .toLowerCase();
      const nextAccountType = rawAccountType === 'company' ? 'company' : 'candidate';

      return {
        ...prev,
        accountType: nextAccountType,
        email: pendingData.email || prev.email,
        fullName: pendingData.fullName || prev.fullName,
        gender: pendingData.gender || prev.gender,
        experienceLevel: pendingData.experienceLevel || prev.experienceLevel,
        industry: pendingData.industry || prev.industry,
        targetRole: pendingData.targetRole || prev.targetRole,
        careerGoals: pendingData.careerGoals || prev.careerGoals,
        location: pendingData.location || prev.location,
        preferredLanguage: pendingData.preferredLanguage || prev.preferredLanguage,
        companyName: pendingData.companyName || prev.companyName,
        companySize: pendingData.companySize || prev.companySize,
        jobTitle: pendingData.jobTitle || prev.jobTitle,
        department: pendingData.department || prev.department,
        hiringVolume: pendingData.hiringVolume || prev.hiringVolume,
        companyWebsite: pendingData.companyWebsite || prev.companyWebsite,
        companyLocation: pendingData.companyLocation || prev.companyLocation,
        phoneNumber: pendingData.phoneNumber || prev.phoneNumber,
      };
    });
  }, []);

  // Clear any stale authentication data when component mounts
  useEffect(() => {
    let cancelled = false;

    const clearStaleAuth = async () => {
      // Check if there's a stale session (from failed login) but no backend user
      const { data } = await authHelpers.getSession();
      
      if (data?.session) {
        const sessionEmail = data.session.user?.email;
        const sessionFullName = data.session.user?.user_metadata?.fullName;

        if (!cancelled) {
          if (sessionEmail || sessionFullName) {
            setFormData((prev) => ({
              ...prev,
              email: sessionEmail || prev.email,
              fullName: prev.fullName?.trim() ? prev.fullName : sessionFullName || prev.fullName,
            }));
          }
        }

        // Check if user exists in backend
        try {
          const userData = await apiClient.auth.getMe();
          if (userData.success && userData.user) {
            // User is legitimately authenticated, redirect to dashboard
            console.log('User already authenticated, redirecting to dashboard');
            const accountType = userData.user.accountType?.toLowerCase();
            const dashboardRoute = accountType === 'candidate' 
              ? '/candidate-dashboard' 
              : '/company-dashboard';
            navigate(redirectAfterAuth || dashboardRoute, { replace: true });
            return;
          }
        } catch (error) {
          const errorMessage = (error?.message || '').toLowerCase();
          const isMissingBackendUser =
            errorMessage.includes('user not found') ||
            errorMessage.includes('not found') ||
            errorMessage.includes('404');

          if (isMissingBackendUser) {
            console.log('Firebase session found without backend user. Allowing registration to continue.');
            localStorage.removeItem('user');
            localStorage.removeItem('isAuthenticated');
            localStorage.removeItem('socialAuthVerified');
            localStorage.removeItem('socialAuthData');

            if (!cancelled) {
              setStatus('info');
              setMessage('You are signed in, but your InterviewAI account setup is not complete yet. Finish the steps below to complete registration.');
            }
            return;
          }

          console.error('Failed to validate existing session:', error);
          if (!cancelled) {
            setStatus('info');
            setMessage('We could not validate your existing session right now. You can still try completing registration.');
          }
        }
      } else {
        // No session, make sure localStorage is also clean
        localStorage.removeItem('user');
        localStorage.removeItem('isAuthenticated');
        localStorage.removeItem('socialAuthVerified');
        localStorage.removeItem('socialAuthData');
      }
    };

    clearStaleAuth();

    return () => {
      cancelled = true;
    };
  }, [navigate, redirectAfterAuth]);

  const handleFieldChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors?.[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateStep = (step) => {
    const newErrors = {};

    if (step === 1) {
      // Basic information validation
      if (!formData?.fullName?.trim()) {
        newErrors.fullName = 'Full name is required';
      }

      if (!formData?.email) {
        newErrors.email = 'Email is required';
      } else if (!/\S+@\S+\.\S+/.test(formData?.email)) {
        newErrors.email = 'Please enter a valid email address';
      }

      if (!formData?.password) {
        newErrors.password = 'Password is required';
      } else if (!passwordMeetsAllRequirements(formData?.password)) {
        newErrors.password = PASSWORD_REQUIREMENT_MESSAGE;
      }

      if (!formData?.confirmPassword) {
        newErrors.confirmPassword = 'Please confirm your password';
      } else if (formData?.password !== formData?.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    }

    if (step === 2) {
      // Account type specific validation
      if (formData?.accountType === 'candidate') {
        if (!formData?.experienceLevel) {
          newErrors.experienceLevel = 'Experience level is required';
        }
        if (!formData?.industry) {
          newErrors.industry = 'Industry is required';
        }
        if (!formData?.targetRole) {
          newErrors.targetRole = 'Target role is required';
        }
        if (!formData?.gender) {
          newErrors.gender = 'Please select your gender';
        }
        if (!formData?.profilePhoto) {
          newErrors.profilePhoto = 'Please upload a profile picture';
        }
        if (uploadModeration?.profilePhoto?.status !== 'approved') {
          newErrors.profilePhoto = uploadModeration?.profilePhoto?.error || 'Profile picture must pass moderation before continuing.';
        }
        if (!formData?.resumeFile) {
          newErrors.resumeFile = 'Please upload your CV or résumé';
        } else if (uploadModeration?.resumeFile?.status !== 'approved') {
          newErrors.resumeFile = uploadModeration?.resumeFile?.error || 'CV or résumé must pass verification before continuing.';
        }
      } else if (formData?.accountType === 'company') {
        if (!formData?.companyName?.trim()) {
          newErrors.companyName = 'Company name is required';
        }
        if (!formData?.companySize) {
          newErrors.companySize = 'Company size is required';
        }
        if (!formData?.industry) {
          newErrors.industry = 'Industry is required';
        }
        if (!formData?.jobTitle?.trim()) {
          newErrors.jobTitle = 'Job title is required';
        }
        if (!formData?.department) {
          newErrors.department = 'Department is required';
        }
        if (!formData?.hiringVolume) {
          newErrors.hiringVolume = 'Hiring volume is required';
        }
        if (!formData?.companyLogo) {
          newErrors.companyLogo = 'Please upload your company logo';
        }
        if (uploadModeration?.companyLogo?.status !== 'approved') {
          newErrors.companyLogo = uploadModeration?.companyLogo?.error || 'Company logo must pass moderation before continuing.';
        }
        if (!formData?.companyProof) {
          newErrors.companyProof = 'Please provide a verification document';
        } else if (uploadModeration?.companyProof?.status !== 'approved') {
          newErrors.companyProof = uploadModeration?.companyProof?.error || 'Verification document must pass moderation before continuing.';
        }
      }
    }

    if (step === 3) {
      // Terms validation
      if (!formData?.agreeToTerms) {
        newErrors.agreeToTerms = 'You must agree to the Terms of Service and Privacy Policy';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors)?.length === 0;
  };

  const handleNextStep = async () => {
    if (!validateStep(currentStep)) {
      return;
    }

    if (currentStep === 1) {
      const emailToCheck = formData?.email?.trim().toLowerCase();

      if (!emailToCheck) {
        return;
      }

      setStatus('');
      setMessage('');

      try {
        setIsCheckingEmail(true);
        const result = await apiClient.auth.checkEmailAvailability(emailToCheck);

        if (result?.exists) {
          const existingType = (result.accountType || '').toLowerCase() === 'company'
            ? 'company'
            : 'job seeker';
          const duplicateMessage = `A ${existingType} account already exists for this email. Please sign in or use a different email address.`;

          setErrors((prev) => ({ ...prev, email: duplicateMessage }));
          return;
        }
      } catch (error) {
        console.error('Email availability check failed:', error);
        setErrors((prev) => ({
          ...prev,
          email: friendlyRateLimitMessage(error.message) || 'Unable to validate email right now. Please try again.',
        }));
        return;
      } finally {
        setIsCheckingEmail(false);
      }
    }

    setCurrentStep(prev => Math.min(prev + 1, 3));
  };

  const handleDetectLocation = async (fieldKey) => {
    if (isDetectingLocation || !fieldKey) {
      return;
    }

    if (typeof window === 'undefined' || !navigator?.geolocation) {
      setLocationHelper({
        targetField: fieldKey,
        status: 'error',
        message: 'Your browser does not support location detection. Please enter it manually.',
      });
      return;
    }

    setIsDetectingLocation(true);
    setLocationHelper({
      targetField: fieldKey,
      status: 'info',
      message: 'Requesting location permission…',
    });

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

      setLocationHelper({
        targetField: fieldKey,
        status: 'info',
        message: 'Detecting your city…',
      });

      const { latitude, longitude } = position.coords || {};

      if (latitude == null || longitude == null) {
        throw new Error('We could not read your coordinates. Please enter your location manually.');
      }

      const response = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
      );

      if (!response.ok) {
        throw new Error('Unable to determine your location automatically.');
      }

      const data = await response.json();
      const formattedLocation = formatDetectedLocation(data, { latitude, longitude });

      if (!formattedLocation) {
        throw new Error('We couldn’t convert your coordinates into a city. Please enter it manually.');
      }

      handleFieldChange(fieldKey, formattedLocation);

      // Clear location helper on success - location is visible in the input field
      setLocationHelper({ targetField: null, status: 'idle', message: '' });
    } catch (error) {
      console.error('Location detection error:', error);

      let friendlyMessage = error?.message || 'Unable to detect your location. Please enter it manually.';

      if (error?.code === 1 || error?.message?.toLowerCase().includes('permission')) {
        friendlyMessage = 'Location permission was denied. You can enable it in your browser or enter the location manually.';
      } else if (error?.code === 2) {
        friendlyMessage = 'We could not determine your position. Please try again or enter it manually.';
      } else if (error?.code === 3) {
        friendlyMessage = 'Location request timed out. Please try again or enter it manually.';
      }

      setLocationHelper({
        targetField: fieldKey,
        status: 'error',
        message: friendlyMessage,
      });
    } finally {
      setIsDetectingLocation(false);
    }
  };

  const handlePrevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const validateSocialRegistrationRequirements = () => {
    const missingFields = {};
    const missingSections = new Set();

    if (formData?.accountType === 'candidate') {
      if (!formData?.experienceLevel) {
        missingFields.experienceLevel = 'Experience level is required before using Google sign-up.';
        missingSections.add('professional details');
      }
      if (!formData?.industry) {
        missingFields.industry = 'Industry is required before using Google sign-up.';
        missingSections.add('professional details');
      }
      if (!formData?.targetRole) {
        missingFields.targetRole = 'Target role is required before using Google sign-up.';
        missingSections.add('professional details');
      }
      if (!formData?.gender) {
        missingFields.gender = 'Gender selection is required before using Google sign-up.';
        missingSections.add('professional details');
      }
      if (!formData?.profilePhoto) {
        missingFields.profilePhoto = 'Profile picture is required before using Google sign-up.';
        missingSections.add('professional details');
      }
      if (uploadModeration?.profilePhoto?.status !== 'approved') {
        missingFields.profilePhoto = uploadModeration?.profilePhoto?.error || 'Profile picture must pass moderation before using Google sign-up.';
        missingSections.add('professional details');
      }
      if (!formData?.resumeFile) {
        missingFields.resumeFile = 'CV or résumé is required before using Google sign-up.';
        missingSections.add('professional details');
      }
      if (formData?.resumeFile && uploadModeration?.resumeFile?.status !== 'approved') {
        missingFields.resumeFile = uploadModeration?.resumeFile?.error || 'CV or résumé must pass verification before using Google sign-up.';
        missingSections.add('professional details');
      }
    } else if (formData?.accountType === 'company') {
      if (!formData?.companyName?.trim()) {
        missingFields.companyName = 'Company name is required before using Google sign-up.';
        missingSections.add('company information');
      }
      if (!formData?.companySize) {
        missingFields.companySize = 'Company size is required before using Google sign-up.';
        missingSections.add('company information');
      }
      if (!formData?.industry) {
        missingFields.industry = 'Industry is required before using Google sign-up.';
        missingSections.add('company information');
      }
      if (!formData?.jobTitle?.trim()) {
        missingFields.jobTitle = 'Job title is required before using Google sign-up.';
        missingSections.add('company information');
      }
      if (!formData?.department) {
        missingFields.department = 'Department is required before using Google sign-up.';
        missingSections.add('company information');
      }
      if (!formData?.hiringVolume) {
        missingFields.hiringVolume = 'Hiring volume is required before using Google sign-up.';
        missingSections.add('company information');
      }
      if (!formData?.companyLogo) {
        missingFields.companyLogo = 'Company logo is required before using Google sign-up.';
        missingSections.add('company verification');
      }
      if (uploadModeration?.companyLogo?.status !== 'approved') {
        missingFields.companyLogo = uploadModeration?.companyLogo?.error || 'Company logo must pass moderation before using Google sign-up.';
        missingSections.add('company verification');
      }
      if (!formData?.companyProof) {
        missingFields.companyProof = 'Verification document is required before using Google sign-up.';
        missingSections.add('company verification');
      } else if (uploadModeration?.companyProof?.status !== 'approved') {
        missingFields.companyProof = uploadModeration?.companyProof?.error || 'Verification document must pass moderation before using Google sign-up.';
        missingSections.add('company verification');
      }
    }

    if (!formData?.agreeToTerms) {
      missingFields.agreeToTerms = 'You must agree to the Terms of Service before continuing with Google.';
      missingSections.add('terms & privacy');
    }

    if (Object.keys(missingFields)?.length) {
      const sections = Array.from(missingSections);
      let formattedSection = 'the required details';
      if (sections.length === 1) {
        formattedSection = sections[0];
      } else if (sections.length > 1) {
        const lastSection = sections[sections.length - 1];
        const initialSections = sections.slice(0, -1);
        formattedSection = `${initialSections.join(', ')} and ${lastSection}`;
      }

      setErrors((prev) => ({ ...prev, ...missingFields }));
      setStatus('info');
      setMessage(`Please complete ${formattedSection} before continuing with Google.`);
      return false;
    }

    return true;
  };

  const handleSocialRegister = async (provider) => {
    if (!provider || provider.id !== 'google') {
      return;
    }

    if (!validateSocialRegistrationRequirements()) {
      return;
    }

    setIsLoading(true);
    setErrors({});
    setStatus('');
    setMessage('');

    let signedInWithGoogle = false;

    try {
      localStorage.setItem('socialAuthIntent', 'register');
      if (formData?.accountType) {
        localStorage.setItem('pendingAccountType', formData.accountType);
      }

      const { data, error } = await authHelpers.signInWithGoogle();
      if (error) {
        throw new Error(error.message || 'Google sign-in failed. Please try again.');
      }

      if (!data?.user) {
        throw new Error('Failed to retrieve Google account information.');
      }

      signedInWithGoogle = true;

      try {
        const existingUser = await apiClient.auth.getMe();
        if (existingUser.success && existingUser.user) {
          await authHelpers.signOut();
          localStorage.removeItem('pendingRegistration');
          localStorage.removeItem('pendingAccountType');
          localStorage.removeItem('socialAuthIntent');

          setStatus('info');
          setMessage('An InterviewAI account already exists for this Google email. Redirecting you to Sign In...');

          setTimeout(() => {
            navigate(loginHref);
          }, 2000);
          return;
        }
      } catch (apiError) {
        if (!apiError.message || !apiError.message.toLowerCase().includes('not found')) {
          throw apiError;
        }
      }

      const accountTypeUpper = (formData.accountType || 'candidate').toUpperCase();
      const registrationPayload = {
        accountType: accountTypeUpper,
        email: data.user.email || undefined,
        fullName: formData.fullName || data.user.user_metadata?.fullName || data.user.email?.split('@')[0] || 'New User',
        experienceLevel: formData.accountType === 'candidate' ? formData.experienceLevel || undefined : undefined,
        gender: formData.accountType === 'candidate' ? formData.gender || undefined : undefined,
        targetRole: formData.accountType === 'candidate' ? formData.targetRole || undefined : undefined,
        careerGoals: formData.accountType === 'candidate' ? formData.careerGoals || undefined : undefined,
        location: formData.accountType === 'candidate' ? formData.location || undefined : undefined,
        preferredLanguage: formData.accountType === 'candidate' ? formData.preferredLanguage || undefined : undefined,
        companyName: formData.accountType === 'company' ? formData.companyName || undefined : undefined,
        companySize: formData.accountType === 'company' ? formData.companySize || undefined : undefined,
        jobTitle: formData.accountType === 'company' ? formData.jobTitle || undefined : undefined,
        department: formData.accountType === 'company' ? formData.department || undefined : undefined,
        hiringVolume: formData.accountType === 'company' ? formData.hiringVolume || undefined : undefined,
        companyWebsite: formData.accountType === 'company' ? formData.companyWebsite || undefined : undefined,
        companyLocation: formData.accountType === 'company' ? formData.companyLocation || undefined : undefined,
        phoneNumber: formData.accountType === 'company' ? formData.phoneNumber || undefined : undefined,
        industry: formData.industry || undefined,
      };

      const registerData = await apiClient.auth.register(prepareRegistrationRequestBody(registrationPayload));

      if (registerData.success && registerData.user) {
        localStorage.setItem('user', JSON.stringify(registerData.user));
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.removeItem('pendingRegistration');
        localStorage.removeItem('pendingAccountType');
        localStorage.removeItem('socialAuthIntent');
        setAuthenticatedUser(registerData.user);

        // For company accounts, show approval pending message
        if (formData.accountType === 'company') {
          setStatus('success');
          setMessage('Registration successful! Your organization is pending admin approval. You will be redirected to your dashboard where you can view the approval status. This typically takes 1-2 business days.');
          
          // Redirect after showing message
          setTimeout(() => {
            const redirectPath = '/company-dashboard';
            navigate(redirectAfterAuth || redirectPath);
          }, 4000);
          return;
        }

        // For candidates, redirect immediately
        const redirectPath = formData.accountType === 'candidate'
          ? '/candidate-dashboard'
          : '/company-dashboard';

        navigate(redirectAfterAuth || redirectPath);
        return;
      }

      throw new Error('Failed to complete registration with Google.');
    } catch (error) {
      console.error('Google registration error:', error);
      setErrors({
        submit: friendlyRateLimitMessage(error.message) || 'Google registration failed. Please try again.',
      });

      if (signedInWithGoogle) {
        try {
          await authHelpers.signOut();
        } catch (signOutError) {
          console.error('Failed to clean up Google session:', signOutError);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    
    if (!validateStep(3)) return;

    setIsLoading(true);
    setErrors({});
    setStatus('');
    setMessage('');
    
    try {
      // Mark this as a registration attempt
      localStorage.setItem('socialAuthIntent', 'register');
      
      // Store registration form data BEFORE creating auth account
      const registrationData = {
        accountType: formData.accountType,
        fullName: formData.fullName,
        gender: formData.gender,
        experienceLevel: formData.experienceLevel,
        industry: formData.industry,
        targetRole: formData.targetRole,
        careerGoals: formData.careerGoals,
        location: formData.location,
        preferredLanguage: formData.preferredLanguage,
        companyName: formData.companyName,
        companySize: formData.companySize,
        jobTitle: formData.jobTitle,
        department: formData.department,
        hiringVolume: formData.hiringVolume,
        companyWebsite: formData.companyWebsite,
        companyLocation: formData.companyLocation,
        phoneNumber: formData.phoneNumber,
      };
      localStorage.setItem('pendingRegistration', JSON.stringify(registrationData));
      localStorage.setItem('pendingAccountType', formData.accountType);

      const normalizedEmail = (formData.email || '').trim().toLowerCase();
      let hasMatchingFirebaseSession = false;

      try {
        const { data: sessionSnapshot } = await authHelpers.getSession();
        const existingSession = sessionSnapshot?.session;
        const existingEmail = (existingSession?.user?.email || '').trim().toLowerCase();

        if (existingSession?.access_token && normalizedEmail && existingEmail === normalizedEmail) {
          hasMatchingFirebaseSession = true;
        } else if (existingSession?.access_token && existingEmail && normalizedEmail && existingEmail !== normalizedEmail) {
          await authHelpers.signOut();
        }
      } catch (error) {
        console.warn('Failed to check existing Firebase session:', error);
      }

      // Step 1: Ensure we have an authenticated Firebase session
      if (!hasMatchingFirebaseSession) {
        const { data: authData, error: authError } = await authHelpers.signUp(
          formData.email,
          formData.password,
          {
            fullName: formData.fullName,
            accountType: formData.accountType,
          }
        );

        if (authError) {
          const errorCode = authError?.code;

          if (errorCode === 'auth/email-already-in-use') {
            const { error: signInError } = await authHelpers.signIn(formData.email, formData.password);
            if (signInError) {
              throw new Error(signInError.message || 'Email is already in use. Please sign in instead.');
            }
          } else {
            throw new Error(authError.message || 'Registration failed');
          }
        } else if (!authData?.user) {
          throw new Error('Failed to create user account');
        }
      }

      // Step 2: Check if email confirmation is required
      // Note: Firebase email verification works differently - user can sign in immediately
      // but emailVerified will be false until they verify
      const { data: sessionData } = await authHelpers.getSession();
      const session = sessionData?.session;
      
      // If session exists immediately, email confirmation might be disabled
      if (session && session.access_token) {
        console.log('Session available immediately, syncing with backend...');
        
        // Sync user data with backend database
        const accountTypeUpper = (formData.accountType || 'candidate').toUpperCase();
        
        try {
          const registerData = await apiClient.auth.register(
            prepareRegistrationRequestBody({
            accountType: accountTypeUpper,
            email: formData.email || undefined,
            fullName: formData.fullName,
            experienceLevel: formData.experienceLevel || undefined,
            gender: formData.accountType === 'candidate' ? formData.gender || undefined : undefined,
            targetRole: formData.accountType === 'candidate' ? formData.targetRole || undefined : undefined,
            careerGoals: formData.accountType === 'candidate' ? formData.careerGoals || undefined : undefined,
            location: formData.accountType === 'candidate' ? formData.location || undefined : undefined,
            preferredLanguage: formData.accountType === 'candidate' ? formData.preferredLanguage || undefined : undefined,
            companyName: formData.companyName || undefined,
            companySize: formData.accountType === 'company' ? formData.companySize || undefined : undefined,
            jobTitle: formData.accountType === 'company' ? formData.jobTitle || undefined : undefined,
            department: formData.accountType === 'company' ? formData.department || undefined : undefined,
            hiringVolume: formData.accountType === 'company' ? formData.hiringVolume || undefined : undefined,
            companyWebsite: formData.accountType === 'company' ? formData.companyWebsite || undefined : undefined,
            companyLocation: formData.accountType === 'company' ? formData.companyLocation || undefined : undefined,
            phoneNumber: formData.accountType === 'company' ? formData.phoneNumber || undefined : undefined,
            industry: formData.industry || undefined,
            })
          );

          if (registerData.success && registerData.user) {
            // Store session and cleanup
            localStorage.setItem('user', JSON.stringify(registerData.user));
            localStorage.setItem('isAuthenticated', 'true');
            localStorage.removeItem('pendingRegistration');
            localStorage.removeItem('pendingAccountType');
            localStorage.removeItem('socialAuthIntent');
            setAuthenticatedUser(registerData.user);
            
            // For company accounts, show approval pending message
            if (formData.accountType === 'company') {
              setStatus('success');
              setMessage('Registration successful! Your organization is pending admin approval. You will be redirected to your dashboard where you can view the approval status. This typically takes 1-2 business days.');
              
              // Redirect after showing message
              setTimeout(() => {
                const redirectPath = '/company-dashboard';
                navigate(redirectAfterAuth || redirectPath);
              }, 4000);
              return;
            }
            
            // For candidates, redirect immediately
            const redirectPath = formData.accountType === 'candidate' 
              ? '/candidate-dashboard' 
              : '/company-dashboard';
            
            navigate(redirectAfterAuth || redirectPath);
            return;
          }
        } catch (apiError) {
          console.error('Backend registration error:', apiError);
          throw new Error('Failed to complete registration in backend: ' + (apiError.message || 'Unknown error'));
        }
      } else {
        // Email confirmation is required
        setStatus('success');
        setMessage('Registration successful! Please check your email to verify your account.');
        // User will complete registration when they verify email
        setTimeout(() => {
          navigate(loginHref);
        }, 3000);
      }
      
    } catch (error) {
      console.error('Registration error:', error);
      setErrors({ 
        submit: friendlyRateLimitMessage(error.message) || 'Registration failed. Please try again.' 
      });
      // Clean up on error
      localStorage.removeItem('socialAuthIntent');
    } finally {
      setIsLoading(false);
    }
  };

  // Store account type when it changes for social auth
  useEffect(() => {
    if (formData?.accountType) {
      localStorage.setItem('pendingAccountType', formData.accountType);
    }
  }, [formData?.accountType]);

  // Listen for verification completion from verify-email tab
  useEffect(() => {
    const checkVerification = () => {
      if (localStorage.getItem('socialAuthVerified') === 'true') {
        // User has been verified in another tab
        const verifiedData = localStorage.getItem('socialAuthData');
        if (verifiedData) {
          try {
            const userData = JSON.parse(verifiedData);
            localStorage.setItem('user', JSON.stringify(userData.user));
            localStorage.setItem('isAuthenticated', 'true');
            localStorage.removeItem('socialAuthVerified');
            localStorage.removeItem('socialAuthData');
            localStorage.removeItem('pendingAccountType');
            
            // Redirect to dashboard
            const accountType = userData.user.accountType?.toLowerCase();
            const dashboardRoute = accountType === 'candidate' 
              ? '/candidate-dashboard' 
              : '/company-dashboard';
            navigate(redirectAfterAuth || dashboardRoute);
          } catch (error) {
            console.error('Failed to process verification data:', error);
          }
        }
      }
    };

    // Listen for storage events (from other tabs)
    const handleStorageChange = (e) => {
      if (e.key === 'socialAuthVerified' && e.newValue === 'true') {
        checkVerification();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Also check periodically for localStorage changes (works for same-tab too)
    const interval = setInterval(checkVerification, 500);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [navigate, redirectAfterAuth]);

  const getStepTitle = () => {
    switch (currentStep) {
      case 1: return 'Create Your Account';
      case 2: return `${formData?.accountType === 'candidate' ? 'Professional' : 'Company'} Information`;
      case 3: return 'Terms & Privacy';
      default: return 'Create Your Account';
    }
  };

  const getStepDescription = () => {
    switch (currentStep) {
      case 1: return 'Start your AI interview journey with basic account setup';
      case 2: return formData?.accountType === 'candidate' ?'Help us personalize your interview experience' :'Tell us about your company and hiring needs';
      case 3: return 'Review and accept our terms to complete registration';
      default: return 'Start your AI interview journey';
    }
  };

  const isStep2ModerationBlocking = currentStep === 2 && (
    formData?.accountType === 'candidate'
      ? (uploadModeration?.profilePhoto?.status !== 'approved' || uploadModeration?.resumeFile?.status !== 'approved')
      : (
        uploadModeration?.companyLogo?.status !== 'approved'
        || uploadModeration?.companyProof?.status !== 'approved'
      )
  );

  return (
    <>
      <Helmet>
        <title>Register - InterviewAI Pro</title>
        <meta
          name="description"
          content="Create your InterviewAI Pro account and start practicing interviews with AI-powered feedback and analytics."
        />
      </Helmet>
      <div className="relative min-h-screen lg:h-screen bg-gradient-to-b from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 overflow-hidden transition-colors duration-300">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div className="absolute -top-32 right-0 h-[420px] w-[420px] bg-gradient-to-br from-blue-500/35 via-purple-500/20 to-transparent blur-[150px]" />
          <div className="absolute bottom-0 -left-24 h-[520px] w-[520px] bg-gradient-to-tr from-indigo-300/25 via-cyan-200/20 to-transparent blur-[140px]" />
          <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.12),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(147,51,234,0.12),transparent_40%)]" />
        </div>
        <div className="relative z-10 flex min-h-screen lg:h-screen flex-col">
          <header className="flex-shrink-0">
            <div className="max-w-6xl mx-auto w-full px-3 sm:px-4 lg:px-6 py-4">
              <div className="flex items-center justify-between rounded-2xl border border-white/30 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 px-4 py-3 shadow-[0_10px_40px_rgba(15,23,42,0.08)] dark:shadow-[0_10px_40px_rgba(0,0,0,0.3)] backdrop-blur">
                <BrandMark
                  showTagline
                  className="items-start"
                  iconWrapperClassName="w-10 h-10 rounded-2xl"
                  textClassName="text-sm md:text-base font-semibold"
                  taglineClassName="text-xs md:text-sm text-gray-500 dark:text-slate-400"
                />
                <div className="flex items-center space-x-3">
                  <span className="hidden sm:block text-sm md:text-base text-gray-500 dark:text-slate-400">Already have an account?</span>
                  <Button
                    variant="ghost"
                    onClick={() => window.location.href = '/login'}
                    className="rounded-full border border-white/40 dark:border-slate-700/50 text-gray-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    Sign In
                  </Button>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 min-h-0 w-full px-3 sm:px-4 lg:px-6 pb-2 lg:pb-3">
            <motion.div
              variants={sectionReveal}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 lg:grid-cols-12 gap-4 max-w-6xl mx-auto"
            >
              <motion.div variants={fadeUpChild} className="lg:col-span-4 flex flex-col">
                <div className="rounded-3xl border border-white/30 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-5 lg:p-6 h-full flex flex-col shadow-[0_20px_70px_rgba(15,23,42,0.12)] dark:shadow-[0_20px_70px_rgba(0,0,0,0.4)] backdrop-blur">
                  <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">Registration Progress</h3>
                  <div className="space-y-3 flex-1">
                    {[
                      { step: 1, title: 'Account Type & Basic Info', icon: 'User' },
                      { step: 2, title: 'Professional Details', icon: 'Briefcase' },
                      { step: 3, title: 'Terms & Completion', icon: 'CheckCircle' }
                    ]?.map((item) => (
                      <div
                        key={item?.step}
                        className={`flex items-center space-x-3 p-3 rounded-2xl border transition-colors duration-200 ${
                          currentStep === item?.step
                            ? 'border-blue-500/40 dark:border-blue-500/60 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 shadow-[0_10px_30px_rgba(59,130,246,0.2)]'
                            : currentStep > item?.step
                            ? 'border-emerald-400/40 dark:border-emerald-500/60 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                            : 'border-white/30 dark:border-slate-700/50 bg-white/70 dark:bg-slate-800/70 text-gray-500 dark:text-slate-400'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-full bg-white/80 dark:bg-slate-700/80 flex items-center justify-center flex-shrink-0 shadow-inner">
                          <Icon 
                            name={currentStep > item?.step ? 'Check' : item?.icon} 
                            size={16} 
                            className="text-current"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm md:text-base font-semibold">
                            Step {item?.step}
                          </div>
                          <div className="text-xs md:text-sm text-gray-500 dark:text-slate-400">
                            {item?.title}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-3 border-t border-white/30">
                  <h4 className="text-sm md:text-base font-semibold text-gray-900 dark:text-slate-100 mb-2">Why InterviewAI Pro?</h4>
                    <ul className="space-y-2 text-xs md:text-sm text-gray-500 dark:text-slate-400">
                      <li className="flex items-center space-x-2">
                        <Icon name="Zap" size={12} className="text-purple-500" />
                        <span>AI-powered practice</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <Icon name="BarChart3" size={12} className="text-emerald-500" />
                        <span>Real-time analytics</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <Icon name="Shield" size={12} className="text-blue-500" />
                        <span>Secure & confidential</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <Icon name="Users" size={12} className="text-cyan-500" />
                        <span>10,000+ users</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </motion.div>

              <motion.div variants={fadeUpChild} className="lg:col-span-8 flex flex-col min-h-0">
                <div className="rounded-3xl border border-white/30 dark:border-slate-700/50 bg-white/85 dark:bg-slate-800/85 shadow-[0_25px_80px_rgba(15,23,42,0.15)] dark:shadow-[0_25px_80px_rgba(0,0,0,0.5)] p-5 md:p-6 h-full flex flex-col backdrop-blur">
                  <div className="text-center mb-4 flex-shrink-0">
                    <h1 className="text-xl md:text-2xl lg:text-3xl font-semibold text-gray-900 dark:text-slate-100 mb-1">
                      {getStepTitle()}
                    </h1>
                    <p className="text-sm md:text-base text-gray-500 dark:text-slate-400">
                      {getStepDescription()}
                    </p>
                  </div>
                  <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
                    <div className="flex-1 flex flex-col min-h-0 space-y-4">
                      {currentStep === 1 && (
                        <div className="flex-1 min-h-0 max-h-[62vh] lg:max-h-[58vh] overflow-y-auto px-1 pr-3 space-y-4 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-slate-600">
                          <AccountTypeSelector
                            selectedType={formData?.accountType}
                            onTypeChange={(type) => handleFieldChange('accountType', type)}
                          />
                          <SocialRegistration
                            isLoading={isLoading}
                            onSocialRegister={handleSocialRegister}
                          />
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Input
                              label="Full Name"
                              type="text"
                              placeholder="Enter your full name"
                              value={formData?.fullName}
                              onChange={(e) => handleFieldChange('fullName', e?.target?.value)}
                              error={errors?.fullName}
                              required
                            />
                            <Input
                              label="Email Address"
                              type="email"
                              placeholder="Enter your email address"
                              value={formData?.email}
                              onChange={(e) => handleFieldChange('email', e?.target?.value)}
                              error={errors?.email}
                              required
                            />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-4">
                            <div className="space-y-2">
                              <Input
                                label="Password"
                                type="password"
                                placeholder="Create a strong password"
                                value={formData?.password}
                                onChange={(e) => handleFieldChange('password', e?.target?.value)}
                                error={errors?.password}
                                required
                              />
                              <PasswordStrengthIndicator password={formData?.password} />
                            </div>
                            <div className="space-y-2">
                              <Input
                                label="Confirm Password"
                                type="password"
                                placeholder="Confirm your password"
                                value={formData?.confirmPassword}
                                onChange={(e) => handleFieldChange('confirmPassword', e?.target?.value)}
                                error={errors?.confirmPassword}
                                required
                              />
                              <PasswordMatchIndicator 
                                password={formData?.password} 
                                confirmPassword={formData?.confirmPassword} 
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {currentStep === 2 && (
                        <div className="flex-1 min-h-0 max-h-[55vh] lg:max-h-[50vh] overflow-y-auto px-1 pr-3 space-y-4 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-slate-600">
                          {formData?.accountType === 'candidate' ? (
                            <CandidateFields
                              formData={formData}
                              onFieldChange={handleFieldChange}
                              errors={errors}
                              onDetectLocation={handleDetectLocation}
                              isDetectingLocation={isDetectingLocation}
                              locationHelper={locationHelper}
                              uploadModeration={uploadModeration}
                              onModerateUpload={moderateUpload}
                              onResetModeration={resetUploadModeration}
                            />
                          ) : (
                            <CompanyFields
                              formData={formData}
                              onFieldChange={handleFieldChange}
                              errors={errors}
                              onDetectLocation={handleDetectLocation}
                              isDetectingLocation={isDetectingLocation}
                              locationHelper={locationHelper}
                              uploadModeration={uploadModeration}
                              onModerateUpload={moderateUpload}
                              onResetModeration={resetUploadModeration}
                            />
                          )}
                        </div>
                      )}

                      {currentStep === 3 && (
                        <div className="flex-1 min-h-0 max-h-[55vh] lg:max-h-[50vh] overflow-y-auto px-1 pr-3 space-y-4 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-slate-600">
                          <TermsAndPrivacy
                            agreeToTerms={formData?.agreeToTerms}
                            agreeToMarketing={formData?.agreeToMarketing}
                            onTermsChange={(checked) => handleFieldChange('agreeToTerms', checked)}
                            onMarketingChange={(checked) => handleFieldChange('agreeToMarketing', checked)}
                            errors={errors}
                          />
                        </div>
                      )}

                      {message && (
                        <div
                          className={`p-4 rounded-2xl border ${
                            status === 'success'
                              ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                              : 'border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400'
                          } flex items-center space-x-2`}
                        >
                          <Icon
                            name={status === 'success' ? 'CheckCircle' : 'Info'}
                            size={16}
                            className={status === 'success' ? 'text-emerald-500 dark:text-emerald-400' : 'text-sky-500 dark:text-sky-400'}
                          />
                          <p className="text-sm">{message}</p>
                        </div>
                      )}

                      {errors?.submit && (
                        <div className="p-4 rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 flex items-center space-x-2">
                          <Icon name="AlertCircle" size={16} className="text-rose-500 dark:text-rose-400" />
                          <p className="text-sm">{errors?.submit}</p>
                        </div>
                      )}

                      <div className="flex items-center justify-center gap-4 flex-shrink-0">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={handlePrevStep}
                          disabled={currentStep === 1}
                          iconName="ChevronLeft"
                          iconPosition="left"
                          className="h-10 rounded-full text-sm text-gray-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400"
                        >
                          Previous
                        </Button>
                        <div className="flex items-center space-x-2">
                          {[1, 2, 3]?.map((step) => (
                            <div
                              key={step}
                              className={`w-2 h-2 rounded-full transition-colors duration-200 ${
                                step <= currentStep ? 'bg-blue-600' : 'bg-gray-200 dark:bg-slate-700'
                              }`}
                            />
                          ))}
                        </div>
                        {currentStep < 3 ? (
                          <Button
                            type="button"
                            variant="default"
                            onClick={handleNextStep}
                            iconName="ChevronRight"
                            iconPosition="right"
                            className="h-10 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6"
                            loading={currentStep === 1 && isCheckingEmail}
                            disabled={(currentStep === 1 && isCheckingEmail) || (currentStep === 2 && isStep2ModerationBlocking)}
                          >
                            Next
                          </Button>
                        ) : (
                          <div className="flex flex-col sm:flex-row gap-3">
                            <Button
                              type="submit"
                              variant="default"
                              loading={isLoading}
                              iconName="UserPlus"
                              iconPosition="left"
                              className="h-10 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6"
                            >
                              Create Account
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              loading={isLoading}
                              iconName="Chrome"
                              iconPosition="left"
                              className="h-10 rounded-full border border-blue-200 text-blue-600 hover:border-blue-400 hover:text-blue-700"
                              onClick={() => handleSocialRegister({ id: 'google', name: 'Google' })}
                              disabled={isLoading}
                            >
                              Complete with Google
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </form>
                </div>
              </motion.div>
            </motion.div>
          </main>

          <footer className="flex-shrink-0">
            <div className="max-w-6xl mx-auto w-full px-3 sm:px-4 lg:px-6 py-2 lg:py-3">
              <div className="text-center text-xs md:text-sm text-gray-500 dark:text-slate-400">
                <p>
                © {new Date()?.getFullYear()} InterviewAI Pro ·
                  <a href="/privacy" className="text-blue-600 hover:underline mx-1">Privacy</a>·
                  <a href="/terms" className="text-blue-600 hover:underline mx-1">Terms</a>·
                  <a href="/support" className="text-blue-600 hover:underline mx-1">Support</a>
                </p>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </>
  );
};

export default Register;
