import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';

const FullscreenLoader = ({ message = 'Checking your session...' }) => (
  <div className="min-h-screen flex items-center justify-center bg-background p-6">
    <div className="text-center space-y-3">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  </div>
);

const ProtectedRoute = ({ children, roles = [] }) => {
  const location = useLocation();
  const { status, user } = useAuth();

  if (status === 'loading') {
    return <FullscreenLoader />;
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
      const fallback =
        normalizedRole === 'COMPANY'
          ? '/company-dashboard'
          : '/candidate-dashboard';
      return <Navigate to={fallback} replace />;
    }
  }

  return children;
};

export default ProtectedRoute;

