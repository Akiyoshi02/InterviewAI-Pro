import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { authHelpers } from '../config/firebase.js';
import apiClient from '../services/apiClient.js';

const AuthContext = createContext(null);

const AUTH_SESSION_STORAGE_KEYS = [
  'user',
  'isAuthenticated',
];

const AUTH_FLOW_STORAGE_KEYS = [
  'socialAuthVerified',
  'socialAuthData',
  'socialAuthIntent',
  'socialAuthProvider',
  'pendingRegistration',
  'pendingAccountType',
];

const clearSessionStorage = () => {
  if (typeof window === 'undefined') return;
  AUTH_SESSION_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
};

const clearAllAuthStorage = () => {
  if (typeof window === 'undefined') return;
  [...AUTH_SESSION_STORAGE_KEYS, ...AUTH_FLOW_STORAGE_KEYS].forEach((key) =>
    window.localStorage.removeItem(key),
  );
};

const shouldDeferProfileSync = () => {
  if (typeof window === 'undefined') return false;
  const intent = window.localStorage.getItem('socialAuthIntent');
  const pendingRegistration = window.localStorage.getItem('pendingRegistration');
  const pendingAccountType = window.localStorage.getItem('pendingAccountType');
  if (intent !== 'register' && !pendingRegistration && !pendingAccountType) return false;
  const path = window.location.pathname || '';
  return path.startsWith('/register') || path.startsWith('/verify-email');
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | authenticated | unauthenticated
  const [error, setError] = useState(null);

  const applyAuthenticatedUser = useCallback((nextUser) => {
    if (!nextUser) return;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('user', JSON.stringify(nextUser));
      window.localStorage.setItem('isAuthenticated', 'true');
    }
    setUser(nextUser);
    setStatus('authenticated');
  }, []);

  const syncUser = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const { data } = await authHelpers.getSession();
      if (!data?.session) {
        throw new Error('No active session found');
      }

      if (shouldDeferProfileSync()) {
        setUser(null);
        setStatus('unauthenticated');
        return null;
      }

      const profile = await apiClient.auth.getMe();
      if (!profile.success || !profile.user) {
        throw new Error('User not found');
      }

      applyAuthenticatedUser(profile.user);
      return profile.user;
    } catch (err) {
      if (err?.message !== 'No active session found') {
        console.error('Auth sync error:', err);
      }
      clearSessionStorage();
      setUser(null);
      setStatus('unauthenticated');
      setError(err);
      return null;
    }
  }, [applyAuthenticatedUser]);

  const logout = useCallback(async () => {
    try {
      await authHelpers.signOut();
    } catch (err) {
      console.error('Failed to sign out:', err);
    } finally {
      clearAllAuthStorage();
      setUser(null);
      setStatus('unauthenticated');
    }
  }, []);

  useEffect(() => {
    if (typeof authHelpers.onAuthStateChange !== 'function') {
      // Fallback: immediately attempt to sync the user once
      syncUser();
      return undefined;
    }

    const unsubscribe = authHelpers.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_IN') {
        await syncUser();
        return;
      }

      if (event === 'SIGNED_OUT') {
        clearAllAuthStorage();
        setUser(null);
        setStatus('unauthenticated');
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [syncUser]);

  const value = useMemo(
    () => ({
      user,
      status,
      error,
      organizationContext: user?.organizationContext || null,
      organization: user?.organizationContext?.organization || null,
      organizationMembership: user?.organizationContext?.membership || null,
      organizationRole: user?.organizationContext?.membership?.role || null,
      isOrgAdmin: user?.organizationContext?.membership?.role === 'ADMIN',
      isAuthenticated: status === 'authenticated',
      loading: status === 'loading',
      refresh: syncUser,
      logout,
      setAuthenticatedUser: applyAuthenticatedUser,
    }),
    [user, status, error, syncUser, logout, applyAuthenticatedUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export { AuthContext };

