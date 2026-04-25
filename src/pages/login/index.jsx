import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import Icon from '../../components/AppIcon';
import BrandMark from '../../components/BrandMark';
import LoginHeader from './components/LoginHeader';
import LoginForm from './components/LoginForm';
import SocialLogin from './components/SocialLogin';
import LoginFooter from './components/LoginFooter';
import { authHelpers } from '../../config/firebase.js';
import apiClient from '../../services/apiClient.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import {
  buildPendingApprovalRoute,
  getOrganizationRejectionReason,
  getOrganizationSuspensionReason,
  isRestrictedCompanyUser,
} from '../../utils/organizationAccess.js';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { setAuthenticatedUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const getSafeRedirectPath = (value) => {
    if (!value || typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return null;
    if (trimmed.startsWith('/login') || trimmed.startsWith('/register')) return null;
    return trimmed;
  };

  const redirectPath =
    getSafeRedirectPath(searchParams.get('redirect')) ||
    getSafeRedirectPath(location.state?.from) ||
    null;

  const registerHref = redirectPath ? `/register?redirect=${encodeURIComponent(redirectPath)}` : '/register';
  const friendlyRateLimitMessage = (message) => {
    if (!message) return '';
    const normalized = message.toLowerCase();
    if (normalized.includes('too many authentication attempts')) {
      return 'You’ve tried a few times. Please wait 15 minutes before trying again.';
    }
    return message;
  };

  const sectionReveal = {
    hidden: { opacity: 0, y: 48 },
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

  const heroHighlights = [
    {
      label: 'Sessions coached',
      value: '50K+'
    },
    {
      label: 'Avg. time to hire',
      value: '18d'
    },
    {
      label: 'NPS',
      value: '4.8/5'
    }
  ];

  // Check for stale authentication when component mounts
  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await authHelpers.getSession();
      
      if (data?.session) {
        // Check if user exists in backend
        try {
          const userData = await apiClient.auth.getMe();
          if (userData.success && userData.user) {
            // User is legitimately authenticated, redirect to dashboard
            const accountType = userData.user.accountType?.toLowerCase();
            
            // Redirect non-public account types (no user-facing reference)
            if (accountType === 'system_admin') {
              navigate('/admin-login', { replace: true });
              return;
            }

            if (isRestrictedCompanyUser(userData.user)) {
              setAuthenticatedUser(userData.user);
              navigate(buildPendingApprovalRoute(userData.user), { replace: true });
              return;
            }
            
            const dashboardRoute = accountType === 'candidate'
              ? '/candidate-dashboard'
              : '/company-dashboard';
            setAuthenticatedUser(userData.user);
            navigate(redirectPath || dashboardRoute, { replace: true });
            return;
          }
        } catch (error) {
          const message = (error?.message || '').toLowerCase();
          const isMissingBackendUser =
            message.includes('user not found') ||
            message.includes('not found') ||
            message.includes('404');

          if (isMissingBackendUser) {

            localStorage.removeItem('user');
            localStorage.removeItem('isAuthenticated');
            localStorage.removeItem('socialAuthVerified');
            localStorage.removeItem('socialAuthData');

            navigate(registerHref, { replace: true });
            return;
          }

          console.error('Auth session validation failed:', error);
          await authHelpers.signOut();

          localStorage.removeItem('user');
          localStorage.removeItem('isAuthenticated');
          localStorage.removeItem('socialAuthVerified');
          localStorage.removeItem('socialAuthData');
        }
      } else {
        // No session, make sure localStorage is also clean
        localStorage.removeItem('user');
        localStorage.removeItem('isAuthenticated');
        localStorage.removeItem('socialAuthVerified');
        localStorage.removeItem('socialAuthData');
      }
    };

    checkAuth();
  }, [navigate, redirectPath, registerHref, setAuthenticatedUser]);

  useEffect(() => {
    const oauthError = searchParams.get('oauth_error');
    if (!oauthError) return;

    const decoded = decodeURIComponent(oauthError);
    setError(friendlyRateLimitMessage(decoded));
    setStatusMessage('');
    setStatusType('');
  }, [searchParams]);

  const handleLogin = async (formData) => {
    setIsLoading(true);
    setError('');
    setStatusMessage('');
    setStatusType('');

    try {
      // Clear any previous registration intents
      localStorage.removeItem('socialAuthIntent');
      localStorage.removeItem('socialAuthProvider');
      localStorage.removeItem('pendingRegistration');
      localStorage.removeItem('pendingAccountType');
      
      // Step 1: Sign in with Firebase Auth
      const { data: authData, error: authError } = await authHelpers.signIn(
        formData.email,
        formData.password
      );

      if (authError) {
        throw new Error(authError.message || 'Invalid email or password');
      }

      if (!authData.user) {
        throw new Error('Login failed. Please try again.');
      }

      // Step 2: Get user data from backend to determine account type
      try {
        const userData = await apiClient.auth.getMe();
        
        if (userData.success && userData.user) {
          const actualAccountType = userData.user.accountType?.toLowerCase();
          
          // Block non-public account types from public login (no user-facing reference)
          if (actualAccountType === 'system_admin') {
            await authHelpers.signOut();
            throw new Error('Invalid email or password.');
          }
          
          // Validate that the selected role matches the actual account type
          const selectedRole = formData.userType?.toLowerCase() || 'candidate';
          
          // Only validate if account type exists
          if (actualAccountType) {
            // Normalize account type for comparison (handle 'company' vs 'employer' etc)
            const normalizedActualType = actualAccountType === 'company' || actualAccountType === 'employer' 
              ? 'company' 
              : 'candidate';
            const normalizedSelectedType = selectedRole === 'company' || selectedRole === 'employer' 
              ? 'company' 
              : 'candidate';
            
            if (normalizedActualType !== normalizedSelectedType) {
              // Sign out the user since they selected the wrong account type
              await authHelpers.signOut();
              const roleName = normalizedSelectedType === 'company' ? 'Employer' : 'Job Seeker';
              const actualRoleName = normalizedActualType === 'company' ? 'Employer' : 'Job Seeker';
              throw new Error(`You selected "${roleName}" but this account is registered as "${actualRoleName}". Please select the correct role and try again.`);
            }
          }
          
          // Store user data
          localStorage.setItem('user', JSON.stringify(userData.user));
          localStorage.setItem('isAuthenticated', 'true');
          
          // For company accounts, check organization approval status
          const accountType = userData.user.accountType?.toLowerCase();
          if (accountType === 'company') {
            if (isRestrictedCompanyUser(userData.user)) {
              // Organization has a restricted status, route user to status step
              const reason =
                getOrganizationRejectionReason(userData.user)
                || getOrganizationSuspensionReason(userData.user);
              setAuthenticatedUser(userData.user);
              if (reason) {
                setStatusType('info');
                setStatusMessage(`Organization review update: ${reason}`);
              }
              navigate(buildPendingApprovalRoute(userData.user), { replace: true });
              return;
            }
          }
          
          // Navigate based on account type
          const dashboardRoute = accountType === 'candidate'
            ? '/candidate-dashboard'
            : '/company-dashboard';
          setAuthenticatedUser(userData.user);
          navigate(redirectPath || dashboardRoute);
        } else {
          throw new Error('Failed to retrieve user information');
        }
      } catch (apiError) {
        const apiMessage = apiError?.message || '';
        const normalized = apiMessage.toLowerCase();
        const isMissingBackendUser =
          normalized.includes('user not found') ||
          normalized.includes('not found') ||
          normalized.includes('404');

        if (isMissingBackendUser) {
          const selectedAccountType = formData.userType || 'candidate';
          localStorage.setItem('pendingAccountType', selectedAccountType);
          localStorage.setItem(
            'pendingRegistration',
            JSON.stringify({
              accountType: selectedAccountType,
              email: formData.email,
            }),
          );

          setStatusType('info');
          setStatusMessage('Your sign-in worked, but your InterviewAI account setup is not complete yet. Redirecting you to Create Account...');
          setTimeout(() => navigate(registerHref), 1800);
          return;
        }

        throw apiError;
      }
    } catch (err) {
      console.error('Login error:', err);
      const friendlyMessage = friendlyRateLimitMessage(err.message);
      setError(friendlyMessage || 'Login failed. Please try again.');
      setStatusMessage('');
    } finally {
      setIsLoading(false);
    }
  };

  const cleanupUnregisteredAuthUser = async (userId) => {
    if (!userId) return;
    try {
      await apiClient.auth.deleteUnregisteredAuthUser(userId);
    } catch (cleanupError) {
      console.error('Failed to delete unregistered auth user:', cleanupError);
    }
  };

  const handleSocialLogin = async () => {
    let signedInWithGoogle = false;
    let firebaseUid = null;
    setIsLoading(true);
    setError('');
    setStatusMessage('');
    setStatusType('');

    try {
      const { data, error } = await authHelpers.signInWithGoogle();
      if (error) {
        throw new Error(error.message || 'Google sign-in failed. Please try again.');
      }

      if (!data?.session?.access_token) {
        throw new Error('Failed to obtain Google session. Please try again.');
      }

      signedInWithGoogle = true;
      firebaseUid = data?.user?.id || null;

      const userData = await apiClient.auth.getMe();

      if (userData.success && userData.user) {
        const accountType = userData.user.accountType?.toLowerCase();
        
        // Block non-public account types from public login (no user-facing reference)
        if (accountType === 'system_admin') {
          await authHelpers.signOut();
          throw new Error('Invalid email or password.');
        }
        
        localStorage.setItem('user', JSON.stringify(userData.user));
        localStorage.setItem('isAuthenticated', 'true');

        // For company accounts, check organization approval status
        if (accountType === 'company') {
          if (isRestrictedCompanyUser(userData.user)) {
            // Organization has a restricted status, route user to status step
            const reason =
              getOrganizationRejectionReason(userData.user)
              || getOrganizationSuspensionReason(userData.user);
            setAuthenticatedUser(userData.user);
            if (reason) {
              setStatusType('info');
              setStatusMessage(`Organization review update: ${reason}`);
            }
            navigate(buildPendingApprovalRoute(userData.user), { replace: true });
            return;
          }
        }

        const dashboardRoute = accountType === 'candidate'
          ? '/candidate-dashboard'
          : '/company-dashboard';
        setAuthenticatedUser(userData.user);
        navigate(redirectPath || dashboardRoute);
        return;
      }

      throw new Error('No InterviewAI account is linked to this Google email.');
    } catch (err) {
      console.error('Google login error:', err);
      const message = err?.message || 'Google sign-in failed. Please try again.';
      const normalized = message.toLowerCase();
      const isAccountMissing =
        normalized.includes('no interviewai account') ||
        normalized.includes('user not found') ||
        normalized.includes('404');

      if (signedInWithGoogle && isAccountMissing) {
        await cleanupUnregisteredAuthUser(firebaseUid);
      }

      if (signedInWithGoogle) {
        try {
          await authHelpers.signOut();
        } catch (signOutError) {
          console.error('Failed to clean up Google session:', signOutError);
        }
      }

      if (isAccountMissing) {
        setError('No InterviewAI account is linked to this Google email yet. Redirecting you to Create Account...');
        setTimeout(() => navigate(registerHref), 1800);
      } else {
        setError(friendlyRateLimitMessage(message));
      }
      setStatusMessage('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (email) => {
    const trimmedEmail = email?.trim();
    setError('');
    setStatusMessage('');
    setStatusType('');

    if (!trimmedEmail || !/\S+@\S+\.\S+/.test(trimmedEmail)) {
      setError('Please enter a valid email address above before requesting a reset link.');
      return;
    }

    setIsResettingPassword(true);

    try {
      const { error: resetError } = await authHelpers.sendPasswordReset(trimmedEmail);
      if (resetError) {
        throw new Error(resetError.message || 'Failed to send password reset email.');
      }

      setStatusType('info');
      setStatusMessage(`Password reset link sent to ${trimmedEmail}. Please check your inbox (and spam folder).`);
    } catch (err) {
      console.error('Password reset error:', err);
      setError(err.message || 'Failed to send password reset email. Please try again.');
      setStatusMessage('');
    } finally {
      setIsResettingPassword(false);
    }
  };
  useEffect(() => {
    const successKey = 'passwordResetSuccess';
    if (localStorage.getItem(successKey) === 'true') {
      setStatusType('success');
      setStatusMessage('Password updated successfully. You can sign in with your new password.');
      localStorage.removeItem(successKey);
    }
  }, []);

  const handleNavigateToRegister = () => {
    navigate(registerHref);
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 overflow-hidden transition-colors duration-300">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -top-24 -right-16 h-96 w-96 bg-gradient-to-br from-blue-500/40 via-purple-500/25 to-transparent blur-[160px]" />
        <div className="absolute bottom-0 -left-20 h-[480px] w-[480px] bg-gradient-to-tr from-indigo-300/25 via-cyan-200/20 to-transparent blur-[140px]" />
        <div className="absolute inset-0 opacity-50 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.12),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(147,51,234,0.12),transparent_40%)]" />
      </div>

      <div className="relative z-10 flex min-h-screen items-start lg:items-center justify-center px-3 sm:px-4 md:px-6 py-6 sm:py-8 lg:py-4">
        <motion.div
          variants={sectionReveal}
          initial="hidden"
          animate="visible"
          className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-4 lg:gap-6 max-h-[calc(100vh-4rem)] lg:max-h-[calc(100vh-3rem)]"
        >
          {/* Left hero */}
          <motion.div
            variants={fadeUpChild}
            className="relative overflow-hidden rounded-3xl border border-gray-800 dark:border-slate-700 bg-gray-900 dark:bg-slate-950 p-5 sm:p-6 shadow-2xl shadow-black/40 dark:shadow-black/60 hidden lg:flex flex-col"
          >
            <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_0%_0%,rgba(59,130,246,0.15),transparent_45%),radial-gradient(circle_at_100%_0%,rgba(147,51,234,0.15),transparent_40%)]" />
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-purple-500/5 rounded-full blur-3xl" />
            
            <div className="relative z-10 flex-1 flex flex-col justify-center space-y-4 lg:space-y-5">
              {/* Trust Badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-gray-800 bg-gray-800/70 px-3 py-1.5 w-fit">
                <Icon name="Award" size={14} className="text-blue-400" />
                <span className="text-xs font-medium text-gray-300">Trusted by 50K+ professionals</span>
              </div>

              <div className="space-y-1.5 lg:space-y-2">
                <p className="text-xs lg:text-sm uppercase tracking-[0.4em] text-gray-400">Login</p>
                <BrandMark
                  showTagline
                  className="items-start"
                  iconWrapperClassName="w-12 h-12 lg:w-14 lg:h-14 rounded-3xl"
                  textClassName="text-2xl lg:text-3xl font-bold"
                  taglineClassName="text-xs lg:text-sm text-gray-400"
                  textColor="text-white"
                  proColor="text-blue-400"
                />
              </div>
              <p className="text-sm lg:text-base text-gray-300 max-w-md leading-relaxed">
                Practice live interviews, benchmark your performance, and align hiring teams inside one futuristic workspace powered by AI.
              </p>
              
              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-2 lg:gap-3">
                {heroHighlights.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-gray-800 bg-gray-800/70 px-3 py-2 lg:px-4 lg:py-3 shadow-inner shadow-black/20 hover:border-blue-500/30 transition-colors"
                  >
                    <p className="text-[10px] lg:text-xs uppercase tracking-[0.2em] text-gray-400">{item.label}</p>
                    <p className="text-lg lg:text-xl font-semibold text-white">{item.value}</p>
                  </div>
                ))}
              </div>

              {/* Feature Highlights */}
              <div className="grid grid-cols-2 gap-2 lg:gap-3 pt-2">
                {[
                  { icon: 'Zap', text: 'Adaptive AI prompts', color: 'text-yellow-400' },
                  { icon: 'BarChart3', text: 'Live analytics', color: 'text-blue-300' },
                  { icon: 'Shield', text: 'Enterprise security', color: 'text-green-400' },
                  { icon: 'Users', text: '24/5 support', color: 'text-purple-300' }
                ].map((item) => (
                  <div key={item.text} className="flex items-center gap-2 rounded-xl border border-gray-800 bg-gray-800/50 px-2.5 py-2 hover:border-gray-700 transition-colors">
                    <div className={`w-5 h-5 lg:w-6 lg:h-6 rounded-lg bg-blue-500/10 border border-gray-800 flex items-center justify-center ${item.color}`}>
                      <Icon name={item.icon} size={12} className="lg:w-3.5 lg:h-3.5" color="currentColor" />
                    </div>
                    <span className="text-xs lg:text-sm text-gray-300 font-medium">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Bottom Section */}
            <div className="relative z-10 mt-4 lg:mt-5 pt-4 border-t border-gray-800">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Platform Status</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-xs text-green-400 font-medium">All systems operational</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl border border-gray-800 bg-gray-800/50 px-3 py-2">
                  <p className="text-gray-400 mb-1">Uptime</p>
                  <p className="text-white font-semibold">99.9%</p>
                </div>
                <div className="rounded-xl border border-gray-800 bg-gray-800/50 px-3 py-2">
                  <p className="text-gray-400 mb-1">Response SLA</p>
                  <p className="text-white font-semibold">&lt; 4 hrs</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Form card */}
          <motion.div
            variants={fadeUpChild}
            className="rounded-3xl border border-white/30 dark:border-slate-700/50 bg-white/85 dark:bg-slate-800/85 p-4 sm:p-5 md:p-6 shadow-[0_25px_80px_rgba(15,23,42,0.18)] dark:shadow-[0_25px_80px_rgba(0,0,0,0.5)] backdrop-blur flex flex-col justify-start"
          >
            <LoginHeader />
            <div className="space-y-3 lg:space-y-4 flex-1 min-h-0">
              <LoginForm 
                onSubmit={handleLogin}
                isLoading={isLoading}
                error={error}
                onForgotPassword={handleForgotPassword}
                isResettingPassword={isResettingPassword}
                statusMessage={statusMessage}
                statusType={statusType}
                initialEmail={location.state?.email}
              />
              <SocialLogin 
                onSocialLogin={handleSocialLogin}
                isLoading={isLoading}
              />
            </div>
            <LoginFooter onNavigateToRegister={handleNavigateToRegister} />
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
