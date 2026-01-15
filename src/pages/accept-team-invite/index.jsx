import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import Icon from '../../components/AppIcon';
import PasswordStrengthIndicator from '../register/components/PasswordStrengthIndicator';
import PasswordMatchIndicator from '../register/components/PasswordMatchIndicator';
import apiClient from '../../services/apiClient';
import { authHelpers } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import {
  passwordMeetsAllRequirements,
  PASSWORD_REQUIREMENT_MESSAGE,
} from '../../utils/passwordValidation';

const AcceptTeamInvitePage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { setAuthenticatedUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');

  const departments = [
    { value: 'hr', label: 'Human Resources' },
    { value: 'engineering', label: 'Engineering & Development' },
    { value: 'sales', label: 'Sales & Marketing' },
    { value: 'operations', label: 'Operations' },
    { value: 'finance', label: 'Finance & Accounting' },
    { value: 'executive', label: 'Executive Leadership' },
    { value: 'other', label: 'Other' }
  ];

  useEffect(() => {
    const fetchInvitation = async () => {
      setLoading(true);
      setError('');
      try {
        const result = await apiClient.teamInvitations.getByToken(token);
        if (result.success) {
          setInvitation(result.invitation);
        } else {
          setError(result.error || 'Invitation is invalid or has expired.');
        }
      } catch (err) {
        setError(err?.message || 'Failed to load invitation.');
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchInvitation();
    } else {
      setError('Invitation token is missing.');
      setLoading(false);
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!invitation) return;

    // Reset errors
    setError('');
    setPasswordError('');
    setConfirmPasswordError('');

    // Validate required fields
    if (!fullName.trim() || !jobTitle.trim() || !password || !confirmPassword) {
      setError('Please fill in all required fields.');
      return;
    }

    // Validate password meets requirements
    if (!passwordMeetsAllRequirements(password)) {
      setPasswordError(PASSWORD_REQUIREMENT_MESSAGE);
      return;
    }

    // Validate passwords match
    if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      // Step 1: Create Firebase Auth account first (required by registration endpoint)
      const { data: authData, error: authError } = await authHelpers.signUp(
        invitation.email,
        password,
        {
          fullName: fullName.trim(),
          accountType: 'COMPANY',
        }
      );

      if (authError) {
        const errorCode = authError?.code;
        if (errorCode === 'auth/email-already-in-use') {
          throw new Error('An account with this email already exists. Please sign in instead.');
        }
        throw new Error(authError.message || 'Failed to create account.');
      }

      if (!authData?.user || !authData?.session?.access_token) {
        throw new Error('Failed to create user account');
      }

      // Step 2: Register with backend using the Firebase Auth token
      const registerData = await apiClient.auth.register({
        fullName: fullName.trim(),
        email: invitation.email,
        accountType: 'COMPANY',
        teamInvitationToken: token,
        jobTitle: jobTitle.trim() || undefined,
        department: department || undefined,
        phoneNumber: phoneNumber.trim() || undefined,
      });

      if (!registerData.success || !registerData.user) {
        throw new Error(registerData.error || 'Registration failed.');
      }

      // Sign out the user since we created the account but want them to log in
      try {
        await authHelpers.signOut();
      } catch (signOutError) {
        console.error('Failed to sign out after registration:', signOutError);
        // Continue anyway - user can still log in
      }

      // Don't store user data or set as authenticated - user should log in
      // Redirect to login page with email prefilled
      navigate('/login', { state: { email: invitation.email } });
    } catch (err) {
      setError(err?.message || 'Failed to complete registration.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/60 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-xl shadow-blue-500/10 dark:shadow-black/40 backdrop-blur p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/40">
            <Icon name="Users" size={20} color="white" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-slate-100">
              Accept Team Invitation
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400">
              Join your team on InterviewAI Pro
            </p>
          </div>
        </div>

        {loading && (
          <p className="text-sm text-gray-500 dark:text-slate-400">Loading invitation...</p>
        )}

        {!loading && error && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs sm:text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
            {error}
          </div>
        )}

        {!loading && !error && invitation && (
          <>
            <div className="mb-4 rounded-xl border border-gray-200/70 dark:border-slate-700/70 bg-gray-50/80 dark:bg-slate-900/60 px-3 py-3 text-xs sm:text-sm text-gray-700 dark:text-slate-300">
              <p className="mb-1">
                You&apos;ve been invited to join{' '}
                <span className="font-semibold">
                  {invitation.organization?.name || 'this organization'}
                </span>
                {' '}as a{' '}
                <span className="font-semibold">
                  {invitation.role}
                </span>
                .
              </p>
              <p className="text-[11px] sm:text-xs text-gray-500 dark:text-slate-400 mt-1">
                Invitation sent to: <span className="font-mono">{invitation.email}</span>
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <Input
                label="Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
              <Input
                label="Email"
                value={invitation.email}
                disabled
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input
                  label="Job Title"
                  type="text"
                  placeholder="e.g., HR Manager, Talent Acquisition Lead"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  required
                />
                <Select
                  label="Department"
                  placeholder="Select your department"
                  options={departments}
                  value={department}
                  onChange={(value) => setDepartment(value)}
                />
              </div>
              <Input
                label="Phone Number"
                type="tel"
                placeholder="+1 (555) 123-4567"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Input
                    label="Password"
                    type="password"
                    placeholder="Create a strong password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setPasswordError('');
                      setError('');
                    }}
                    error={passwordError}
                    required
                  />
                  <PasswordStrengthIndicator password={password} />
                </div>
                <div className="space-y-2">
                  <Input
                    label="Confirm Password"
                    type="password"
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setConfirmPasswordError('');
                      setError('');
                    }}
                    error={confirmPasswordError}
                    required
                  />
                  <PasswordMatchIndicator 
                    password={password} 
                    confirmPassword={confirmPassword} 
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full mt-2 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 border-none text-white shadow-md shadow-blue-500/30 hover:from-blue-700 hover:to-purple-700"
              >
                {submitting ? 'Creating Account...' : 'Create Account & Join Team'}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default AcceptTeamInvitePage;


