import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import LoadingState from './ui/LoadingState';

const ProtectedRoute = ({ children, roles = [] }) => {
  const location = useLocation();
  const { status, user } = useAuth();

  if (status === 'loading') {
    return (
      <LoadingState
        title="Checking your session"
        message="Verifying your secure access before continuing."
        variant="fullscreen"
        tone="primary"
      />
    );
  }

  if (status === 'unauthenticated' || !user) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search || ''}` }} />;
  }

  if (roles.length > 0) {
    const normalizedRole = user.accountType?.toUpperCase();
    const isAllowed = roles.some(
      (role) => role.toUpperCase() === normalizedRole,
    );

    if (!isAllowed) {
      // Determine fallback based on account type
      let fallback = '/';
      if (normalizedRole === 'COMPANY') {
        fallback = '/company-dashboard';
      } else if (normalizedRole === 'CANDIDATE') {
        fallback = '/candidate-dashboard';
      } else if (normalizedRole === 'SYSTEM_ADMIN') {
        fallback = '/system-admin-dashboard';
      }
      return <Navigate to={fallback} replace />;
    }
  }

  return children;
};

export default ProtectedRoute;

