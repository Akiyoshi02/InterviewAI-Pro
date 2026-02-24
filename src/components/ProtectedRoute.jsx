import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import LoadingState from './ui/LoadingState';
import {
  buildPendingApprovalRoute,
  isRestrictedCompanyUser,
} from '../utils/organizationAccess.js';
import { hasPermission } from '../utils/rolePermissions.js';

const ProtectedRoute = ({ children, roles = [], requiredOrgPermissions = [] }) => {
  const location = useLocation();
  const { status, user } = useAuth();
  const currentPath = `${location.pathname}${location.search || ''}`;

  if (status === 'loading') {
    return (
      <LoadingState
        title="Checking your session and syncing your data"
        message="Verifying secure access and preparing your workspace."
        variant="fullscreen"
        tone="primary"
      />
    );
  }

  if (status === 'unauthenticated' || !user) {
    return <Navigate to="/login" replace state={{ from: currentPath }} />;
  }

  const isCompanyRoute = location.pathname.startsWith('/company-');
  if (isCompanyRoute && isRestrictedCompanyUser(user)) {
    return <Navigate to={buildPendingApprovalRoute(user)} replace state={{ from: currentPath }} />;
  }

  const normalizedRole = (user.accountType || user.account_type || '').toString().toUpperCase();

  if (roles.length > 0) {
    const isAllowed = roles.some(
      (role) => role.toUpperCase() === normalizedRole,
    );

    if (!isAllowed) {
      // Determine fallback based on account type
      let fallback = '/';
      if (normalizedRole === 'COMPANY') {
        fallback = isRestrictedCompanyUser(user)
          ? buildPendingApprovalRoute(user)
          : '/company-dashboard';
      } else if (normalizedRole === 'CANDIDATE') {
        fallback = '/candidate-dashboard';
      } else if (normalizedRole === 'SYSTEM_ADMIN') {
        fallback = '/system-admin-dashboard';
      }
      return <Navigate to={fallback} replace />;
    }
  }

  if (requiredOrgPermissions.length > 0) {
    // Organization permissions only apply to company users.
    if (normalizedRole !== 'COMPANY') {
      if (normalizedRole === 'CANDIDATE') {
        return <Navigate to="/candidate-dashboard" replace state={{ from: currentPath }} />;
      }
      if (normalizedRole === 'SYSTEM_ADMIN') {
        return <Navigate to="/system-admin-dashboard" replace state={{ from: currentPath }} />;
      }
      return <Navigate to="/" replace state={{ from: currentPath }} />;
    }

    const organizationRole = (user.organizationContext?.membership?.role || '').toString().toUpperCase();
    const hasRequiredPermission = requiredOrgPermissions.some((permission) =>
      hasPermission(organizationRole, permission),
    );

    if (!hasRequiredPermission) {
      const fallback = isRestrictedCompanyUser(user)
        ? buildPendingApprovalRoute(user)
        : '/company-dashboard';
      return <Navigate to={fallback} replace state={{ from: currentPath }} />;
    }
  }

  return children;
};

export default ProtectedRoute;

