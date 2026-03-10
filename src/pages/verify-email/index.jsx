import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authHelpers } from '../../config/firebase.js';
import apiClient from '../../services/apiClient.js';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import LoadingIndicator from '../../components/ui/LoadingIndicator';
import {
  buildPendingApprovalRoute,
  isRestrictedCompanyUser,
} from '../../utils/organizationAccess.js';

const VerifyEmail = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('verifying'); // 'verifying', 'success', 'error', 'already-verified'
  const [message, setMessage] = useState('Verifying your email...');
  const [userData, setUserData] = useState(null);

  // Decide which dashboard path to navigate to based on accountType
  const redirectToDashboard = (userObj) => {
    try {
      if (isRestrictedCompanyUser(userObj)) {
        navigate(buildPendingApprovalRoute(userObj), { replace: true });
        return;
      }

      const accountType = (userObj && (userObj.accountType || userObj.account_type)) || 'CANDIDATE';
      if ((accountType || '').toString().toUpperCase() === 'COMPANY') {
        navigate('/company-dashboard');
      } else {
        navigate('/candidate-dashboard');
      }
    } catch (e) {
      // Fallback
      navigate('/candidate-dashboard');
    }
  };

  // Try to close the window (if opened for OAuth). If not possible, redirect to dashboard.
  const closeOrRedirect = (userObj) => {
    try {
      if (window.opener || window.history.length <= 2) {
        window.close();
        return;
      }
    } catch (e) {
      // ignore
    }
    redirectToDashboard(userObj);
  };

  useEffect(() => {
    const handleVerification = async () => {
      try {
        // Get tokens from URL hash or query params
        const hash = window.location.hash;
        const hashParams = new URLSearchParams(hash.substring(1));
        
        const token = hashParams.get('access_token') || searchParams.get('access_token') || searchParams.get('token');
        const type = hashParams.get('type') || searchParams.get('type');
        const error = hashParams.get('error') || searchParams.get('error');
        const errorDescription = hashParams.get('error_description') || searchParams.get('error_description');

        // Check for errors first
        if (error) {
          setStatus('error');
          setMessage(errorDescription || 'Email verification failed');
          return;
        }

        // Handle OAuth callbacks and complete registration when possible.
        
        // Check if we have a session (user may have verified and signed in)
        const { data: sessionData } = await authHelpers.getSession();
        const session = sessionData?.session;
        
        if (session) {
          // Session exists - user may have verified email
          // Try to complete registration by syncing with backend
          try {
            // Check if this is a login attempt (not registration)
            const socialAuthIntent = localStorage.getItem('socialAuthIntent');
            const socialAuthProvider = localStorage.getItem('socialAuthProvider') || 'Google';
            const isLoginAttempt = socialAuthIntent === 'login';
            
            // First, try to get user from backend (they might already be registered)
            let userExistsInBackend = false;
            let userData;
            
            try {
              userData = await apiClient.auth.getMe();
              
              if (userData.success && userData.user) {
                userExistsInBackend = true;
                // User exists in backend, show success and redirect
                setStatus('success');
                setMessage('Email verified successfully!');
                localStorage.setItem('user', JSON.stringify(userData.user));
                localStorage.setItem('isAuthenticated', 'true');
                // Clear pending registration data and auth intent
                localStorage.removeItem('pendingRegistration');
                localStorage.removeItem('socialAuthIntent');
                localStorage.removeItem('socialAuthProvider');
                setUserData(userData.user);
                
                // Notify other tabs that verification is complete
                localStorage.setItem('socialAuthVerified', 'true');
                localStorage.setItem('socialAuthData', JSON.stringify({ user: userData.user }));
                
                // Try to close this tab/window if it was opened for OAuth verification
                // Wait a moment to ensure the message is displayed
                setTimeout(() => {
                  closeOrRedirect(userData.user);
                }, 2500);
                return;
              }
            } catch (getMeError) {
              // User doesn't exist in backend
              userExistsInBackend = false;
            }
            
            // If user doesn't exist and this is a login attempt, show error and DO NOT register
            if (!userExistsInBackend && isLoginAttempt) {
              // Get the current user ID before signing out
              let userId = null;
              try {
                const { data } = await authHelpers.getUser();
                userId = data?.user?.id;
              } catch (userError) {
                console.error('Failed to get user ID:', userError);
              }
              
              // Delete the user from Firebase Auth since they shouldn't have been created
              if (userId) {
                try {
                  const deleteResult = await apiClient.auth.deleteUnregisteredAuthUser(userId);
                  
                  if (deleteResult && deleteResult.success) {
                  } else {
                    console.warn('Failed to delete auth user:', deleteResult);
                  }
                } catch (deleteError) {
                  console.error('Error deleting auth user:', deleteError);
                  // This is not critical - the user is signed out and backend has no record
                  // The orphaned auth record won't affect functionality
                }
              } else {
                console.warn('No user ID available, cannot delete auth user');
              }

              // Sign out after cleanup attempt
              try {
                await authHelpers.signOut();
              } catch (signOutError) {
                console.error('Failed to sign out:', signOutError);
              }
              
              // Show error message to user
              setStatus('error');
              setMessage(`No account is registered on this website with the provided ${socialAuthProvider} account. Please register first or use a different sign-in method.`);
              
              // Clear ALL auth-related storage to prevent any residual data
              localStorage.removeItem('socialAuthIntent');
              localStorage.removeItem('socialAuthProvider');
              localStorage.removeItem('pendingRegistration');
              localStorage.removeItem('pendingAccountType');
              localStorage.removeItem('user');
              localStorage.removeItem('isAuthenticated');
              localStorage.removeItem('socialAuthVerified');
              localStorage.removeItem('socialAuthData');
              
              // Stop here - do not continue with registration
              return;
            }
            
            // If we reach here, it means:
            // 1. User doesn't exist in backend AND
            // 2. This is NOT a login attempt (it's a registration attempt)
            // So we proceed with registration
            
            if (!userExistsInBackend && !isLoginAttempt) {
            } else {
              // This shouldn't happen, but just in case
              return;
            }

            // User doesn't exist in backend, try to register
            // Get registration data from localStorage or user metadata
            const pendingRegistration = localStorage.getItem('pendingRegistration');
            let registrationData;
            
            if (pendingRegistration) {
              try {
                registrationData = JSON.parse(pendingRegistration);
              } catch (e) {
                console.error('Failed to parse pending registration data:', e);
              }
            }

            // Fallback to user metadata or localStorage if no pending registration
            if (!registrationData) {
              const storedAccountType = localStorage.getItem('pendingAccountType');
              const accountType = storedAccountType || session.user.user_metadata?.accountType || 'candidate';
              registrationData = {
                accountType: accountType,
                fullName: session.user.user_metadata?.fullName || session.user.email?.split('@')[0] || 'User',
              };
              // Store for later use
              localStorage.setItem('pendingRegistration', JSON.stringify(registrationData));
            }

            const accountTypeUpper = (registrationData.accountType || 'candidate').toUpperCase();
            
            // Verify we have a token before making the API call
            const token = await authHelpers.getAccessToken();
            if (!token) {
              throw new Error('No authentication token available. Please try logging in again.');
            }

            setStatus('success');
            setMessage('Email verified successfully! Please complete your account setup to finish registration.');
            setTimeout(() => {
              navigate('/register');
            }, 1500);
            return;
          } catch (regError) {
            console.error('Registration sync error:', regError);
            console.error('Error details:', {
              message: regError.message,
              stack: regError.stack,
              name: regError.name,
            });
            setStatus('error');
            const errorMessage = regError.message || 'Unknown error occurred';
            setMessage(`Failed to complete registration: ${errorMessage}. Your email is verified, but we couldn't create your account. Please try logging in - if that doesn't work, contact support.`);
            // Email is still verified, give user option to login after showing error
            // Don't auto-redirect - let user see the error and manually go to login
          }
        } else if (token && type === 'email') {
          setStatus('info');
          setMessage('Email verification is completed with the 8-digit code. Please return to registration to enter your code.');
          setTimeout(() => {
            navigate('/register');
          }, 3000);
        } else {
          // No tokens found - check if user is already signed in
          const { data: sessionData } = await authHelpers.getSession();
          if (sessionData?.session) {
            // User is signed in, check backend
            try {
              const userData = await apiClient.auth.getMe();
              if (userData.success && userData.user) {
                redirectToDashboard(userData.user);
                return;
              }
            } catch (e) {
              // Not registered yet
            }
          }
          
          setStatus('error');
          setMessage('Invalid verification request. Please request a new verification code or try signing in.');
          setTimeout(() => {
            navigate('/login');
          }, 3000);
        }
      } catch (error) {
        console.error('Verification error:', error);
        setStatus('error');
        setMessage(error.message || 'Failed to verify email. Please try again.');
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      }
    };

    handleVerification();
  }, [navigate, searchParams]);

  const getStatusIcon = () => {
    switch (status) {
      case 'success':
        return 'CheckCircle';
      case 'error':
        return 'AlertCircle';
      default:
        return 'Mail';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'verifying':
        return 'text-primary';
      case 'success':
        return 'text-success';
      case 'error':
        return 'text-error';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-3 sm:p-4 md:p-6">
      <div className="w-full max-w-md">
        <div className="bg-card border border-border rounded-xl sm:rounded-2xl shadow-elevated p-5 sm:p-6 md:p-8 text-center">
          <div className="mb-4 sm:mb-5 md:mb-6">
            <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full mx-auto flex items-center justify-center mb-3 sm:mb-4 ${
              status === 'verifying' ? 'bg-primary/10' :
              status === 'success' ? 'bg-success/10' :
              'bg-error/10'
            }`}>
              {status === 'verifying' ? (
                <LoadingIndicator size={28} tone="primary" />
              ) : (
                <Icon 
                  name={getStatusIcon()} 
                  size={28} 
                  className={`${getStatusColor()} sm:w-8 sm:h-8`} 
                />
              )}
            </div>
            
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-2">
              {status === 'verifying' && 'Verifying Email...'}
              {status === 'success' && 'Email Verified!'}
              {status === 'error' && 'Verification Failed'}
              {status === 'info' && 'Email Verification'}
            </h1>
            
            <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-5 md:mb-6">
              {message}
            </p>

            {status === 'success' && userData && (
              <>
                <p className="text-xs sm:text-sm text-success mb-3 sm:mb-4">
                  Welcome, {userData.fullName || userData.email}! Verification complete.
                </p>
                {window.opener && (
                  <p className="text-xs text-muted-foreground mb-2">
                    This window will close automatically in a few seconds...
                  </p>
                )}
              </>
            )}

            {status === 'error' && (
              <div className="space-y-2 sm:space-y-3">
                <Button
                  variant="default"
                  onClick={() => navigate('/login')}
                  className="w-full text-sm sm:text-base"
                >
                  Go to Login
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate('/register')}
                  className="w-full text-sm sm:text-base"
                >
                  Register Again
                </Button>
              </div>
            )}

            {status === 'info' && (
              <div className="space-y-2 sm:space-y-3">
                <Button
                  variant="default"
                  onClick={() => navigate('/register')}
                  className="w-full text-sm sm:text-base"
                >
                  Return to Registration
                </Button>
              </div>
            )}

            {status === 'verifying' && (
              <div className="flex items-center justify-center space-x-2 text-xs sm:text-sm text-muted-foreground">
                <LoadingIndicator size={14} tone="primary" />
                <span>Processing verification...</span>
              </div>
            )}
          </div>
        </div>

        {status === 'success' && (
          <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-success/10 border border-success/20 rounded-lg">
            <p className="text-xs sm:text-sm text-success text-center">
              Your account is now fully activated. You can now log in and use all features.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default VerifyEmail;
