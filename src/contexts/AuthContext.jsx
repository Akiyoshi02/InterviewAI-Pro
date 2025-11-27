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

const AUTH_STORAGE_KEYS = [
  'user',
  'isAuthenticated',
  'socialAuthVerified',
  'socialAuthData',
  'socialAuthIntent',
  'socialAuthProvider',
  'pendingRegistration',
  'pendingAccountType',
];

const clearAuthStorage = () => {
  if (typeof window === 'undefined') return;
  AUTH_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
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

      const profile = await apiClient.auth.getMe();
      if (!profile.success || !profile.user) {
        throw new Error('User not found');
      }

      applyAuthenticatedUser(profile.user);
      return profile.user;
    } catch (err) {
      console.error('Auth sync error:', err);
      clearAuthStorage();
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
      clearAuthStorage();
      setUser(null);
      setStatus('unauthenticated');
    }
  }, []);

  useEffect(() => {
    syncUser();
  }, [syncUser]);

  useEffect(() => {
    if (typeof authHelpers.onAuthStateChange !== 'function') {
      return undefined;
    }

    const unsubscribe = authHelpers.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_IN') {
        await syncUser();
        return;
      }

      if (event === 'SIGNED_OUT') {
        clearAuthStorage();
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

