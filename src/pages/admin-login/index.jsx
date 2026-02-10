import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import Icon from '../../components/AppIcon';
import BrandMark from '../../components/BrandMark';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { authHelpers } from '../../config/firebase.js';
import apiClient from '../../services/apiClient.js';
import { useAuth } from '../../contexts/AuthContext.jsx';

const AdminLogin = () => {
  const navigate = useNavigate();
  const { setAuthenticatedUser } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const friendlyRateLimitMessage = (message) => {
    if (!message) return '';
    const normalized = message.toLowerCase();
    if (normalized.includes('too many authentication attempts')) {
      return 'Too many login attempts. Please wait 15 minutes before trying again.';
    }
    return message;
  };

  // Same motion variants as login page
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

  // Check if already authenticated as admin
  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await authHelpers.getSession();

      if (data?.session) {
        try {
          const userData = await apiClient.auth.getMe();
          if (userData.success && userData.user) {
            const accountType = userData.user.accountType?.toLowerCase();
            if (accountType === 'system_admin') {
              navigate('/system-admin-dashboard', { replace: true });
            } else {
              await authHelpers.signOut();
              localStorage.removeItem('user');
              localStorage.removeItem('isAuthenticated');
              setError('This login is for system administrators only. Regular users should use the main login page.');
            }
          }
        } catch (error) {
          await authHelpers.signOut();
          localStorage.removeItem('user');
          localStorage.removeItem('isAuthenticated');
        }
      }
    };

    checkAuth();
  }, [navigate]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.email) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setError('');
    setStatusMessage('');

    try {
      const { data: authData, error: authError } = await authHelpers.signIn(
        formData.email,
        formData.password
      );

      if (authError) {
        throw new Error(authError.message || 'Invalid email or password');
      }

      if (!authData.user) {
        throw new Error('Authentication failed. Please try again.');
      }

      try {
        const userData = await apiClient.auth.getMe();

        if (userData.success && userData.user) {
          const accountType = userData.user.accountType?.toLowerCase();

          if (accountType !== 'system_admin') {
            await authHelpers.signOut();
            throw new Error('Access denied. This login is for system administrators only. Regular users should use the main login page at /login');
          }

          localStorage.setItem('user', JSON.stringify(userData.user));
          localStorage.setItem('isAuthenticated', 'true');

          setAuthenticatedUser(userData.user);
          navigate('/system-admin-dashboard');
        } else {
          throw new Error('Failed to retrieve admin profile');
        }
      } catch (apiError) {
        await authHelpers.signOut();
        throw apiError;
      }
    } catch (err) {
      console.error('Admin login error:', err);
      const friendlyMessage = friendlyRateLimitMessage(err.message);
      setError(friendlyMessage || 'Admin login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>System Admin Login - InterviewAI Pro</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      {/* Same page background as login/register */}
      <div className="relative min-h-screen bg-gradient-to-b from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 overflow-hidden transition-colors duration-300">
        {/* Same background effects as login page */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div className="absolute -top-24 -right-16 h-96 w-96 bg-gradient-to-br from-blue-500/40 via-purple-500/25 to-transparent blur-[160px]" />
          <div className="absolute bottom-0 -left-20 h-[480px] w-[480px] bg-gradient-to-tr from-indigo-300/25 via-cyan-200/20 to-transparent blur-[140px]" />
          <div className="absolute inset-0 opacity-50 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.12),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(147,51,234,0.12),transparent_40%)]" />
        </div>

        {/* Same content wrapper as login: items-start lg:items-center, same padding */}
        <div className="relative z-10 flex min-h-screen items-start lg:items-center justify-center px-3 sm:px-4 md:px-6 py-6 sm:py-8 lg:py-4">
          <motion.div
            variants={sectionReveal}
            initial="hidden"
            animate="visible"
            className="w-full max-w-md"
          >
            {/* Admin badge: same pattern as login trust badge (rounded-full, compact) */}
            <motion.div variants={fadeUpChild} className="mb-4 lg:mb-5 flex justify-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 px-3 py-1.5 w-fit">
                <Icon name="ShieldAlert" size={14} className="text-red-600 dark:text-red-400" />
                <span className="text-xs font-medium text-red-600 dark:text-red-400">System Admin Access</span>
              </div>
            </motion.div>

            {/* Card: exact same as login form card (rounded-3xl, border, bg, shadow, padding) */}
            <motion.div
              variants={fadeUpChild}
              className="rounded-3xl border border-white/30 dark:border-slate-700/50 bg-white/85 dark:bg-slate-800/85 p-4 sm:p-5 md:p-6 shadow-[0_25px_80px_rgba(15,23,42,0.18)] dark:shadow-[0_25px_80px_rgba(0,0,0,0.5)] backdrop-blur flex flex-col justify-start"
            >
              {/* Header: same structure as LoginHeader (mb-4 lg:mb-5, typography scale) */}
              <div className="text-center mb-4 lg:mb-5 space-y-2 lg:space-y-3">
                <div>
                  <h1 className="text-xl md:text-2xl lg:text-3xl xl:text-4xl font-bold text-gray-900 dark:text-slate-100">
                    Admin Portal
                  </h1>
                  <p className="mt-2 text-xs md:text-sm lg:text-base text-gray-600 dark:text-slate-300">
                    Authorized personnel only
                  </p>
                </div>
              </div>

              {/* Form: same spacing as LoginForm (space-y-3 lg:space-y-4) */}
              <form onSubmit={handleSubmit} className="space-y-3 lg:space-y-4 flex-1 min-h-0">
                <div className="min-w-0">
                  <Input
                    label="Email Address"
                    type="email"
                    placeholder="Enter your email address"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    error={formErrors.email}
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="min-w-0">
                  <Input
                    label="Password"
                    type="password"
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    error={formErrors.password}
                    required
                    disabled={isLoading}
                  />
                </div>

                {/* Status message: same as LoginForm (rounded-xl, p-3 lg:p-4, sky/emerald) */}
                {statusMessage && (
                  <div className="p-3 lg:p-4 rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 flex items-center space-x-2">
                    <Icon name="Info" size={16} className="text-sky-500 lg:w-5 lg:h-5" />
                    <p className="text-xs lg:text-sm font-medium">{statusMessage}</p>
                  </div>
                )}

                {/* Error: same as LoginForm (rose, rounded-xl, space-x-2) */}
                {error && (
                  <div className="p-3 lg:p-4 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 flex items-center space-x-2">
                    <Icon name="AlertCircle" size={16} className="text-rose-500 dark:text-rose-400 lg:w-5 lg:h-5" />
                    <p className="text-xs lg:text-sm font-medium">{error}</p>
                  </div>
                )}

                {/* Button: same as LoginForm (h-11 lg:h-12, rounded-full, gradient, shadow) */}
                <Button
                  type="submit"
                  variant="default"
                  fullWidth
                  loading={isLoading}
                  disabled={isLoading}
                  className="h-11 lg:h-12 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm lg:text-base font-semibold shadow-lg shadow-blue-500/30 hover:from-blue-700 hover:to-purple-700"
                >
                  Sign In
                </Button>

                {/* Security notice: same rounded-xl and border/bg pattern as secondary boxes on site */}
                <div className="rounded-xl border border-white/40 dark:border-slate-700/50 bg-white/70 dark:bg-slate-800/70 p-3 lg:p-4">
                  <div className="flex items-start gap-3">
                    <Icon name="Shield" size={16} className="text-gray-500 dark:text-slate-400 flex-shrink-0 mt-0.5 lg:w-5 lg:h-5" />
                    <p className="text-xs lg:text-sm text-gray-600 dark:text-slate-400 leading-relaxed">
                      All admin sessions are logged and monitored. Unauthorized access attempts are tracked and reported.
                    </p>
                  </div>
                </div>
              </form>

              {/* Footer: same structure as LoginFooter (border-t, spacing, link styles) */}
              <div className="mt-4 lg:mt-5 pt-3 lg:pt-4 border-t border-white/30 dark:border-slate-700/50 space-y-3">
                <div className="text-center space-y-1.5 lg:space-y-2">
                  <p className="text-xs lg:text-sm text-gray-500 dark:text-slate-400">Regular user?</p>
                  <Button
                    variant="outline"
                    fullWidth
                    onClick={() => navigate('/login')}
                    className="h-10 lg:h-11 rounded-full border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-slate-200 font-semibold hover:border-blue-300 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400 text-sm lg:text-base"
                  >
                    Use main login page
                  </Button>
                </div>
                <div className="text-center text-[10px] lg:text-xs text-gray-400 dark:text-slate-500">
                  <p>
                    © {new Date().getFullYear()} InterviewAI Pro ·
                    <a href="/privacy" className="text-blue-600 dark:text-blue-400 hover:underline mx-1">Privacy</a>·
                    <a href="/terms" className="text-blue-600 dark:text-blue-400 hover:underline mx-1">Terms</a>·
                    <a href="/help-center" className="text-blue-600 dark:text-blue-400 hover:underline mx-1">Help Center</a>
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default AdminLogin;
