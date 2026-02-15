import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import ProtectedRoute from '../ProtectedRoute.jsx';

const mockUseAuth = vi.fn();

vi.mock('../../contexts/AuthContext.jsx', () => ({
  useAuth: () => mockUseAuth(),
}));

const LocationEcho = () => {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
};

const renderWithRoutes = (initialPath) =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/company-dashboard"
          element={(
            <ProtectedRoute roles={['COMPANY']}>
              <div>Company Dashboard</div>
              <LocationEcho />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/candidate-dashboard"
          element={(
            <>
              <div>Candidate Dashboard</div>
              <LocationEcho />
            </>
          )}
        />
        <Route
          path="/company-jobs"
          element={(
            <ProtectedRoute roles={['COMPANY']} requiredOrgPermissions={['ACCESS_JOBS_PAGE']}>
              <div>Company Jobs</div>
              <LocationEcho />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/company-analytics"
          element={(
            <ProtectedRoute roles={['COMPANY']} requiredOrgPermissions={['ACCESS_ANALYTICS_PAGE']}>
              <div>Company Analytics</div>
              <LocationEcho />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/jobs"
          element={(
            <ProtectedRoute roles={['CANDIDATE']}>
              <div>Candidate Jobs</div>
              <LocationEcho />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/register"
          element={(
            <>
              <div>Register Screen</div>
              <LocationEcho />
            </>
          )}
        />
        <Route
          path="/login"
          element={(
            <>
              <div>Login Screen</div>
              <LocationEcho />
            </>
          )}
        />
      </Routes>
    </MemoryRouter>,
  );

describe('ProtectedRoute organization lock behavior', () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('redirects pending company users away from /company-* routes to pending approval step', () => {
    mockUseAuth.mockReturnValue({
      status: 'authenticated',
      user: {
        accountType: 'COMPANY',
        organizationContext: {
          organization: {
            id: 'org_test_1',
            status: 'PENDING',
          },
        },
      },
    });

    renderWithRoutes('/company-dashboard');

    expect(screen.queryByText('Register Screen')).not.toBeNull();
    expect(screen.getByTestId('location').textContent).toBe('/register?pendingApproval=true&orgId=org_test_1');
  });

  it('redirects rejected company users away from /company-* routes to review status step', () => {
    mockUseAuth.mockReturnValue({
      status: 'authenticated',
      user: {
        accountType: 'COMPANY',
        organizationContext: {
          organization: {
            id: 'org_test_rejected',
            status: 'REJECTED',
          },
        },
      },
    });

    renderWithRoutes('/company-dashboard');

    expect(screen.queryByText('Register Screen')).not.toBeNull();
    expect(screen.getByTestId('location').textContent).toBe('/register?pendingApproval=true&orgId=org_test_rejected');
  });

  it('redirects suspended company users away from /company-* routes to status step', () => {
    mockUseAuth.mockReturnValue({
      status: 'authenticated',
      user: {
        accountType: 'COMPANY',
        organizationContext: {
          organization: {
            id: 'org_test_suspended',
            status: 'SUSPENDED',
          },
        },
      },
    });

    renderWithRoutes('/company-dashboard');

    expect(screen.queryByText('Register Screen')).not.toBeNull();
    expect(screen.getByTestId('location').textContent).toBe('/register?pendingApproval=true&orgId=org_test_suspended');
  });

  it('allows approved company users to access company routes', () => {
    mockUseAuth.mockReturnValue({
      status: 'authenticated',
      user: {
        accountType: 'COMPANY',
        organizationContext: {
          organization: {
            id: 'org_test_2',
            status: 'APPROVED',
          },
        },
      },
    });

    renderWithRoutes('/company-dashboard');

    expect(screen.queryByText('Company Dashboard')).not.toBeNull();
    expect(screen.getByTestId('location').textContent).toBe('/company-dashboard');
  });

  it('redirects role-mismatched users to their own dashboard', () => {
    mockUseAuth.mockReturnValue({
      status: 'authenticated',
      user: {
        accountType: 'CANDIDATE',
      },
    });

    renderWithRoutes('/company-dashboard');

    expect(screen.queryByText('Candidate Dashboard')).not.toBeNull();
    expect(screen.getByTestId('location').textContent).toBe('/candidate-dashboard');
  });

  it('redirects unauthenticated users to login', () => {
    mockUseAuth.mockReturnValue({
      status: 'unauthenticated',
      user: null,
    });

    renderWithRoutes('/company-dashboard');

    expect(screen.queryByText('Login Screen')).not.toBeNull();
    expect(screen.getByTestId('location').textContent).toBe('/login');
  });

  it('blocks reviewer role from company jobs direct URL access', () => {
    mockUseAuth.mockReturnValue({
      status: 'authenticated',
      user: {
        accountType: 'COMPANY',
        organizationContext: {
          organization: {
            id: 'org_test_analytics',
            status: 'APPROVED',
          },
          membership: {
            role: 'REVIEWER',
          },
        },
      },
    });

    renderWithRoutes('/company-jobs');

    expect(screen.queryByText('Company Dashboard')).not.toBeNull();
    expect(screen.getByTestId('location').textContent).toBe('/company-dashboard');
  });

  it('allows recruiter role to access company jobs direct URL', () => {
    mockUseAuth.mockReturnValue({
      status: 'authenticated',
      user: {
        accountType: 'COMPANY',
        organizationContext: {
          organization: {
            id: 'org_test_jobs',
            status: 'APPROVED',
          },
          membership: {
            role: 'RECRUITER',
          },
        },
      },
    });

    renderWithRoutes('/company-jobs');

    expect(screen.queryByText('Company Jobs')).not.toBeNull();
    expect(screen.getByTestId('location').textContent).toBe('/company-jobs');
  });

  it('blocks reviewer role from company analytics direct URL access', () => {
    mockUseAuth.mockReturnValue({
      status: 'authenticated',
      user: {
        accountType: 'COMPANY',
        organizationContext: {
          organization: {
            id: 'org_test_analytics',
            status: 'APPROVED',
          },
          membership: {
            role: 'REVIEWER',
          },
        },
      },
    });

    renderWithRoutes('/company-analytics');

    expect(screen.queryByText('Company Dashboard')).not.toBeNull();
    expect(screen.getByTestId('location').textContent).toBe('/company-dashboard');
  });

  it('blocks company accounts from candidate jobs route', () => {
    mockUseAuth.mockReturnValue({
      status: 'authenticated',
      user: {
        accountType: 'COMPANY',
        organizationContext: {
          organization: {
            id: 'org_test_company',
            status: 'APPROVED',
          },
          membership: {
            role: 'ADMIN',
          },
        },
      },
    });

    renderWithRoutes('/jobs');

    expect(screen.queryByText('Company Dashboard')).not.toBeNull();
    expect(screen.getByTestId('location').textContent).toBe('/company-dashboard');
  });
});
