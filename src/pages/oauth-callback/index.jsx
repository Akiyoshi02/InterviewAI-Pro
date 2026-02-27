import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '../../config/firebase.js';
import LoadingState from '../../components/ui/LoadingState';
import Icon from '../../components/AppIcon';
import apiClient from '../../services/apiClient.js';

/**
 * OAuth callback page – receives a Firebase custom token from the backend
 * after LinkedIn / GitHub OAuth, signs in, then redirects the user.
 */
const OAuthCallbackPage = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = searchParams.get('token');
    const authCode = searchParams.get('code');
    const state = searchParams.get('state');
    const pathParts = location.pathname.split('/').filter(Boolean);
    const providerFromPath = (
      pathParts.length === 3
      && pathParts[0] === 'oauth'
      && pathParts[2] === 'callback'
      && ['linkedin', 'github'].includes(pathParts[1])
    ) ? pathParts[1] : null;
    const provider = searchParams.get('provider') || providerFromPath || 'oauth';

    // Fallback flow:
    // If provider returned to frontend with ?code=..., forward that code to backend callback
    // so backend can exchange token and redirect back with a Firebase custom token.
    if (!token && providerFromPath && authCode) {
      const expectedState = sessionStorage.getItem(`oauth_state_${providerFromPath}`);
      if (expectedState && state && expectedState !== state) {
        setError('OAuth state validation failed. Please try again.');
        return;
      }
      sessionStorage.removeItem(`oauth_state_${providerFromPath}`);

      const apiBase = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');
      const callbackParams = new URLSearchParams(searchParams.toString());
      const callbackUrl = `${apiBase}/api/oauth/${providerFromPath}/callback?${callbackParams.toString()}`;
      window.location.replace(callbackUrl);
      return;
    }

    if (!token) {
      setError('No token received from provider. Please try again.');
      return;
    }

    (async () => {
      try {
        if (provider === 'linkedin' || provider === 'github') {
          sessionStorage.removeItem(`oauth_state_${provider}`);
        }

        // Sign in to Firebase with the custom token issued by our backend
        const { user: firebaseUser } = await signInWithCustomToken(auth, token);
        const idToken = await firebaseUser.getIdToken();
        localStorage.setItem('authToken', idToken);

        // Fetch profile to determine account type and redirect
        const profileRes = await apiClient.auth.getMe();

        if (profileRes?.success && profileRes?.user) {
          const accountType = profileRes.user.accountType?.toLowerCase();
          if (accountType === 'company') {
            navigate('/company-dashboard', { replace: true });
          } else {
            navigate('/candidate-dashboard', { replace: true });
          }
        } else {
          // New user – send to profile completion / register
          navigate(`/register?oauth=1&provider=${provider}`, { replace: true });
        }
      } catch (err) {
        setError(err?.message || 'Authentication failed. Please try again.');
      }
    })();
  }, [searchParams, navigate, location.pathname]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 p-6">
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-red-200 dark:border-red-800 p-8 max-w-md w-full shadow-lg text-center space-y-4">
          <Icon name="AlertTriangle" size={40} className="text-red-500 mx-auto" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Authentication Error</h2>
          <p className="text-sm text-gray-600 dark:text-slate-400">{error}</p>
          <button
            onClick={() => navigate('/login', { replace: true })}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Back to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <LoadingState
      title="Signing you in…"
      message="Please wait while we complete your login."
      variant="fullscreen"
      tone="primary"
    />
  );
};

export default OAuthCallbackPage;
