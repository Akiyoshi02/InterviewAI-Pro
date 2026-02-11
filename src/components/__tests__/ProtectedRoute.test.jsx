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
});
