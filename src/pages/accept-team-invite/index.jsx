import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import BrandMark from '../../components/BrandMark';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import Icon from '../../components/AppIcon';
import PhoneInput from '../../components/ui/PhoneInput';
import PasswordStrengthIndicator from '../register/components/PasswordStrengthIndicator';
import PasswordMatchIndicator from '../register/components/PasswordMatchIndicator';
import apiClient from '../../services/apiClient';
import { authHelpers } from '../../config/firebase';
import { getRoleBadgeColor, getRoleDisplayName, getRoleDescription } from '../../utils/rolePermissions';
import { passwordMeetsAllRequirements, PASSWORD_REQUIREMENT_MESSAGE } from '../../utils/passwordValidation';

const departments = [
  { value: 'hr', label: 'Human Resources' },
  { value: 'engineering', label: 'Engineering & Development' },
  { value: 'sales', label: 'Sales & Marketing' },
  { value: 'operations', label: 'Operations' },
  { value: 'finance', label: 'Finance & Accounting' },
  { value: 'executive', label: 'Executive Leadership' },
  { value: 'other', label: 'Other' },
];

const roleMetaMap = {
  ADMIN: {
    icon: 'Shield',
    tone: 'border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20',
    gradient: 'from-purple-600 to-pink-600',
    jobTitlePlaceholder: 'e.g., Head of Talent, Hiring Manager',
    highlights: ['Full organization access', 'Team and permission management', 'Jobs, interviews, and analytics'],
  },
  RECRUITER: {
    icon: 'Briefcase',
    tone: 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20',
    gradient: 'from-blue-600 to-purple-600',
    jobTitlePlaceholder: 'e.g., Talent Recruiter, HR Manager',
    highlights: ['Manage hiring workflows', 'Coordinate candidates and interviews', 'Collaborate with reviewers'],
  },
  REVIEWER: {
    icon: 'Eye',
    tone: 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20',
    gradient: 'from-emerald-500 to-teal-500',
    jobTitlePlaceholder: 'e.g., Interview Reviewer, Hiring Panelist',
    highlights: ['Review interview submissions', 'Leave structured feedback', 'Read-only team visibility'],
  },
};

const normalizeValue = (value) => (value ?? '').toString().trim().toLowerCase();
const normalizeEmail = (value) => (value || '').trim().toLowerCase();
const otherDepartmentValue = 'other';

const sectionReveal = {
  hidden: { opacity: 0, y: 48 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: 'easeOut' },
  },
};

const fadeUpChild = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: 'easeOut' },
  },
};

