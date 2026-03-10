import React, { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';

const LoginForm = ({ onSubmit, isLoading, error, onForgotPassword, isResettingPassword, statusMessage, statusType, initialEmail }) => {
  const [formData, setFormData] = useState({
    email: initialEmail || '',
    password: '',
    userType: 'candidate'
  });

  // Update email if initialEmail prop changes
  useEffect(() => {
    if (initialEmail) {
      setFormData(prev => ({ ...prev, email: initialEmail }));
    }
  }, [initialEmail]);
  const [formErrors, setFormErrors] = useState({});

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (formErrors?.[field]) {
      setFormErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const errors = {};
    
    if (!formData?.email) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData?.email)) {
      errors.email = 'Please enter a valid email address';
    }
    
    if (!formData?.password) {
      errors.password = 'Password is required';
    } else if (formData?.password?.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }
    
    setFormErrors(errors);
    return Object.keys(errors)?.length === 0;
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  const handleForgotPasswordClick = () => {
    if (!formData?.email || !/\S+@\S+\.\S+/.test(formData?.email)) {
      setFormErrors(prev => ({
        ...prev,
        email: formData?.email ? 'Please enter a valid email to reset your password' : 'Enter your email address to reset your password'
      }));
      return;
    }

    if (onForgotPassword) {
      onForgotPassword(formData.email);
    }
  };

  const renderStatusBanner = () => {
    if (!statusMessage) return null;

    const isSuccess = statusType === 'success';
    const baseClasses = isSuccess
      ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
      : 'border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400';
    const iconName = isSuccess ? 'CheckCircle' : 'Info';
    const iconColor = isSuccess ? 'text-emerald-500' : 'text-sky-500';

    return (
      <div className={`p-3 lg:p-4 rounded-xl border ${baseClasses} flex items-center space-x-2`}>
        <Icon name={iconName} size={16} className={`${iconColor} lg:w-5 lg:h-5`} />
        <p className="text-xs lg:text-sm font-medium">{statusMessage}</p>
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 lg:space-y-4">
      {/* User Type Selection */}
      <div className="space-y-1.5 lg:space-y-2">
        <label className="text-xs lg:text-sm font-medium text-gray-600 dark:text-slate-300">I am signing in as</label>
        <div className="grid grid-cols-2 gap-2 lg:gap-3">
          <button
            type="button"
            onClick={() => handleInputChange('userType', 'candidate')}
            className={`p-2.5 lg:p-3.5 rounded-xl border transition-all duration-200 min-w-0 text-left ${
              formData?.userType === 'candidate'
                ? 'border-blue-500/60 dark:border-blue-500/60 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 shadow-[0_10px_30px_rgba(59,130,246,0.25)]'
                : 'border-white/40 dark:border-slate-700/50 bg-white/70 dark:bg-slate-800/70 text-gray-500 dark:text-slate-400 hover:border-blue-200 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400'
            }`}
          >
            <Icon name="User" size={16} className="mb-1 lg:mb-1.5 text-current lg:w-5 lg:h-5" />
            <div className="text-xs lg:text-sm font-semibold">Job Seeker</div>
            <div className="text-[10px] lg:text-xs opacity-70">Practice</div>
          </button>
          <button
            type="button"
            onClick={() => handleInputChange('userType', 'company')}
            className={`p-2.5 lg:p-3.5 rounded-xl border transition-all duration-200 min-w-0 text-left ${
              formData?.userType === 'company'
                ? 'border-purple-500/60 dark:border-purple-500/60 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 shadow-[0_10px_30px_rgba(147,51,234,0.25)]'
                : 'border-white/40 dark:border-slate-700/50 bg-white/70 dark:bg-slate-800/70 text-gray-500 dark:text-slate-400 hover:border-purple-200 dark:hover:border-purple-600 hover:text-purple-600 dark:hover:text-purple-400'
            }`}
          >
            <Icon name="Building" size={16} className="mb-1 lg:mb-1.5 text-current lg:w-5 lg:h-5" />
            <div className="text-xs lg:text-sm font-semibold">Employer</div>
            <div className="text-[10px] lg:text-xs opacity-70">Conduct</div>
          </button>
        </div>
      </div>
      {/* Email Input */}
      <div className="min-w-0">
        <Input
          id="login-email"
          label="Email Address"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="Enter your email address"
          value={formData?.email}
          onChange={(e) => handleInputChange('email', e?.target?.value)}
          error={formErrors?.email}
          required
          disabled={isLoading}
        />
      </div>
      {/* Password Input */}
      <div className="min-w-0">
        <Input
          id="login-password"
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          value={formData?.password}
          onChange={(e) => handleInputChange('password', e?.target?.value)}
          error={formErrors?.password}
          required
          disabled={isLoading}
        />
      </div>
      {/* Status Messages */}
      {renderStatusBanner()}

      {/* Global Error */}
      {error && (
        <div className="p-3 lg:p-4 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 flex items-center space-x-2">
          <Icon name="AlertCircle" size={16} className="text-rose-500 dark:text-rose-400 lg:w-5 lg:h-5" />
          <p className="text-xs lg:text-sm font-medium">{error}</p>
        </div>
      )}
      {/* Submit Button */}
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
      {/* Forgot Password Link */}
      <div className="text-center">
        <button
          type="button"
          className={`text-xs lg:text-sm font-medium transition-colors duration-200 ${
            isResettingPassword ? 'text-gray-400 dark:text-slate-500 cursor-not-allowed' : 'text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400'
          }`}
          onClick={handleForgotPasswordClick}
          disabled={isLoading || isResettingPassword}
        >
          {isResettingPassword ? 'Sending reset link...' : 'Forgot password?'}
        </button>
      </div>
    </form>
  );
};

export default LoginForm;
