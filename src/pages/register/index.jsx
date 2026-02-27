import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ref, onValue, off } from 'firebase/database';
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
import { authHelpers, realtimeDb } from '../../config/firebase.js';
import apiClient from '../../services/apiClient.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import {
  buildPendingApprovalRoute,
  getOrganizationId,
  getOrganizationRejectionReason,
  getOrganizationSuspensionReason,
  getOrganizationStatus,
  isRestrictedCompanyUser,
} from '../../utils/organizationAccess.js';
import {
  passwordMeetsAllRequirements,
  PASSWORD_REQUIREMENT_MESSAGE,
} from '../../utils/passwordValidation';
import {
  deriveCandidatePrefillUpdates,
  formatAppliedPrefillFields,
} from '../../utils/candidateResumePrefill.js';

const MIN_REREVIEW_NOTE_LENGTH = 15;

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
    phoneNumber: '', // For candidates - interview reminders
    highestQualification: '',
    fieldOfStudy: '',
    institutionName: '',
    graduationYear: '',
    skills: [],
    certifications: [],
    linkedinUrl: '', // For candidates
    githubUrl: '',
    portfolioUrl: '',
    availability: '',
    preferredWorkType: '',
    preferredEmploymentType: '',
    expectedSalary: '',
    
    // Company specific fields
    companyName: '',
    companyType: '',
    companySize: '',
    jobTitle: '',
    department: '',
    hiringVolume: '',
    companyWebsite: '',
    companyLocation: '',
    companyPhoneNumber: '', // For companies
    companyAddress: '',
    companyDescription: '',
    facebookUrl: '',
    companyLinkedinUrl: '', // For companies
    companyLogo: null,
    companyProof: null,
    businessRegistrationNumber: '',
    companyEmail: '',
    establishedYear: '',
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
  const [resumePrefillState, setResumePrefillState] = useState({
    status: 'idle', // idle | parsing | success | error
    message: '',
    suggestions: [],
  });
  const [emailVerification, setEmailVerification] = useState({
    status: 'idle',
    message: '',
    email: '',
  });
  const [isSendingVerification, setIsSendingVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationCodeError, setVerificationCodeError] = useState('');
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [resendAvailableAt, setResendAvailableAt] = useState(null);
  const [resendSeconds, setResendSeconds] = useState(0);
  
  // Organization approval state (for company accounts)
  const [organizationId, setOrganizationId] = useState(null);
  const [organizationStatus, setOrganizationStatus] = useState(null); // 'PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'
  const [organizationRejectionReason, setOrganizationRejectionReason] = useState('');
  const [organizationSuspensionReason, setOrganizationSuspensionReason] = useState('');
  const [reReviewNote, setReReviewNote] = useState('');
  const [reReviewRequestedAt, setReReviewRequestedAt] = useState('');
  const [isRequestingReReview, setIsRequestingReReview] = useState(false);
  const [isUploadingReReviewProof, setIsUploadingReReviewProof] = useState(false);
  const [isUploadingReReviewLogo, setIsUploadingReReviewLogo] = useState(false);
  const reReviewProofInputRef = React.useRef(null);
  const reReviewLogoInputRef = React.useRef(null);

  const getSafeRedirectPath = (value) => {
    if (!value || typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return null;
    if (trimmed.startsWith('/login') || trimmed.startsWith('/register')) return null;
    return trimmed;
  };

  const redirectAfterAuth = getSafeRedirectPath(searchParams.get('redirect'));
  const loginHref = redirectAfterAuth ? `/login?redirect=${encodeURIComponent(redirectAfterAuth)}` : '/login';
  const supportContactEmail = (import.meta.env.VITE_SMTP_USER || import.meta.env.VITE_FROM_EMAIL || '').trim();

  const viewportConfig = { once: true, amount: 0.2 };
  const friendlyRateLimitMessage = (text) => {
    if (!text) return '';
    const normalized = text.toLowerCase();
    if (normalized.includes('too many authentication attempts')) {
      return "You've tried a few times. Please wait 15 minutes before trying again.";
    }
    return text;
  };

  const extractWaitSeconds = (text) => {
    if (!text) return null;
    const match = text.match(/wait\s+(\d+)\s+seconds/i);
    return match ? Number(match[1]) : null;
  };

  const normalizeEmail = (value) => (value || '').trim().toLowerCase();
  const normalizeDepartmentValue = (value) => {
    const trimmed = (value || '').trim();
    if (!trimmed) return '';
    return trimmed.toLowerCase() === 'other' ? '' : trimmed;
  };

  const formatDateTime = (value) => {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toLocaleString();
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

  const handleCandidateModerateUpload = async (type, file, options = {}) => {
    await moderateUpload(type, file, options);

    if (type !== 'resumeFile' || !file) {
      return true;
    }

    setResumePrefillState({
      status: 'parsing',
      message: `Parsing ${file.name} and pre-filling candidate details...`,
      suggestions: [],
    });

    try {
      const result = await apiClient.auth.parseResume(file, { accountType: 'candidate' });

      if (!result?.success || !result?.extracted) {
        throw new Error(result?.error || 'Resume parsing was unsuccessful.');
      }

      let appliedFields = [];
      let suggestedFields = [];
      setFormData((prev) => {
        const { updates, appliedFields: applied, suggestions } = deriveCandidatePrefillUpdates(
          prev,
          result.extracted,
          { confidence: result?.confidence || {} },
        );
        appliedFields = applied;
        suggestedFields = suggestions;
        return applied.length > 0 ? { ...prev, ...updates } : prev;
      });

      if (appliedFields.length > 0) {
        setErrors((prev) => {
          if (!prev || Object.keys(prev).length === 0) return prev;
          const next = { ...prev };
          appliedFields.forEach((field) => {
            delete next[field];
          });
          return next;
        });
        setResumePrefillState({
          status: 'success',
          message: suggestedFields.length > 0
            ? `Pre-filled ${appliedFields.length} field${appliedFields.length === 1 ? '' : 's'}: ${formatAppliedPrefillFields(appliedFields)}. Some fields need your review before applying.`
            : `Pre-filled ${appliedFields.length} field${appliedFields.length === 1 ? '' : 's'}: ${formatAppliedPrefillFields(appliedFields)}. You can edit anything before creating the account.`,
          suggestions: suggestedFields,
        });
      } else {
        setResumePrefillState({
          status: 'success',
          message: suggestedFields.length > 0
            ? 'Resume parsed. No high-confidence updates were auto-applied. Review suggested values below.'
            : 'Resume parsed. Existing form values were kept. You can still edit all details manually.',
          suggestions: suggestedFields,
        });
      }
    } catch (error) {
      setResumePrefillState({
        status: 'error',
        message: friendlyRateLimitMessage(error?.message) || 'Could not parse this resume right now. You can fill the details manually and continue.',
        suggestions: [],
      });
    }

    return true;
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
      setResumePrefillState({ status: 'idle', message: '', suggestions: [] });
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
      if (Array.isArray(value)) {
        const filteredValues = value
          .map((item) => (typeof item === 'string' ? item.trim() : item))
          .filter((item) => item !== undefined && item !== null && item !== '');
        if (filteredValues.length === 0) {
          return;
        }
        filteredValues.forEach((item) => {
          multipartPayload.append(key, item);
        });
        return;
      }

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
        companyAddress: pendingData.companyAddress || prev.companyAddress,
        companyDescription: pendingData.companyDescription || prev.companyDescription,
        facebookUrl: pendingData.facebookUrl || prev.facebookUrl,
        linkedinUrl: pendingData.linkedinUrl || prev.linkedinUrl,
        youtubeUrl: pendingData.youtubeUrl || prev.youtubeUrl,
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
            const accountType = userData.user.accountType?.toLowerCase();
            // Redirect non-public account types (no user-facing reference)
            if (accountType === 'system_admin') {
              navigate('/admin', { replace: true });
              return;
            }

            if (isRestrictedCompanyUser(userData.user)) {
              // Company with restricted organization status - keep user in Step 4
              const orgId = getOrganizationId(userData.user);
              const orgStatus = getOrganizationStatus(userData.user) || 'PENDING';
              const rejectionReason = getOrganizationRejectionReason(userData.user) || '';
              const suspensionReason = getOrganizationSuspensionReason(userData.user) || '';
              const lastReReviewRequestAt = userData.user?.organizationContext?.organization?.reReviewRequestedAt || '';
              const isPendingApproval = searchParams.get('pendingApproval') === 'true';
              const orgIdParam = searchParams.get('orgId');

              setOrganizationId(orgId || null);
              setOrganizationStatus(orgStatus);
              setOrganizationRejectionReason(rejectionReason);
              setOrganizationSuspensionReason(suspensionReason);
              setReReviewRequestedAt(lastReReviewRequestAt);
              setCurrentStep(4);
              setFormData((prev) => ({ ...prev, accountType: 'company' }));

              if (!isPendingApproval || (orgId && orgIdParam !== String(orgId))) {
                navigate(buildPendingApprovalRoute(userData.user), { replace: true });
              }
              return;
            }
            
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
  }, [navigate, redirectAfterAuth, searchParams]);

  const handleFieldChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (field === 'resumeFile' && !value) {
      setResumePrefillState({ status: 'idle', message: '', suggestions: [] });
    }
    if (errors?.[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const triggerReReviewFilePicker = (field) => {
    const inputRef = field === 'companyProof' ? reReviewProofInputRef.current : reReviewLogoInputRef.current;
    if (!inputRef) return;
    inputRef.value = '';
    inputRef.click();
  };

  const handleReReviewEvidenceUpload = async (field, event) => {
    const file = event?.target?.files?.[0];
    if (!file) return;

    const isProofUpload = field === 'companyProof';
    const setUploading = isProofUpload ? setIsUploadingReReviewProof : setIsUploadingReReviewLogo;
    setUploading(true);
    setErrors((prev) => ({ ...prev, reReviewEvidence: '' }));

    try {
      if (isProofUpload) {
        await moderateUpload('companyProof', file, {
          metadata: {
            expectedCompanyName: formData?.companyName?.trim() || '',
            expectedCountry: formData?.companyLocation?.trim() || '',
          },
        });

        const result = await apiClient.auth.updateCompanyProof(file);
        if (!result?.success) {
          throw new Error('Failed to upload verification document.');
        }

        setStatus('success');
        setMessage('Verification document updated. You can now submit a re-review request.');
      } else {
        await moderateUpload('companyLogo', file);

        const result = await apiClient.auth.updateCompanyLogo(file);
        if (!result?.success) {
          throw new Error('Failed to upload company logo.');
        }

        setStatus('success');
        setMessage('Company logo updated. You can now submit a re-review request.');
      }
    } catch (error) {
      setErrors((prev) => ({
        ...prev,
        reReviewEvidence: friendlyRateLimitMessage(error?.message)
          || (isProofUpload
            ? 'Failed to upload verification document. Please try again.'
            : 'Failed to upload company logo. Please try again.'),
      }));
    } finally {
      setUploading(false);
      if (event?.target) {
        event.target.value = '';
      }
    }
  };

  const handleRequestReReview = async () => {
    if (!organizationId || isRequestingReReview) return;

    const trimmedNote = reReviewNote.trim();
    if (trimmedNote.length < MIN_REREVIEW_NOTE_LENGTH) {
      setErrors((prev) => ({
        ...prev,
        reReviewNote: `Please provide at least ${MIN_REREVIEW_NOTE_LENGTH} characters before submitting.`,
      }));
      return;
    }

    setIsRequestingReReview(true);
    setErrors((prev) => ({ ...prev, reReviewNote: '', reReviewEvidence: '', submit: '' }));

    try {
      const result = await apiClient.auth.requestOrganizationReReview(trimmedNote);
      if (!result?.success) {
        throw new Error('Failed to submit re-review request.');
      }

      setOrganizationStatus(result?.organization?.status || 'PENDING');
      setReReviewRequestedAt(result?.organization?.reReviewRequestedAt || '');
      setOrganizationRejectionReason(result?.organization?.rejectedReason || '');
      setOrganizationSuspensionReason(result?.organization?.suspensionReason || '');
      setReReviewNote('');
      setStatus('info');
      setMessage(result?.message || 'Re-review request submitted successfully.');
    } catch (error) {
      setErrors((prev) => ({
        ...prev,
        reReviewNote: friendlyRateLimitMessage(error?.message) || 'Failed to submit re-review request. Please try again.',
      }));
    } finally {
      setIsRequestingReReview(false);
    }
  };

  useEffect(() => {
    if (!emailVerification.email) {
      return;
    }
    if (normalizeEmail(emailVerification.email) !== normalizeEmail(formData?.email)) {
      setEmailVerification({ status: 'idle', message: '', email: '' });
      setVerificationCode('');
      setVerificationCodeError('');
      setResendAvailableAt(null);
      setResendSeconds(0);
    }
  }, [emailVerification.email, formData?.email, normalizeEmail]);

  useEffect(() => {
    if (!resendAvailableAt) {
      setResendSeconds(0);
      return;
    }

    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((resendAvailableAt - Date.now()) / 1000));
      setResendSeconds(remaining);
      if (remaining <= 0) {
        setResendAvailableAt(null);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [resendAvailableAt]);

  const ensureFirebaseSessionForVerification = async () => {
    const targetEmail = normalizeEmail(formData?.email);
    if (!targetEmail) {
      throw new Error('Please enter a valid email address.');
    }

    const { data: sessionSnapshot } = await authHelpers.getSession();
    const existingSession = sessionSnapshot?.session;
    const existingEmail = normalizeEmail(existingSession?.user?.email);

    if (existingSession?.access_token && existingEmail === targetEmail) {
      return existingSession.user;
    }

    if (existingSession?.access_token && existingEmail && existingEmail !== targetEmail) {
      await authHelpers.signOut();
    }

    const { data: authData, error: authError } = await authHelpers.signUp(
      formData.email,
      formData.password,
      {
        fullName: formData.fullName,
        accountType: formData.accountType,
      }
    );

    if (authError) {
      if (authError.code === 'auth/email-already-in-use') {
        const { data: signInData, error: signInError } = await authHelpers.signIn(formData.email, formData.password);
        if (signInError || !signInData?.user) {
          throw new Error(signInError?.message || 'Email is already in use. Please sign in instead.');
        }
        return signInData.user;
      }
      throw new Error(authError.message || 'Unable to create your account.');
    }

    if (!authData?.user) {
      throw new Error('Failed to create your account.');
    }

    return authData.user;
  };

  const sendVerificationEmail = async () => {
    const targetEmail = normalizeEmail(formData?.email);
    setIsSendingVerification(true);
    setVerificationCodeError('');
    setEmailVerification({ status: 'sending', message: '', email: targetEmail });

    try {
      await ensureFirebaseSessionForVerification();
      const result = await apiClient.auth.startEmailVerification({
        email: targetEmail,
        fullName: formData.fullName,
      });

      if (result?.verified) {
        await authHelpers.reloadUser();
        await authHelpers.refreshAccessToken();
        setEmailVerification({
          status: 'verified',
          email: targetEmail,
          message: 'Email verified. You can continue to the next step.',
        });
        setVerificationCode('');
        setVerificationCodeError('');
        setResendAvailableAt(null);
        setResendSeconds(0);
        setCurrentStep(2);
        return true;
      }

      setEmailVerification({
        status: 'sent',
        email: targetEmail,
        message: `We sent an 8-digit verification code to ${targetEmail}. Enter it below to continue.`,
      });
      setResendAvailableAt(Date.now() + 60 * 1000);
      return true;
    } catch (error) {
      const message = friendlyRateLimitMessage(error.message) || 'Unable to send a verification code. Please try again.';
      setEmailVerification({
        status: 'error',
        email: targetEmail,
        message,
      });
      const waitSeconds = extractWaitSeconds(error.message);
      if (waitSeconds) {
        setResendAvailableAt(Date.now() + waitSeconds * 1000);
      }
      return false;
    } finally {
      setIsSendingVerification(false);
    }
  };

  const handleVerifyCode = async () => {
    const cleanedCode = (verificationCode || '').replace(/\D/g, '');
    if (cleanedCode.length !== 8) {
      setVerificationCodeError('Enter the 8-digit code from your email.');
      return;
    }

    setIsVerifyingCode(true);
    setVerificationCodeError('');

    try {
      await ensureFirebaseSessionForVerification();
      await apiClient.auth.verifyEmailCode(cleanedCode);
      const { data, error } = await authHelpers.reloadUser();
      if (error || !data?.user?.email_confirmed_at) {
        throw new Error(error?.message || 'Unable to confirm your email verification. Please try again.');
      }

      await authHelpers.refreshAccessToken();
      setEmailVerification({
        status: 'verified',
        email: normalizeEmail(data?.user?.email || formData?.email),
        message: 'Email verified. You can continue to the next step.',
      });
      setVerificationCode('');
      setVerificationCodeError('');
      setResendAvailableAt(null);
      setResendSeconds(0);
      setCurrentStep(2);
    } catch (error) {
      setVerificationCodeError(
        friendlyRateLimitMessage(error.message) || 'Unable to verify the code. Please try again.'
      );
    } finally {
      setIsVerifyingCode(false);
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
        if (!formData?.highestQualification) {
          newErrors.highestQualification = 'Highest qualification is required';
        }
        if (!formData?.profilePhoto) {
          newErrors.profilePhoto = 'Please upload a profile picture';
        }
        if (uploadModeration?.profilePhoto?.status !== 'approved') {
          newErrors.profilePhoto = uploadModeration?.profilePhoto?.error || 'Profile picture must pass moderation before continuing.';
        }
        if (!formData?.resumeFile) {
          newErrors.resumeFile = 'Please upload your CV or resume';
        } else if (uploadModeration?.resumeFile?.status !== 'approved') {
          newErrors.resumeFile = uploadModeration?.resumeFile?.error || 'CV or resume must pass verification before continuing.';
        }
      } else if (formData?.accountType === 'company') {
        if (!formData?.companyName?.trim()) {
          newErrors.companyName = 'Company name is required';
        }
        if (!formData?.companyType) {
          newErrors.companyType = 'Company type is required';
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
        } else if (!normalizeDepartmentValue(formData.department)) {
          newErrors.department = 'Please specify your department when selecting "Other".';
        }
        if (!formData?.hiringVolume) {
          newErrors.hiringVolume = 'Hiring volume is required';
        }
        if (!formData?.companyLocation?.trim()) {
          newErrors.companyLocation = 'Company location is required';
        }
        if (!formData?.businessRegistrationNumber?.trim()) {
          newErrors.businessRegistrationNumber = 'Business registration number is required';
        }
        if (!formData?.companyEmail?.trim()) {
          newErrors.companyEmail = 'Official company email is required';
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

      try {
        const pending = localStorage.getItem('pendingRegistration');
        const pendingData = pending ? JSON.parse(pending) : {};
        localStorage.setItem('pendingRegistration', JSON.stringify({
          ...pendingData,
          accountType: formData.accountType,
          fullName: formData.fullName,
          email: formData.email,
        }));
      } catch {
        localStorage.setItem('pendingRegistration', JSON.stringify({
          accountType: formData.accountType,
          fullName: formData.fullName,
          email: formData.email,
        }));
      }

      try {
        await ensureFirebaseSessionForVerification();
      } catch (error) {
        setEmailVerification({
          status: 'error',
          email: normalizeEmail(formData?.email),
          message: friendlyRateLimitMessage(error.message) || 'Unable to start email verification. Please try again.',
        });
        return;
      }

      if (emailVerification.status === 'sent') {
        setStatus('error');
        setMessage('Please verify the 8-digit code before continuing.');
        return;
      }

      await sendVerificationEmail();
      return;
    }

    setCurrentStep(prev => Math.min(prev + 1, 4));
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
      message: 'Requesting location permissionâ€¦',
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
        message: 'Detecting your cityâ€¦',
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
        throw new Error('We couldnâ€™t convert your coordinates into a city. Please enter it manually.');
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
      if (!formData?.highestQualification) {
        missingFields.highestQualification = 'Highest qualification is required before using Google sign-up.';
        missingSections.add('educational background');
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
        missingFields.resumeFile = 'CV or resume is required before using Google sign-up.';
        missingSections.add('professional details');
      }
      if (formData?.resumeFile && uploadModeration?.resumeFile?.status !== 'approved') {
        missingFields.resumeFile = uploadModeration?.resumeFile?.error || 'CV or resume must pass verification before using Google sign-up.';
        missingSections.add('professional details');
      }
    } else if (formData?.accountType === 'company') {
      if (!formData?.companyName?.trim()) {
        missingFields.companyName = 'Company name is required before using Google sign-up.';
        missingSections.add('company information');
      }
      if (!formData?.companyType) {
        missingFields.companyType = 'Company type is required before using Google sign-up.';
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
      } else if (!normalizeDepartmentValue(formData.department)) {
        missingFields.department = 'Please specify your department when selecting "Other" before using Google sign-up.';
        missingSections.add('company information');
      }
      if (!formData?.hiringVolume) {
        missingFields.hiringVolume = 'Hiring volume is required before using Google sign-up.';
        missingSections.add('company information');
      }
      if (!formData?.companyLocation?.trim()) {
        missingFields.companyLocation = 'Company location is required before using Google sign-up.';
        missingSections.add('company information');
      }
      if (!formData?.businessRegistrationNumber?.trim()) {
        missingFields.businessRegistrationNumber = 'Business registration number is required before using Google sign-up.';
        missingSections.add('company information');
      }
      if (!formData?.companyEmail?.trim()) {
        missingFields.companyEmail = 'Official company email is required before using Google sign-up.';
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
        // Candidate fields
        experienceLevel: formData.accountType === 'candidate' ? formData.experienceLevel || undefined : undefined,
        gender: formData.accountType === 'candidate' ? formData.gender || undefined : undefined,
        targetRole: formData.accountType === 'candidate' ? formData.targetRole || undefined : undefined,
        careerGoals: formData.accountType === 'candidate' ? formData.careerGoals || undefined : undefined,
        location: formData.accountType === 'candidate' ? formData.location || undefined : undefined,
        preferredLanguage: formData.accountType === 'candidate' ? formData.preferredLanguage || undefined : undefined,
        phoneNumber: formData.accountType === 'candidate' ? formData.phoneNumber || undefined : formData.accountType === 'company' ? formData.companyPhoneNumber || undefined : undefined,
        highestQualification: formData.accountType === 'candidate' ? formData.highestQualification || undefined : undefined,
        fieldOfStudy: formData.accountType === 'candidate' ? formData.fieldOfStudy || undefined : undefined,
        institutionName: formData.accountType === 'candidate' ? formData.institutionName || undefined : undefined,
        graduationYear: formData.accountType === 'candidate' ? formData.graduationYear || undefined : undefined,
        skills: formData.accountType === 'candidate' ? formData.skills || [] : undefined,
        certifications: formData.accountType === 'candidate' ? formData.certifications || [] : undefined,
        linkedinUrl: formData.accountType === 'candidate' ? formData.linkedinUrl || undefined : undefined,
        githubUrl: formData.accountType === 'candidate' ? formData.githubUrl || undefined : undefined,
        portfolioUrl: formData.accountType === 'candidate' ? formData.portfolioUrl || undefined : undefined,
        availability: formData.accountType === 'candidate' ? formData.availability || undefined : undefined,
        preferredWorkType: formData.accountType === 'candidate' ? formData.preferredWorkType || undefined : undefined,
        preferredEmploymentType: formData.accountType === 'candidate' ? formData.preferredEmploymentType || undefined : undefined,
        expectedSalary: formData.accountType === 'candidate' ? formData.expectedSalary || undefined : undefined,
        // Company fields
        companyName: formData.accountType === 'company' ? formData.companyName || undefined : undefined,
        companyType: formData.accountType === 'company' ? formData.companyType || undefined : undefined,
        companySize: formData.accountType === 'company' ? formData.companySize || undefined : undefined,
        jobTitle: formData.accountType === 'company' ? formData.jobTitle || undefined : undefined,
        department: formData.accountType === 'company'
          ? normalizeDepartmentValue(formData.department) || undefined
          : undefined,
        hiringVolume: formData.accountType === 'company' ? formData.hiringVolume || undefined : undefined,
        companyWebsite: formData.accountType === 'company' ? formData.companyWebsite || undefined : undefined,
        companyLocation: formData.accountType === 'company' ? formData.companyLocation || undefined : undefined,
        companyAddress: formData.accountType === 'company' ? formData.companyAddress || undefined : undefined,
        companyDescription: formData.accountType === 'company' ? formData.companyDescription || undefined : undefined,
        facebookUrl: formData.accountType === 'company' ? formData.facebookUrl || undefined : undefined,
        companyLinkedinUrl: formData.accountType === 'company' ? formData.companyLinkedinUrl || undefined : undefined,
        businessRegistrationNumber: formData.accountType === 'company' ? formData.businessRegistrationNumber || undefined : undefined,
        companyEmail: formData.accountType === 'company' ? formData.companyEmail || undefined : undefined,
        establishedYear: formData.accountType === 'company' ? formData.establishedYear || undefined : undefined,
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

        // For company accounts, check if organization approval is needed
        if (formData.accountType === 'company') {
          const orgId = getOrganizationId(registerData.user);
          const orgStatus = getOrganizationStatus(registerData.user);
          const rejectionReason = getOrganizationRejectionReason(registerData.user) || '';
          const suspensionReason = getOrganizationSuspensionReason(registerData.user) || '';
          const lastReReviewRequestAt = registerData.user?.organizationContext?.organization?.reReviewRequestedAt || '';
          
          if (orgId && ['PENDING', 'REJECTED', 'SUSPENDED'].includes(orgStatus)) {
            // Organization has a restricted status - keep user in Step 4
            setOrganizationId(orgId);
            setOrganizationStatus(orgStatus);
            setOrganizationRejectionReason(rejectionReason);
            setOrganizationSuspensionReason(suspensionReason);
            setReReviewRequestedAt(lastReReviewRequestAt);
            setCurrentStep(4);
            return;
          } else if (orgStatus === 'APPROVED') {
            // Organization already approved, redirect to dashboard
            navigate(redirectAfterAuth || '/company-dashboard');
            return;
          }
        }

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
      const { data: verifiedSnapshot, error: verifiedError } = await authHelpers.reloadUser();
      if (verifiedError) {
        throw verifiedError;
      }
      if (!verifiedSnapshot?.user?.email_confirmed_at) {
        setErrors({ submit: 'Please verify your email before completing registration.' });
        setStatus('info');
        setMessage('Check your email for the 8-digit verification code, then return to complete registration.');
        return;
      }
      await authHelpers.refreshAccessToken();

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
        companyAddress: formData.companyAddress,
        companyDescription: formData.companyDescription,
        facebookUrl: formData.facebookUrl,
        linkedinUrl: formData.linkedinUrl,
        youtubeUrl: formData.youtubeUrl,
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
            // Candidate fields
            experienceLevel: formData.experienceLevel || undefined,
            gender: formData.accountType === 'candidate' ? formData.gender || undefined : undefined,
            targetRole: formData.accountType === 'candidate' ? formData.targetRole || undefined : undefined,
            careerGoals: formData.accountType === 'candidate' ? formData.careerGoals || undefined : undefined,
            location: formData.accountType === 'candidate' ? formData.location || undefined : undefined,
            preferredLanguage: formData.accountType === 'candidate' ? formData.preferredLanguage || undefined : undefined,
            phoneNumber: formData.accountType === 'candidate' ? formData.phoneNumber || undefined : formData.accountType === 'company' ? formData.companyPhoneNumber || undefined : undefined,
            highestQualification: formData.accountType === 'candidate' ? formData.highestQualification || undefined : undefined,
            fieldOfStudy: formData.accountType === 'candidate' ? formData.fieldOfStudy || undefined : undefined,
            institutionName: formData.accountType === 'candidate' ? formData.institutionName || undefined : undefined,
            graduationYear: formData.accountType === 'candidate' ? formData.graduationYear || undefined : undefined,
            skills: formData.accountType === 'candidate' ? formData.skills || [] : undefined,
            certifications: formData.accountType === 'candidate' ? formData.certifications || [] : undefined,
            linkedinUrl: formData.accountType === 'candidate' ? formData.linkedinUrl || undefined : undefined,
            githubUrl: formData.accountType === 'candidate' ? formData.githubUrl || undefined : undefined,
            portfolioUrl: formData.accountType === 'candidate' ? formData.portfolioUrl || undefined : undefined,
            availability: formData.accountType === 'candidate' ? formData.availability || undefined : undefined,
            preferredWorkType: formData.accountType === 'candidate' ? formData.preferredWorkType || undefined : undefined,
            preferredEmploymentType: formData.accountType === 'candidate' ? formData.preferredEmploymentType || undefined : undefined,
            expectedSalary: formData.accountType === 'candidate' ? formData.expectedSalary || undefined : undefined,
            // Company fields
            companyName: formData.companyName || undefined,
            companyType: formData.accountType === 'company' ? formData.companyType || undefined : undefined,
            companySize: formData.accountType === 'company' ? formData.companySize || undefined : undefined,
            jobTitle: formData.accountType === 'company' ? formData.jobTitle || undefined : undefined,
            department: formData.accountType === 'company'
              ? normalizeDepartmentValue(formData.department) || undefined
              : undefined,
            hiringVolume: formData.accountType === 'company' ? formData.hiringVolume || undefined : undefined,
            companyWebsite: formData.accountType === 'company' ? formData.companyWebsite || undefined : undefined,
            companyLocation: formData.accountType === 'company' ? formData.companyLocation || undefined : undefined,
            companyAddress: formData.accountType === 'company' ? formData.companyAddress || undefined : undefined,
            companyDescription: formData.accountType === 'company' ? formData.companyDescription || undefined : undefined,
            facebookUrl: formData.accountType === 'company' ? formData.facebookUrl || undefined : undefined,
            companyLinkedinUrl: formData.accountType === 'company' ? formData.companyLinkedinUrl || undefined : undefined,
            businessRegistrationNumber: formData.accountType === 'company' ? formData.businessRegistrationNumber || undefined : undefined,
            companyEmail: formData.accountType === 'company' ? formData.companyEmail || undefined : undefined,
            establishedYear: formData.accountType === 'company' ? formData.establishedYear || undefined : undefined,
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
            
            // For company accounts, check if organization approval is needed
            if (formData.accountType === 'company') {
              const orgId = getOrganizationId(registerData.user);
              const orgStatus = getOrganizationStatus(registerData.user);
              const rejectionReason = getOrganizationRejectionReason(registerData.user) || '';
              const suspensionReason = getOrganizationSuspensionReason(registerData.user) || '';
              const lastReReviewRequestAt = registerData.user?.organizationContext?.organization?.reReviewRequestedAt || '';
              
              if (orgId && ['PENDING', 'REJECTED', 'SUSPENDED'].includes(orgStatus)) {
                // Organization has a restricted status - keep user in Step 4
                setOrganizationId(orgId);
                setOrganizationStatus(orgStatus);
                setOrganizationRejectionReason(rejectionReason);
                setOrganizationSuspensionReason(suspensionReason);
                setReReviewRequestedAt(lastReReviewRequestAt);
                setCurrentStep(4);
                return;
              } else if (orgStatus === 'APPROVED') {
                // Organization already approved, redirect to dashboard
                navigate(redirectAfterAuth || '/company-dashboard');
                return;
              }
            }
            
            // For candidate accounts, redirect directly
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
        setMessage('Registration successful! Check your email for the 8-digit verification code to finish verifying your account.');
        // User will complete registration after they verify the code
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

  // Real-time listener for organization approval status
  useEffect(() => {
    if (!organizationId || currentStep !== 4) {
      return;
    }

    // Set up Firebase Realtime Database listener
    const orgStatusRef = ref(realtimeDb, `organizationApprovalStatus/${organizationId}`);
    
    const unsubscribe = onValue(orgStatusRef, (snapshot) => {
      const data = snapshot.val();
      if (data && data.status) {
        setOrganizationStatus(data.status);
        setReReviewRequestedAt(data.reReviewRequestedAt || '');
        if (data.status === 'REJECTED') {
          setOrganizationRejectionReason(data.rejectedReason || '');
        } else {
          setOrganizationRejectionReason('');
        }
        if (data.status === 'SUSPENDED') {
          setOrganizationSuspensionReason(data.suspensionReason || '');
        } else {
          setOrganizationSuspensionReason('');
        }
        
        if (data.status === 'APPROVED') {
          // Organization approved! Redirect to dashboard
          setTimeout(() => {
            navigate(redirectAfterAuth || '/company-dashboard', { replace: true });
          }, 1500); // Small delay to show success message
        }
      }
    });

    // Cleanup listener on unmount
    return () => {
      off(orgStatusRef);
    };
  }, [organizationId, currentStep, navigate, redirectAfterAuth]);

  const getStepTitle = () => {
    switch (currentStep) {
      case 1: return emailVerification.status !== 'idle' && emailVerification.status !== 'verified'
        ? 'Verify Your Email'
        : 'Create Your Account';
      case 2: return `${formData?.accountType === 'candidate' ? 'Professional' : 'Company'} Information`;
      case 3: return 'Terms & Privacy';
      case 4: return organizationStatus === 'APPROVED'
        ? 'Organization Approved'
        : organizationStatus === 'REJECTED'
          ? 'Organization Review Result'
          : organizationStatus === 'SUSPENDED'
            ? 'Organization Access Suspended'
            : 'Organization Approval Pending';
      default: return 'Create Your Account';
    }
  };

  const getStepDescription = () => {
    switch (currentStep) {
      case 1: return emailVerification.status !== 'idle' && emailVerification.status !== 'verified'
        ? 'Confirm your email before continuing to professional details'
        : 'Start your AI interview journey with basic account setup';
      case 2: return formData?.accountType === 'candidate' ?'Help us personalize your interview experience' :'Tell us about your company and hiring needs';
      case 3: return 'Review and accept our terms to complete registration';
      case 4: return organizationStatus === 'APPROVED'
        ? 'Your organization has been approved. Redirecting you to the dashboard now.'
        : organizationStatus === 'REJECTED'
          ? 'Your organization registration requires updates before approval'
          : organizationStatus === 'SUSPENDED'
            ? 'Your organization has been suspended by the system administrator'
            : 'Your organization is under review by our administrators';
      default: return 'Start your AI interview journey';
    }
  };

  const getCompanyStepFourProgressTitle = () => {
    if (organizationStatus === 'REJECTED') return 'Review Decision';
    if (organizationStatus === 'SUSPENDED') return 'Organization Access Status';
    if (organizationStatus === 'APPROVED') return 'Access Granted';
    return 'Organization Approval';
  };

  const isStep2ModerationBlocking = currentStep === 2 && (
    formData?.accountType === 'candidate'
      ? (uploadModeration?.profilePhoto?.status !== 'approved' || uploadModeration?.resumeFile?.status !== 'approved')
      : (
        uploadModeration?.companyLogo?.status !== 'approved'
        || uploadModeration?.companyProof?.status !== 'approved'
      )
  );
  const isStep1Busy = currentStep === 1 && (
    isCheckingEmail || isSendingVerification || isVerifyingCode
  );
  const step1ActionLabel = emailVerification.status === 'verified'
    ? 'Next'
    : emailVerification.status === 'sent'
      ? 'I\'ve verified'
      : emailVerification.status === 'error'
        ? 'Resend verification'
        : 'Send verification';
  const nextButtonLabel = currentStep === 1 ? step1ActionLabel : 'Next';
  const nextButtonIcon = currentStep === 1
    ? (emailVerification.status === 'verified'
      ? 'ChevronRight'
      : emailVerification.status === 'sent'
        ? 'CheckCircle'
        : 'Mail')
    : 'ChevronRight';
  const showEmailVerificationCard = currentStep === 1 && emailVerification.status !== 'idle';
  const emailVerificationTone = emailVerification.status === 'verified'
    ? 'border-emerald-200/70 bg-emerald-50/70 dark:border-emerald-500/50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
    : emailVerification.status === 'error'
      ? 'border-rose-200/70 bg-rose-50/70 dark:border-rose-500/50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-300'
      : 'border-sky-200/70 bg-sky-50/70 dark:border-sky-500/50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300';
  const emailVerificationIcon = emailVerification.status === 'verified'
    ? 'CheckCircle'
    : emailVerification.status === 'error'
      ? 'AlertCircle'
      : 'Mail';
  const emailVerificationTitle = emailVerification.status === 'verified'
    ? 'Email verified'
    : 'Verify your email';
  const emailVerificationMessage = emailVerification.message || (
    emailVerification.status === 'sending'
      ? `Sending a verification code to ${formData?.email || 'your email'}...`
      : `We sent an 8-digit verification code to ${emailVerification.email || formData?.email || 'your email'}. Use it to continue.`
  );
  const resendLabel = resendSeconds > 0 ? `Resend in ${resendSeconds}s` : 'Resend email';
  const resendDisabled = isSendingVerification || isVerifyingCode || resendSeconds > 0;
  const verifyCodeDisabled =
    isVerifyingCode
    || isSendingVerification
    || (verificationCode || '').replace(/\D/g, '').length !== 8;
  const handleSignInClick = async () => {
    if (currentStep === 4) {
      try {
        await authHelpers.signOut();
      } catch (error) {
        console.error('Failed to sign out before navigating to sign in:', error);
      } finally {
        localStorage.removeItem('user');
        localStorage.removeItem('isAuthenticated');
      }
    }

    navigate(loginHref);
  };

  const isCompanyStepFour = formData?.accountType === 'company' && currentStep === 4;
  const showOrganizationStatusSidebar = isCompanyStepFour && organizationStatus && organizationStatus !== 'PENDING';

  const handleApplyResumeSuggestion = (suggestion) => {
    if (!suggestion?.field) return;
    setFormData((prev) => ({ ...prev, [suggestion.field]: suggestion.value }));
    setErrors((prev) => {
      if (!prev || Object.keys(prev).length === 0) return prev;
      const next = { ...prev };
      delete next[suggestion.field];
      return next;
    });
    setResumePrefillState((prev) => ({
      ...prev,
      suggestions: (prev?.suggestions || []).filter((item) => item.field !== suggestion.field),
    }));
  };

  const handleDismissResumeSuggestion = (suggestion) => {
    if (!suggestion?.field) return;
    setResumePrefillState((prev) => ({
      ...prev,
      suggestions: (prev?.suggestions || []).filter((item) => (
        !(item.field === suggestion.field && item.displayValue === suggestion.displayValue)
      )),
    }));
  };
  const organizationSidebarStatusConfig = organizationStatus === 'REJECTED'
    ? {
      title: 'Review Required',
      message: 'Your submission needs updates before approval. Check the review details and request re-review.',
      icon: 'AlertTriangle',
      iconTone: 'text-rose-600 dark:text-rose-400',
      containerTone: 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20',
      textTone: 'text-rose-700 dark:text-rose-300',
    }
    : organizationStatus === 'SUSPENDED'
      ? {
        title: 'Access Suspended',
        message: 'Organization access is paused by system administration until the issue is resolved.',
        icon: 'AlertOctagon',
        iconTone: 'text-orange-600 dark:text-orange-400',
        containerTone: 'border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20',
        textTone: 'text-orange-700 dark:text-orange-300',
      }
      : {
        title: 'Organization Approved',
        message: 'Approval is complete. You will be redirected to the company dashboard shortly.',
        icon: 'CheckCircle',
        iconTone: 'text-emerald-600 dark:text-emerald-400',
        containerTone: 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20',
        textTone: 'text-emerald-700 dark:text-emerald-300',
      };

  return (
    <>
      <Helmet>
        <title>Register - InterviewAI Pro</title>
        <meta
          name="description"
          content="Create your InterviewAI Pro account and start practicing interviews with AI-powered feedback and analytics."
        />
      </Helmet>
      <div className={`relative min-h-screen ${isCompanyStepFour ? '' : 'lg:h-screen'} bg-gradient-to-b from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 ${isCompanyStepFour ? 'overflow-visible' : 'overflow-hidden'} transition-colors duration-300`}>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div className="absolute -top-32 right-0 h-[420px] w-[420px] bg-gradient-to-br from-blue-500/35 via-purple-500/20 to-transparent blur-[150px]" />
          <div className="absolute bottom-0 -left-24 h-[520px] w-[520px] bg-gradient-to-tr from-indigo-300/25 via-cyan-200/20 to-transparent blur-[140px]" />
          <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.12),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(147,51,234,0.12),transparent_40%)]" />
        </div>
        <div className={`relative z-10 flex min-h-screen ${isCompanyStepFour ? '' : 'lg:h-screen'} flex-col`}>
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
                    onClick={handleSignInClick}
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
                  {showOrganizationStatusSidebar ? (
                    <>
                      <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">Organization Status</h3>
                      <div className={`rounded-2xl border p-4 ${organizationSidebarStatusConfig.containerTone}`}>
                        <div className="flex items-start space-x-3">
                          <Icon name={organizationSidebarStatusConfig.icon} size={18} className={`mt-0.5 flex-shrink-0 ${organizationSidebarStatusConfig.iconTone}`} />
                          <div className={`space-y-1 text-sm ${organizationSidebarStatusConfig.textTone}`}>
                            <p className="font-semibold">{organizationSidebarStatusConfig.title}</p>
                            <p className="text-xs leading-relaxed">{organizationSidebarStatusConfig.message}</p>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">Registration Progress</h3>
                      <div className="space-y-3 flex-1">
                        {(formData?.accountType === 'company'
                          ? [
                              { step: 1, title: 'Account Type & Basic Info', icon: 'User' },
                              { step: 2, title: 'Company Information', icon: 'Building' },
                              { step: 3, title: 'Terms & Completion', icon: 'CheckCircle' },
                              { step: 4, title: getCompanyStepFourProgressTitle(), icon: 'Shield' },
                            ]
                          : [
                              { step: 1, title: 'Account Type & Basic Info', icon: 'User' },
                              { step: 2, title: 'Professional Details', icon: 'Briefcase' },
                              { step: 3, title: 'Terms & Completion', icon: 'CheckCircle' },
                            ]
                        )?.map((item) => (
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
                    </>
                  )}
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
                          {showEmailVerificationCard && (
                            <div className={`rounded-2xl border p-4 ${emailVerificationTone}`}>
                              <div className="flex items-start gap-3">
                                <div className="w-9 h-9 rounded-xl bg-white/80 dark:bg-slate-900/70 flex items-center justify-center shadow-inner">
                                  <Icon name={emailVerificationIcon} size={16} className="text-current" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold">{emailVerificationTitle}</p>
                                  <p className="text-xs mt-1 text-current/80">
                                    {emailVerificationMessage}
                                  </p>
                                </div>
                              </div>
                              {emailVerification.status !== 'verified' && (
                                <div className="mt-3 space-y-3">
                                  <Input
                                    label="Verification code"
                                    type="text"
                                    placeholder="Enter the 8-digit code"
                                    value={verificationCode}
                                    onChange={(e) => {
                                      const nextValue = (e?.target?.value || '').replace(/\D/g, '').slice(0, 8);
                                      setVerificationCode(nextValue);
                                      if (verificationCodeError) {
                                        setVerificationCodeError('');
                                      }
                                    }}
                                    inputMode="numeric"
                                    maxLength={8}
                                    autoComplete="one-time-code"
                                    error={verificationCodeError}
                                  />
                                  <div className="flex flex-wrap gap-2">
                                    <Button
                                      type="button"
                                      variant="default"
                                      size="sm"
                                      iconName="CheckCircle"
                                      className="rounded-full bg-white/90 text-slate-900 hover:bg-white"
                                      onClick={handleVerifyCode}
                                      loading={isVerifyingCode}
                                      disabled={verifyCodeDisabled}
                                    >
                                      Verify code
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      iconName="Mail"
                                      className="rounded-full"
                                      onClick={sendVerificationEmail}
                                      loading={isSendingVerification}
                                      disabled={resendDisabled}
                                    >
                                      {resendLabel}
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
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
                              onModerateUpload={handleCandidateModerateUpload}
                              onResetModeration={resetUploadModeration}
                              resumePrefillState={resumePrefillState}
                              onApplyResumeSuggestion={handleApplyResumeSuggestion}
                              onDismissResumeSuggestion={handleDismissResumeSuggestion}
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

                      {currentStep === 4 && (
                        <div className="px-1 pr-3 space-y-6">
                          <div className="flex flex-col items-center justify-center py-8 space-y-6">
                            {/* Status Icon */}
                            <div className={`w-20 h-20 rounded-full flex items-center justify-center ${
                              organizationStatus === 'APPROVED' 
                                ? 'bg-green-100 dark:bg-green-900/30' 
                                : organizationStatus === 'REJECTED'
                                ? 'bg-rose-100 dark:bg-rose-900/30'
                                : organizationStatus === 'SUSPENDED'
                                ? 'bg-orange-100 dark:bg-orange-900/30'
                                : 'bg-amber-100 dark:bg-amber-900/30'
                            }`}>
                              <Icon 
                                name={
                                  organizationStatus === 'APPROVED' 
                                    ? 'CheckCircle' 
                                    : organizationStatus === 'REJECTED'
                                    ? 'XCircle'
                                    : organizationStatus === 'SUSPENDED'
                                    ? 'AlertOctagon'
                                    : 'Clock'
                                } 
                                size={40} 
                                className={
                                  organizationStatus === 'APPROVED' 
                                    ? 'text-green-600 dark:text-green-400' 
                                    : organizationStatus === 'REJECTED'
                                    ? 'text-rose-600 dark:text-rose-400'
                                    : organizationStatus === 'SUSPENDED'
                                    ? 'text-orange-600 dark:text-orange-400'
                                    : 'text-amber-600 dark:text-amber-400'
                                }
                              />
                            </div>

                            {/* Status Message */}
                            <div className="text-center space-y-2">
                              <h3 className="text-xl font-semibold text-gray-900 dark:text-slate-100">
                                {organizationStatus === 'APPROVED' 
                                  ? 'Organization Approved!' 
                                  : organizationStatus === 'REJECTED'
                                  ? 'Organization Not Approved'
                                  : organizationStatus === 'SUSPENDED'
                                  ? 'Organization Access Suspended'
                                  : 'Waiting for Admin Approval'}
                              </h3>
                              <p className="text-sm text-gray-600 dark:text-slate-400 max-w-md">
                                {organizationStatus === 'APPROVED' 
                                  ? 'Your organization has been approved. Redirecting to your dashboard...' 
                                  : organizationStatus === 'REJECTED'
                                  ? 'Your organization could not be approved at this time. Review the reason below and submit a re-review request after making corrections.'
                                  : organizationStatus === 'SUSPENDED'
                                  ? 'Your organization has been suspended by an administrator. Access to company tools is currently disabled until this is resolved.'
                                  : 'Your organization is currently under review by our administrators. You will be redirected automatically once approved. Please keep this page open.'}
                              </p>
                            </div>

                            {organizationStatus === 'REJECTED' && organizationRejectionReason && (
                              <div className="w-full p-4 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20">
                                <div className="flex items-start space-x-3">
                                  <Icon name="AlertTriangle" size={18} className="text-rose-600 dark:text-rose-400 mt-0.5 flex-shrink-0" />
                                  <div className="space-y-1 text-sm text-rose-700 dark:text-rose-300">
                                    <p className="font-medium">Rejection reason</p>
                                    <p className="text-xs leading-relaxed break-words">{organizationRejectionReason}</p>
                                  </div>
                                </div>
                              </div>
                            )}

                            {organizationStatus === 'SUSPENDED' && (
                              <div className="w-full p-4 rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 space-y-3">
                                <div className="flex items-start space-x-3">
                                  <Icon name="AlertOctagon" size={18} className="text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                                  <div className="space-y-1 text-sm text-orange-700 dark:text-orange-300">
                                    <p className="font-medium">Suspension reason</p>
                                    <p className="text-xs leading-relaxed break-words">
                                      {organizationSuspensionReason || 'No specific reason was provided. Please contact support for details.'}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    type="button"
                                    variant="default"
                                    size="sm"
                                    iconName="MessageCircle"
                                    iconPosition="left"
                                    className="rounded-full bg-orange-600 hover:bg-orange-700 text-white"
                                    onClick={() => navigate('/contact')}
                                  >
                                    Contact Support
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    iconName="Mail"
                                    iconPosition="left"
                                    className="rounded-full border-orange-300 text-orange-700 hover:bg-orange-100 dark:border-orange-700 dark:text-orange-300 dark:hover:bg-orange-900/30"
                                    disabled={!supportContactEmail}
                                    onClick={() => {
                                      if (typeof window !== 'undefined' && supportContactEmail) {
                                        window.location.href = `mailto:${supportContactEmail}`;
                                      }
                                    }}
                                  >
                                    Email Support
                                  </Button>
                                </div>
                              </div>
                            )}

                            {/* Loading Indicator for Pending */}
                            {organizationStatus === 'PENDING' && (
                              <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                              </div>
                            )}

                            {/* Information Box */}
                            <div className={`w-full p-4 rounded-xl border ${
                              organizationStatus === 'REJECTED'
                                ? 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20'
                                : organizationStatus === 'SUSPENDED'
                                ? 'border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20'
                                : 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20'
                            }`}>
                              <div className="flex items-start space-x-3">
                                <Icon
                                  name="Info"
                                  size={18}
                                  className={`mt-0.5 flex-shrink-0 ${
                                    organizationStatus === 'REJECTED'
                                      ? 'text-rose-600 dark:text-rose-400'
                                      : organizationStatus === 'SUSPENDED'
                                      ? 'text-orange-600 dark:text-orange-400'
                                      : 'text-blue-600 dark:text-blue-400'
                                  }`}
                                />
                                <div className={`space-y-1 text-sm ${
                                  organizationStatus === 'REJECTED'
                                    ? 'text-rose-700 dark:text-rose-300'
                                    : organizationStatus === 'SUSPENDED'
                                    ? 'text-orange-700 dark:text-orange-300'
                                    : 'text-gray-700 dark:text-slate-300'
                                }`}>
                                  <p className="font-medium">What happens next?</p>
                                  {organizationStatus === 'REJECTED' ? (
                                    <ul className="space-y-1 text-xs text-rose-600 dark:text-rose-300/90">
                                      <li>- Review and correct the submitted company details.</li>
                                      <li>- Check your email for the same rejection explanation.</li>
                                      <li>- Submit a re-review request below after corrections.</li>
                                    </ul>
                                  ) : organizationStatus === 'SUSPENDED' ? (
                                    <ul className="space-y-1 text-xs text-orange-700 dark:text-orange-300/90">
                                      <li>- Organization access is paused by system administration.</li>
                                      <li>- Company dashboard features are temporarily unavailable.</li>
                                      <li>- Contact support or your system admin for reactivation.</li>
                                    </ul>
                                  ) : (
                                    <ul className="space-y-1 text-xs text-gray-600 dark:text-slate-400">
                                      <li>- Our team will review your organization details.</li>
                                      <li>- This typically takes a few minutes.</li>
                                      <li>- You will be redirected automatically once approved.</li>
                                      <li>- No action required from you at this time.</li>
                                    </ul>
                                  )}
                                </div>
                              </div>
                            </div>

                            {organizationStatus === 'REJECTED' && (
                              <div className="w-full p-4 rounded-xl border border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-900/50 space-y-3">
                                <div className="flex items-center gap-2">
                                  <Icon name="RotateCcw" size={16} className="text-rose-600 dark:text-rose-400" />
                                  <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                                    Request re-review
                                  </p>
                                </div>
                                <p className="text-xs text-gray-600 dark:text-slate-400">
                                  Explain what you updated so admins can reassess your organization quickly.
                                </p>
                                <div className="rounded-xl border border-rose-200/80 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-900/10 p-3 space-y-3">
                                  <div className="flex items-center gap-2">
                                    <Icon name="UploadCloud" size={14} className="text-rose-600 dark:text-rose-400" />
                                    <p className="text-xs font-semibold text-rose-700 dark:text-rose-300">
                                      Update supporting evidence (optional)
                                    </p>
                                  </div>
                                  <p className="text-xs text-rose-600 dark:text-rose-300/90">
                                    Upload corrected files first, then submit your re-review note.
                                  </p>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    <div className="rounded-lg border border-rose-200/70 dark:border-rose-900/40 bg-white/80 dark:bg-slate-900/55 p-2.5 space-y-2">
                                      <p className="text-xs font-medium text-gray-900 dark:text-slate-100">Business verification document</p>
                                      <p className="text-[11px] text-gray-500 dark:text-slate-400">PDF, DOC, DOCX &middot; Max 15 MB</p>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        iconName="Upload"
                                        iconPosition="left"
                                        className="w-full rounded-lg"
                                        onClick={() => triggerReReviewFilePicker('companyProof')}
                                        loading={isUploadingReReviewProof}
                                        disabled={isRequestingReReview || isUploadingReReviewLogo}
                                      >
                                        Upload document
                                      </Button>
                                      <input
                                        ref={reReviewProofInputRef}
                                        type="file"
                                        accept=".pdf,.doc,.docx"
                                        onChange={(event) => handleReReviewEvidenceUpload('companyProof', event)}
                                        className="hidden"
                                      />
                                    </div>
                                    <div className="rounded-lg border border-rose-200/70 dark:border-rose-900/40 bg-white/80 dark:bg-slate-900/55 p-2.5 space-y-2">
                                      <p className="text-xs font-medium text-gray-900 dark:text-slate-100">Company logo</p>
                                      <p className="text-[11px] text-gray-500 dark:text-slate-400">JPG, PNG, WEBP, SVG &middot; Max 5 MB</p>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        iconName="Upload"
                                        iconPosition="left"
                                        className="w-full rounded-lg"
                                        onClick={() => triggerReReviewFilePicker('companyLogo')}
                                        loading={isUploadingReReviewLogo}
                                        disabled={isRequestingReReview || isUploadingReReviewProof}
                                      >
                                        Upload logo
                                      </Button>
                                      <input
                                        ref={reReviewLogoInputRef}
                                        type="file"
                                        accept="image/*,.svg"
                                        onChange={(event) => handleReReviewEvidenceUpload('companyLogo', event)}
                                        className="hidden"
                                      />
                                    </div>
                                  </div>
                                  {errors?.reReviewEvidence && (
                                    <p className="text-xs text-rose-600 dark:text-rose-400">{errors.reReviewEvidence}</p>
                                  )}
                                </div>
                                <textarea
                                  value={reReviewNote}
                                  onChange={(event) => {
                                    setReReviewNote(event.target.value);
                                    if (errors?.reReviewNote) {
                                      setErrors((prev) => ({ ...prev, reReviewNote: '' }));
                                    }
                                  }}
                                  rows={4}
                                  maxLength={2000}
                                  placeholder="Describe the corrections or additional evidence you added..."
                                  disabled={isRequestingReReview}
                                  className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent disabled:opacity-60"
                                />
                                <div className="flex justify-end">
                                  <p className="text-xs text-gray-500 dark:text-slate-500 text-right">
                                    {reReviewNote.trim().length}/{MIN_REREVIEW_NOTE_LENGTH} minimum
                                  </p>
                                </div>
                                <div className="flex justify-end">
                                  <Button
                                    type="button"
                                    variant="default"
                                    iconName="Send"
                                    iconPosition="left"
                                    className="h-9 rounded-full bg-rose-600 hover:bg-rose-700 text-white px-5"
                                    onClick={handleRequestReReview}
                                    loading={isRequestingReReview}
                                    disabled={
                                      !organizationId
                                      || isRequestingReReview
                                      || isUploadingReReviewProof
                                      || isUploadingReReviewLogo
                                      || reReviewNote.trim().length < MIN_REREVIEW_NOTE_LENGTH
                                    }
                                  >
                                    Request Re-review
                                  </Button>
                                </div>
                                {errors?.reReviewNote && (
                                  <p className="text-xs text-rose-600 dark:text-rose-400">{errors.reReviewNote}</p>
                                )}
                              </div>
                            )}

                            {organizationStatus === 'PENDING' && reReviewRequestedAt && (
                              <p className="text-xs text-blue-600 dark:text-blue-300">
                                Re-review request submitted on {formatDateTime(reReviewRequestedAt)}.
                              </p>
                            )}
                          </div>
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
                        {currentStep !== 4 && (
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
                        )}
                        {currentStep !== 4 && (
                          <div className="flex items-center space-x-2">
                            {(formData?.accountType === 'company' ? [1, 2, 3, 4] : [1, 2, 3])?.map((step) => (
                              <div
                                key={step}
                                className={`w-2 h-2 rounded-full transition-colors duration-200 ${
                                  step <= currentStep ? 'bg-blue-600' : 'bg-gray-200 dark:bg-slate-700'
                                }`}
                              />
                            ))}
                          </div>
                        )}
                        {currentStep < 3 ? (
                          <Button
                            type="button"
                            variant="default"
                            onClick={handleNextStep}
                            iconName={nextButtonIcon}
                            iconPosition="right"
                            className="h-10 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6"
                            loading={currentStep === 1 ? isStep1Busy : false}
                            disabled={(currentStep === 1 && isStep1Busy) || (currentStep === 2 && isStep2ModerationBlocking)}
                          >
                            {nextButtonLabel}
                          </Button>
                        ) : currentStep === 3 ? (
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
                        ) : null}
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
                  &copy; {new Date()?.getFullYear()} InterviewAI Pro
                  <span aria-hidden="true" className="mx-1.5 inline-block text-sm md:text-base leading-none font-medium text-gray-400 dark:text-slate-500">&middot;</span>
                  <a href="/privacy" className="text-blue-600 hover:underline mx-1">Privacy</a>
                  <span aria-hidden="true" className="mx-1.5 inline-block text-sm md:text-base leading-none font-medium text-gray-400 dark:text-slate-500">&middot;</span>
                  <a href="/terms" className="text-blue-600 hover:underline mx-1">Terms</a>
                  <span aria-hidden="true" className="mx-1.5 inline-block text-sm md:text-base leading-none font-medium text-gray-400 dark:text-slate-500">&middot;</span>
                  <a href="/help-center" className="text-blue-600 hover:underline mx-1">Help Center</a>
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