const AcceptTeamInvitePage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState(null);
  const [pageError, setPageError] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [profilePhotoUpload, setProfilePhotoUpload] = useState({ status: 'idle', error: '' });
  const [profilePhotoPreview, setProfilePhotoPreview] = useState('');
  const profilePhotoInputRef = useRef(null);

  const invitationRole = useMemo(() => (invitation?.role || '').toString().trim().toUpperCase(), [invitation?.role]);
  const roleMeta = roleMetaMap[invitationRole] || roleMetaMap.RECRUITER;
  const roleDisplayName = getRoleDisplayName(invitationRole || 'RECRUITER');
  const roleDescription = getRoleDescription(invitationRole) || 'Join your hiring team with company-managed access.';
  const roleBadgeClasses = getRoleBadgeColor(invitationRole);
  const organizationName = invitation?.organization?.name || 'your organization';
  const hasCustomDepartment = Boolean(
    department && !departments.some((option) => normalizeValue(option.value) === normalizeValue(department)),
  );
  const selectedDepartmentValue = hasCustomDepartment ? otherDepartmentValue : department;
  const customDepartmentValue = hasCustomDepartment ? department : '';
  const normalizedDepartment = selectedDepartmentValue === otherDepartmentValue
    ? customDepartmentValue.trim()
    : department;
  const profileComplete = Boolean(
    fullName.trim()
      && jobTitle.trim()
      && (selectedDepartmentValue !== otherDepartmentValue || customDepartmentValue.trim())
      && profilePhoto
      && profilePhotoUpload.status === 'approved',
  );
  const securityComplete = Boolean(
    confirmPassword
      && password === confirmPassword
      && passwordMeetsAllRequirements(password),
  );
  const registrationProgress = useMemo(() => ([
    {
      step: 1,
      title: 'Invitation & role',
      description: loading ? 'Checking your invite.' : 'Your team invite is ready.',
      icon: 'MailCheck',
      done: !loading && Boolean(invitation) && !pageError,
      current: loading,
    },
    {
      step: 2,
      title: 'Profile details',
      description: 'Add the basics your team will see.',
      icon: 'UserRound',
      done: profileComplete,
      current: !loading && !pageError && Boolean(invitation) && !profileComplete,
    },
    {
      step: 3,
      title: 'Secure account',
      description: 'Create a password and activate access.',
      icon: 'ShieldCheck',
      done: securityComplete,
      current: !loading && !pageError && Boolean(invitation) && profileComplete && !securityComplete,
    },
  ]), [invitation, loading, pageError, profileComplete, securityComplete]);

  useEffect(() => {
    const fetchInvitation = async () => {
      setLoading(true);
      setPageError('');
      try {
        const result = await apiClient.teamInvitations.getByToken(token);
        if (result.success && result.invitation) {
          setInvitation(result.invitation);
        } else {
          setInvitation(null);
          setPageError(result.error || 'Invitation is invalid or has expired.');
        }
      } catch (err) {
        setInvitation(null);
        setPageError(err?.message || 'Failed to load invitation.');
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchInvitation();
    else {
      setPageError('Invitation token is missing.');
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!profilePhoto) {
      setProfilePhotoPreview('');
      return undefined;
    }

    const objectUrl = URL.createObjectURL(profilePhoto);
    setProfilePhotoPreview(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [profilePhoto]);

  const clearInlineErrors = () => {
    if (formError) setFormError('');
    if (passwordError) setPasswordError('');
    if (confirmPasswordError) setConfirmPasswordError('');
  };

  const handleSignInClick = () => {
    navigate('/login', invitation?.email ? { state: { email: invitation.email } } : {});
  };

  const resetProfilePhoto = () => {
    if (profilePhotoInputRef.current) {
      profilePhotoInputRef.current.value = '';
    }
    setProfilePhoto(null);
    setProfilePhotoUpload({ status: 'idle', error: '' });
  };

  const handleProfilePhotoChange = async (event) => {
    const file = event?.target?.files?.[0];
    if (!file) return;

    clearInlineErrors();
    setProfilePhoto(file);
    setProfilePhotoUpload({ status: 'checking', error: '' });

    try {
      await apiClient.uploads.moderateProfilePhoto(file);
      setProfilePhotoUpload({ status: 'approved', error: '' });
    } catch (error) {
      setProfilePhoto(null);
      setProfilePhotoUpload({
        status: 'error',
        error: error?.message || 'Profile photo failed moderation. Please choose a different image.',
      });
    } finally {
      if (event?.target) {
        event.target.value = '';
      }
    }
  };

  const ensureFirebaseSessionForRegistration = async () => {
    const targetEmail = normalizeEmail(invitation?.email);
    if (!targetEmail) throw new Error('Invitation email is missing. Please reload the page or request a new invitation.');
    const { data: sessionSnapshot } = await authHelpers.getSession();
    const existingSession = sessionSnapshot?.session;
    const existingEmail = normalizeEmail(existingSession?.user?.email);
    if (existingSession?.access_token && existingEmail === targetEmail) return existingSession.user;
    if (existingSession?.access_token && existingEmail && existingEmail !== targetEmail) await authHelpers.signOut();
    const { data: authData, error: authError } = await authHelpers.signUp(invitation.email, password, {
      fullName: fullName.trim(),
      accountType: 'COMPANY',
    });
    if (authError) {
      if (authError?.code === 'auth/email-already-in-use') {
        const { data: signInData, error: signInError } = await authHelpers.signIn(invitation.email, password);
        if (signInError || !signInData?.user) {
          throw new Error(signInError?.message || 'An account with this email already exists. Please sign in instead.');
        }
        return signInData.user;
      }
      throw new Error(authError.message || 'Failed to create account for email verification.');
    }
    if (!authData?.user) throw new Error('Failed to create your account for email verification.');
    return authData.user;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!invitation) return;
    setFormError('');
    setPasswordError('');
    setConfirmPasswordError('');
    if (!fullName.trim() || !jobTitle.trim() || !password || !confirmPassword) {
      setFormError('Please fill in all required fields.');
      return;
    }
    if (!profilePhoto) {
      setFormError('Please upload a profile photo before creating your account.');
      return;
    }
    if (profilePhotoUpload.status !== 'approved') {
      setFormError(profilePhotoUpload.error || 'Profile photo must pass moderation before continuing.');
      return;
    }
    if (selectedDepartmentValue === otherDepartmentValue && !customDepartmentValue.trim()) {
      setFormError('Please specify your department when selecting "Other".');
      return;
    }
    if (!passwordMeetsAllRequirements(password)) {
      setPasswordError(PASSWORD_REQUIREMENT_MESSAGE);
      return;
    }
    if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match');
      return;
    }
    setSubmitting(true);
    try {
      await ensureFirebaseSessionForRegistration();
      await authHelpers.refreshAccessToken();
      const registerPayload = new FormData();
      registerPayload.append('fullName', fullName.trim());
      registerPayload.append('email', invitation.email);
      registerPayload.append('accountType', 'COMPANY');
      registerPayload.append('teamInvitationToken', token);
      registerPayload.append('jobTitle', jobTitle.trim());
      registerPayload.append('profilePhoto', profilePhoto);
      if (normalizedDepartment) {
        registerPayload.append('department', normalizedDepartment);
      }
      if (phoneNumber.trim()) {
        registerPayload.append('phoneNumber', phoneNumber.trim());
      }

      const registerData = await apiClient.auth.register(registerPayload);
      if (!registerData.success || !registerData.user) throw new Error(registerData.error || 'Registration failed.');
      try { await authHelpers.signOut(); } catch (signOutError) { console.error('Failed to sign out after registration:', signOutError); }
      navigate('/login', { state: { email: invitation.email } });
    } catch (err) {
      setFormError(err?.message || 'Failed to complete registration.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>{invitation ? `Join ${organizationName} - InterviewAI Pro` : 'Accept Team Invitation - InterviewAI Pro'}</title>
        <meta
          name="description"
          content="Accept your InterviewAI Pro team invitation and finish account setup with the same guided onboarding used across the platform."
        />
      </Helmet>
      <div className="relative min-h-screen lg:h-screen lg:overflow-hidden bg-gradient-to-b from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 transition-colors duration-300">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 right-0 h-[420px] w-[420px] bg-gradient-to-br from-blue-500/35 via-purple-500/20 to-transparent blur-[150px]" />
        <div className="absolute bottom-0 -left-24 h-[520px] w-[520px] bg-gradient-to-tr from-indigo-300/25 via-cyan-200/20 to-transparent blur-[140px]" />
        <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.12),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(147,51,234,0.12),transparent_40%)]" />
      </div>

      <div className="relative z-10 flex min-h-screen lg:h-screen flex-col">
        <header className="flex-shrink-0">
          <div className="max-w-6xl mx-auto w-full px-3 sm:px-4 lg:px-6 py-4 lg:py-3">
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

        <main className="flex-1 min-h-0 w-full px-3 sm:px-4 lg:px-6 pb-3 lg:pb-2 overflow-hidden">
          <motion.div
            variants={sectionReveal}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-3 max-w-6xl mx-auto lg:h-full"
          >
            <motion.aside variants={fadeUpChild} className="lg:col-span-4 flex flex-col min-h-0">
              <div className="rounded-3xl border border-white/30 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-5 lg:p-4 h-full flex flex-col shadow-[0_20px_70px_rgba(15,23,42,0.12)] dark:shadow-[0_20px_70px_rgba(0,0,0,0.4)] backdrop-blur overflow-y-auto">
                <h2 className="text-base md:text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4 lg:mb-3">Registration Progress</h2>
                <div className="space-y-3">
                  {registrationProgress.map((item) => (
                    <div
                      key={item.step}
                      className={`rounded-2xl border p-3 transition-colors duration-200 ${
                        item.current
                          ? 'border-blue-500/40 dark:border-blue-500/60 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 shadow-[0_10px_30px_rgba(59,130,246,0.2)]'
                          : item.done
                            ? 'border-emerald-400/40 dark:border-emerald-500/60 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                            : 'border-white/30 dark:border-slate-700/50 bg-white/70 dark:bg-slate-800/70 text-gray-500 dark:text-slate-400'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 dark:bg-slate-700/80 shadow-inner">
                          <Icon
                            name={item.done ? 'Check' : item.current ? 'Loader2' : item.icon}
                            size={16}
                            className={item.current && !item.done ? 'animate-spin' : 'text-current'}
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm md:text-base font-semibold">Step {item.step}</p>
                          <p className="text-xs md:text-sm text-gray-500 dark:text-slate-400">{item.title}</p>
                          <p className="mt-1 text-[11px] md:text-xs text-gray-500/90 dark:text-slate-400/90">{item.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className={`mt-4 lg:mt-3 rounded-2xl border p-4 lg:p-3.5 ${roleMeta.tone}`}>
                  <div className="flex items-start gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br ${roleMeta.gradient} text-white shadow-lg`}>
                      <Icon name={roleMeta.icon} size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs uppercase tracking-[0.24em] text-gray-500 dark:text-slate-400">Team invitation</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${roleBadgeClasses}`}>{roleDisplayName}</span>
                        {invitation?.organization?.name && <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">{invitation.organization.name}</span>}
                      </div>
                      <div className="mt-3 rounded-xl border border-white/45 dark:border-slate-700/60 bg-white/65 dark:bg-slate-900/35 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 dark:text-slate-400">Reserved email</p>
                        <p className="mt-1 text-xs leading-5 font-medium text-gray-700 dark:text-slate-200 [overflow-wrap:anywhere]">
                          {invitation?.email || 'Loading...'}
                        </p>
                      </div>
                      <p className="mt-3 text-sm text-gray-700 dark:text-slate-300">{roleDescription}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 lg:mt-3 pt-3 border-t border-white/30 dark:border-slate-700/50">
                  <h4 className="text-sm md:text-base font-semibold text-gray-900 dark:text-slate-100 mb-2 lg:mb-1.5">What you'll unlock</h4>
                  <ul className="space-y-2 text-xs md:text-sm text-gray-500 dark:text-slate-400">
                    {roleMeta.highlights.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <Icon name="CheckCircle" size={14} className="mt-0.5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.aside>

            <motion.section variants={fadeUpChild} className="lg:col-span-8 flex flex-col min-h-0">
              <div className="rounded-3xl border border-white/30 dark:border-slate-700/50 bg-white/85 dark:bg-slate-800/85 shadow-[0_25px_80px_rgba(15,23,42,0.15)] dark:shadow-[0_25px_80px_rgba(0,0,0,0.5)] p-5 md:p-6 lg:p-5 h-full flex flex-col backdrop-blur overflow-hidden">
                <div className="text-center mb-4 lg:mb-3 flex-shrink-0">
                  <h1 className="text-xl md:text-2xl lg:text-3xl font-semibold text-gray-900 dark:text-slate-100 mb-1">
                    {invitation ? `Create your ${roleDisplayName.toLowerCase()} account` : 'Accept Team Invitation'}
                  </h1>
                  <p className="mt-1 text-sm md:text-base text-gray-500 dark:text-slate-400">
                    Finish your details to join {organizationName} with the same account-creation experience used across InterviewAI Pro.
                  </p>
                </div>

                {loading && (
                  <div className="flex-1 flex items-center justify-center rounded-2xl border border-blue-200/70 dark:border-blue-900/50 bg-blue-50/80 dark:bg-blue-900/20 p-6 text-center">
                    <div>
                      <Icon name="Loader2" size={24} className="mx-auto animate-spin text-blue-600 dark:text-blue-300" />
                      <p className="mt-3 text-sm text-gray-600 dark:text-slate-400">Loading invitation...</p>
                    </div>
                  </div>
                )}

                {!loading && pageError && (
                  <div className="flex-1 flex items-center justify-center rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20 p-6 text-center">
                    <div>
                      <Icon name="AlertCircle" size={24} className="mx-auto text-rose-600 dark:text-rose-300" />
                      <p className="mt-3 text-sm text-rose-700 dark:text-rose-200">{pageError}</p>
                      <Button type="button" variant="default" onClick={handleSignInClick} className="mt-4 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6">
                        Go to Sign In
                      </Button>
                    </div>
                  </div>
                )}

                {!loading && !pageError && invitation && (
                  <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
                    <div className="flex-1 min-h-0 overflow-y-auto px-1 lg:px-0 lg:pr-2 space-y-4 lg:space-y-3">
                      <div className={`rounded-2xl border p-4 lg:p-3.5 ${roleMeta.tone}`}>
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">You&apos;ve been invited to join {organizationName}</p>
                            <p className="mt-1 text-xs md:text-sm text-gray-600 dark:text-slate-400">
                              Invitation sent to <span className="font-mono break-all">{invitation.email}</span>
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${roleBadgeClasses}`}>{roleDisplayName}</span>
                            <span className="inline-flex items-center rounded-full border border-blue-200 dark:border-blue-800 bg-white/80 dark:bg-slate-900/50 px-3 py-1 text-xs font-medium text-blue-700 dark:text-blue-300">
                              Secure team access
                            </span>
                          </div>
                        </div>
                      </div>

                      {formError && (
                        <div className="rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/30 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
                          {formError}
                        </div>
                      )}

                      <div className="rounded-2xl border border-white/30 dark:border-slate-700/50 bg-white/70 dark:bg-slate-900/30 p-4 lg:p-3.5 space-y-3">
                        <div className={`relative overflow-hidden rounded-2xl border p-4 transition-colors ${
                          profilePhotoUpload.status === 'error'
                            ? 'border-rose-300 bg-rose-50/80 dark:border-rose-500/50 dark:bg-rose-900/20'
                            : profilePhotoUpload.status === 'approved'
                              ? 'border-emerald-300 bg-emerald-50/80 dark:border-emerald-500/50 dark:bg-emerald-900/20'
                              : 'border-white/40 dark:border-slate-700/60 bg-white/70 dark:bg-slate-900/35'
                        }`}>
                          <div aria-hidden="true" className="pointer-events-none absolute -top-12 -right-12 h-36 w-36 rounded-full bg-gradient-to-br from-blue-500/15 via-purple-500/10 to-transparent blur-2xl" />
                          <div aria-hidden="true" className="pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-gradient-to-tr from-indigo-400/10 via-cyan-300/10 to-transparent blur-2xl" />

                          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
                            <div className="flex flex-col items-center gap-3 sm:shrink-0">
                              <button
                                type="button"
                                onClick={() => profilePhotoInputRef.current?.click()}
                                aria-label={profilePhoto ? 'Change profile photo' : 'Upload profile photo'}
                                className={`group relative rounded-full p-[3px] transition-transform duration-200 hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent focus-visible:ring-blue-500/70 bg-gradient-to-br ${
                                  profilePhotoUpload.status === 'error'
                                    ? 'from-rose-500 via-rose-400 to-orange-400'
                                    : profilePhotoUpload.status === 'approved'
                                      ? 'from-emerald-500 via-teal-400 to-cyan-400'
                                      : profilePhotoUpload.status === 'checking'
                                        ? 'from-blue-500 via-purple-500 to-indigo-500 animate-pulse'
                                        : 'from-blue-500 via-purple-500 to-indigo-500'
                                }`}
                              >
                                <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-white/60 dark:border-slate-800 bg-white/95 dark:bg-slate-950/80 shadow-[0_10px_30px_rgba(15,23,42,0.18)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                                  {profilePhotoPreview ? (
                                    <img src={profilePhotoPreview} alt="Profile preview" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                                  ) : (
                                    <Icon name="UserRound" size={40} className="text-blue-600 dark:text-blue-300" />
                                  )}
                                </div>
                                <span className={`absolute -bottom-0.5 -right-0.5 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white dark:border-slate-900 text-white shadow-lg transition-transform duration-200 group-hover:scale-110 ${
                                  profilePhotoUpload.status === 'approved'
                                    ? 'bg-gradient-to-br from-emerald-500 to-teal-500'
                                    : profilePhotoUpload.status === 'error'
                                      ? 'bg-gradient-to-br from-rose-500 to-orange-500'
                                      : 'bg-gradient-to-br from-blue-600 to-purple-600'
                                }`}>
                                  <Icon
                                    name={
                                      profilePhotoUpload.status === 'approved'
                                        ? 'Check'
                                        : profilePhotoUpload.status === 'error'
                                          ? 'AlertCircle'
                                          : profilePhoto
                                            ? 'Pencil'
                                            : 'Camera'
                                    }
                                    size={14}
                                  />
                                </span>
                              </button>
                              <div className="flex items-center justify-center gap-2">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  onClick={() => profilePhotoInputRef.current?.click()}
                                  className="rounded-full border border-blue-200/70 dark:border-blue-800/60 bg-white/70 dark:bg-slate-900/40 text-xs font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-800 dark:hover:text-blue-200"
                                >
                                  <Icon name="Upload" size={12} className="mr-1.5" />
                                  {profilePhoto ? 'Change' : 'Upload'}
                                </Button>
                                {profilePhoto ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={resetProfilePhoto}
                                    className="rounded-full text-xs font-medium text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-900/30"
                                  >
                                    <Icon name="Trash2" size={12} className="mr-1.5" />
                                    Remove
                                  </Button>
                                ) : null}
                              </div>
                              <input
                                ref={profilePhotoInputRef}
                                type="file"
                                accept="image/*"
                                aria-label="Profile Photo"
                                className="hidden"
                                onChange={handleProfilePhotoChange}
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                                <p className="text-base font-semibold text-gray-900 dark:text-slate-100">Profile Photo</p>
                                <span className="inline-flex items-center gap-1 rounded-full border border-white/50 dark:border-slate-700/60 bg-white/60 dark:bg-slate-900/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                                  JPG &middot; PNG &middot; WEBP
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-full border border-white/50 dark:border-slate-700/60 bg-white/60 dark:bg-slate-900/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                                  Max 5 MB
                                </span>
                              </div>
                              <p className="mt-1.5 text-xs md:text-sm text-gray-600 dark:text-slate-400">
                                Add a recognizable photo for reviewer assignments and team collaboration.
                              </p>
                              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                                {profilePhoto ? (
                                  <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-white/50 dark:border-slate-700/60 bg-white/70 dark:bg-slate-900/40 px-2.5 py-1 text-[11px] text-gray-700 dark:text-slate-200">
                                    <Icon name="Image" size={12} className="flex-shrink-0 text-blue-500 dark:text-blue-300" />
                                    <span className="truncate max-w-[220px]">{profilePhoto.name}</span>
                                  </span>
                                ) : null}
                                {profilePhotoUpload.status === 'checking' ? (
                                  <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-1 text-[11px] font-medium text-blue-700 dark:text-blue-200">
                                    <Icon name="Loader2" size={12} className="animate-spin" />
                                    Checking photo
                                  </span>
                                ) : null}
                                {profilePhotoUpload.status === 'approved' ? (
                                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/40 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-200">
                                    <Icon name="CheckCircle" size={12} />
                                    Photo approved
                                  </span>
                                ) : null}
                                {profilePhotoUpload.status === 'error' ? (
                                  <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-rose-200 dark:border-rose-700 bg-rose-50 dark:bg-rose-900/40 px-2.5 py-1 text-[11px] font-medium text-rose-700 dark:text-rose-200">
                                    <Icon name="AlertCircle" size={12} className="flex-shrink-0" />
                                    <span className="truncate max-w-[260px]">{profilePhotoUpload.error}</span>
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <Input label="Full Name" placeholder="Enter your full name" value={fullName} onChange={(event) => { clearInlineErrors(); setFullName(event.target.value); }} required />
                          <Input label="Email Address" value={invitation.email} disabled />
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/30 dark:border-slate-700/50 bg-white/70 dark:bg-slate-900/30 p-4 lg:p-3.5 space-y-4 lg:space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <Input label="Job Title" type="text" placeholder={roleMeta.jobTitlePlaceholder} value={jobTitle} onChange={(event) => { clearInlineErrors(); setJobTitle(event.target.value); }} required />
                          <Select label="Department" placeholder="Select your department" options={departments} value={selectedDepartmentValue} onChange={(value) => { clearInlineErrors(); setDepartment(value || ''); }} />
                        </div>
                        {selectedDepartmentValue === otherDepartmentValue && (
                          <Input label="Specify Department" type="text" placeholder="Type your department" value={customDepartmentValue} onChange={(event) => { clearInlineErrors(); const nextValue = event?.target?.value || ''; setDepartment(nextValue.trim() ? nextValue : otherDepartmentValue); }} />
                        )}
                        <PhoneInput label="Phone Number" value={phoneNumber} onChange={(value) => { clearInlineErrors(); setPhoneNumber(value); }} description="Optional. Add a number if your team uses phone-based coordination." />
                      </div>

                      <div className="rounded-2xl border border-white/30 dark:border-slate-700/50 bg-white/70 dark:bg-slate-900/30 p-4 lg:p-3.5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Input label="Password" type="password" placeholder="Create a strong password" value={password} onChange={(event) => { setPassword(event.target.value); if (passwordError) setPasswordError(''); if (formError) setFormError(''); }} error={passwordError} required />
                            <PasswordStrengthIndicator password={password} />
                          </div>
                          <div className="space-y-2">
                            <Input label="Confirm Password" type="password" placeholder="Confirm your password" value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); if (confirmPasswordError) setConfirmPasswordError(''); if (formError) setFormError(''); }} error={confirmPasswordError} required />
                            <PasswordMatchIndicator password={password} confirmPassword={confirmPassword} />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 lg:pt-3 mt-4 lg:mt-3 border-t border-white/30 dark:border-slate-700/50">
                      <div className="flex flex-col gap-3 sm:grid sm:grid-cols-[auto_1fr_auto] sm:items-center sm:gap-4">
                      <Button type="button" variant="ghost" onClick={handleSignInClick} className="rounded-full border border-white/40 dark:border-slate-700/50 text-sm text-gray-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400">
                        Sign In Instead
                      </Button>
                      <div className="flex items-center justify-center gap-2">
                        {registrationProgress.map((item) => (
                          <div
                            key={item.step}
                            className={`h-2 w-2 rounded-full transition-colors duration-200 ${
                              item.done || item.current ? 'bg-blue-600' : 'bg-gray-200 dark:bg-slate-700'
                            }`}
                          />
                        ))}
                      </div>
                      <Button type="submit" variant="default" loading={submitting} className="w-full sm:w-auto rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 shadow-[0_14px_40px_rgba(59,130,246,0.28)]">
                        {submitting ? 'Creating Account...' : 'Create Account & Join Team'}
                      </Button>
                      </div>
                    </div>
                  </form>
                )}
              </div>
            </motion.section>
          </motion.div>
        </main>

        <footer className="flex-shrink-0">
          <div className="max-w-6xl mx-auto w-full px-3 sm:px-4 lg:px-6 py-2 lg:py-1.5 text-center text-xs md:text-sm text-gray-500 dark:text-slate-400">
            <p>
              &copy; {new Date().getFullYear()} InterviewAI Pro
              <span aria-hidden="true" className="mx-1.5 inline-block text-sm md:text-base leading-none font-medium text-gray-400 dark:text-slate-500">&middot;</span>
              <a href="/privacy" className="text-blue-600 hover:underline mx-1">Privacy</a>
              <span aria-hidden="true" className="mx-1.5 inline-block text-sm md:text-base leading-none font-medium text-gray-400 dark:text-slate-500">&middot;</span>
              <a href="/terms" className="text-blue-600 hover:underline mx-1">Terms</a>
              <span aria-hidden="true" className="mx-1.5 inline-block text-sm md:text-base leading-none font-medium text-gray-400 dark:text-slate-500">&middot;</span>
              <a href="/help-center" className="text-blue-600 hover:underline mx-1">Help Center</a>
            </p>
          </div>
        </footer>
      </div>
    </div>
    </>
  );
};

export default AcceptTeamInvitePage;

