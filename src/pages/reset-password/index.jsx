import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';

import BrandMark from '../../components/BrandMark';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Icon from '../../components/AppIcon';
import { authHelpers } from '../../config/firebase.js';
import PasswordStrengthIndicator from '../register/components/PasswordStrengthIndicator';
import PasswordMatchIndicator from '../register/components/PasswordMatchIndicator';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const oobCode = searchParams.get('oobCode');

  const [email, setEmail] = useState('');
  const [isVerifying, setIsVerifying] = useState(true);
  const [verificationError, setVerificationError] = useState('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);

  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState('');

  const viewportConfig = useMemo(() => ({ once: true, amount: 0.25 }), []);

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

  useEffect(() => {
    const verifyCode = async () => {
      if (!oobCode) {
        setVerificationError('Invalid password reset link. Please request a new email.');
        setIsVerifying(false);
        return;
      }

      try {
        const { email, error } = await authHelpers.verifyPasswordResetCode(oobCode);
        if (error || !email) {
          throw error;
        }
        setEmail(email);
      } catch (error) {
        console.error('Reset code verification failed:', error);
        setVerificationError('This password reset link is invalid or has expired. Please request a new one.');
      } finally {
        setIsVerifying(false);
      }
    };

    verifyCode();
  }, [oobCode]);

  const validateForm = () => {
    const errors = {};

    if (!password) {
      errors.password = 'Please enter a new password';
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Please confirm your new password';
    } else if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setStatusMessage('');
    setStatusType('');

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await authHelpers.confirmPasswordReset(oobCode, password);
      if (error) {
        throw error;
      }

      setResetComplete(true);
      setStatusType('success');
      setStatusMessage('Password updated successfully! You can return to your original tab to finish signing in.');
      localStorage.setItem('passwordResetSuccess', 'true');
    } catch (error) {
      console.error('Password reset failed:', error);
      setStatusType('error');
      setStatusMessage(error?.message || 'Failed to update your password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStatusBanner = () => {
    if (!statusMessage) return null;

    const isSuccess = statusType === 'success';
    const isError = statusType === 'error';
    const border = isSuccess
      ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
      : isError
        ? 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'
        : 'border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400';
    const iconName = isSuccess ? 'CheckCircle' : isError ? 'AlertCircle' : 'Info';
    const iconColor = isSuccess ? 'text-emerald-500 dark:text-emerald-400' : isError ? 'text-rose-500 dark:text-rose-400' : 'text-sky-500 dark:text-sky-400';

    return (
      <div className={`p-4 rounded-2xl border ${border} flex items-center space-x-2`}>
        <Icon name={iconName} size={18} className={iconColor} />
        <p className="text-sm font-medium">{statusMessage}</p>
      </div>
    );
  };

  return (
    <>
      <Helmet>
        <title>Reset Password - InterviewAI Pro</title>
        <meta
          name="description"
          content="Reset your InterviewAI Pro password to get back into your AI-powered interview workspace."
        />
      </Helmet>
      <div className="relative min-h-screen bg-gradient-to-b from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 overflow-hidden transition-colors duration-300">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 -right-24 h-[420px] w-[420px] bg-gradient-to-br from-blue-500/40 via-purple-500/25 to-transparent blur-[160px]" />
          <div className="absolute bottom-0 -left-32 h-[520px] w-[520px] bg-gradient-to-tr from-indigo-300/25 via-cyan-200/20 to-transparent blur-[160px]" />
          <div className="absolute inset-0 opacity-50 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.12),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(147,51,234,0.12),transparent_40%)]" />
        </div>

        <div className="relative z-10 flex min-h-screen items-center justify-center px-3 sm:px-4 md:px-6 py-8">
          <motion.div
            variants={sectionReveal}
            initial="hidden"
            animate="visible"
            viewport={viewportConfig}
            className="grid w-full max-w-5xl grid-cols-1 gap-6 lg:grid-cols-11"
          >
            <motion.div
              variants={fadeUpChild}
              className="rounded-3xl border border-white/30 dark:border-slate-700/50 bg-white/85 dark:bg-slate-800/85 p-6 md:p-8 shadow-[0_25px_80px_rgba(15,23,42,0.18)] dark:shadow-[0_25px_80px_rgba(0,0,0,0.5)] backdrop-blur lg:col-span-6 flex flex-col space-y-5"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-gray-500 dark:text-slate-400">Reset Password</p>
                  <BrandMark
                    showTagline
                    className="items-start"
                    iconWrapperClassName="w-14 h-14 rounded-3xl"
                    textClassName="text-3xl font-bold"
                    taglineClassName="text-sm text-gray-500 dark:text-slate-400"
                  />
                </div>
                <div className="hidden lg:flex flex-col text-right text-sm text-gray-500 dark:text-slate-400">
                  <span>Need help?</span>
                  <button
                    type="button"
                    className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                    onClick={() => navigate('/support')}
                  >
                    Contact Support
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {verificationError ? (
                  <>
                    <h1 className="text-2xl font-semibold text-gray-900 dark:text-slate-100">Trouble resetting your password</h1>
                    <p className="text-sm text-gray-500 dark:text-slate-400">
                      This password reset link is invalid or has expired. You can request a new link from the sign-in
                      page to finish updating your password.
                    </p>
                  </>
                ) : (
                  <>
                    <h1 className="text-2xl font-semibold text-gray-900 dark:text-slate-100">Create a new password</h1>
                    <p className="text-sm text-gray-500 dark:text-slate-400">
                      {email
                        ? `You're resetting the password for ${email}.`
                        : 'Follow the steps to securely reset your account password.'}
                    </p>
                  </>
                )}
              </div>

              {!verificationError && (
                <ul className="grid grid-cols-2 gap-3 text-xs text-gray-500 dark:text-slate-400">
                  <li className="flex items-center space-x-2">
                    <Icon name="Shield" size={14} className="text-blue-500" />
                    <span>Secure reset flow</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Icon name="Lock" size={14} className="text-purple-500" />
                    <span>Encrypted credentials</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Icon name="Bell" size={14} className="text-emerald-500" />
                    <span>Email confirmation</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Icon name="BarChart3" size={14} className="text-sky-500" />
                    <span>Resume interview analytics</span>
                  </li>
                </ul>
              )}
            </motion.div>

            <motion.div
              variants={fadeUpChild}
              className="rounded-3xl border border-white/30 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-5 sm:p-6 md:p-8 shadow-[0_25px_80px_rgba(15,23,42,0.18)] dark:shadow-[0_25px_80px_rgba(0,0,0,0.5)] backdrop-blur lg:col-span-5 flex flex-col"
            >
              {verificationError ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="p-4 rounded-2xl border border-rose-200 bg-rose-50 text-rose-600 flex items-start space-x-3 max-w-md">
                    <Icon name="AlertTriangle" size={20} className="text-rose-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{verificationError}</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="lg"
                    className="rounded-full border-2 border-gray-300 text-gray-700 hover:border-blue-500 hover:text-blue-600 px-8 font-semibold transition-colors"
                    onClick={() => navigate('/login')}
                  >
                    Return to Sign In
                  </Button>
                </div>
              ) : (
                <>
                  {statusMessage && (
                    <div className="mb-6">
                      {renderStatusBanner()}
                    </div>
                  )}
                  
                  <form onSubmit={handleSubmit} className="flex-1 flex flex-col space-y-6">
                    <div className="space-y-5">
                      <div className="space-y-3">
                        <Input
                          label="New Password"
                          type="password"
                          placeholder="Create a strong password"
                          value={password}
                          onChange={(e) => setPassword(e?.target?.value)}
                          error={formErrors?.password}
                          disabled={isVerifying || isSubmitting || resetComplete}
                          required
                        />
                        {password && <PasswordStrengthIndicator password={password} />}
                      </div>
                      
                      <div className="space-y-3">
                        <Input
                          label="Confirm Password"
                          type="password"
                          placeholder="Re-enter your new password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e?.target?.value)}
                          error={formErrors?.confirmPassword}
                          disabled={isVerifying || isSubmitting || resetComplete}
                          required
                        />
                        {confirmPassword && <PasswordMatchIndicator password={password} confirmPassword={confirmPassword} />}
                      </div>
                    </div>

                    <div className="pt-2">
                      <Button
                        type="submit"
                        variant="default"
                        fullWidth
                        disabled={isVerifying || isSubmitting || resetComplete}
                        loading={isSubmitting}
                        className="h-12 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white text-base font-semibold shadow-lg shadow-blue-500/30 hover:from-blue-700 hover:to-purple-700"
                      >
                        {resetComplete ? 'Password Updated' : 'Update Password'}
                      </Button>
                    </div>
                  </form>
                </>
              )}
            </motion.div>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default ResetPassword;

