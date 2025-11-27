import React from 'react';
import { describe, expect, it } from 'vitest';
import matchers from '@testing-library/jest-dom/matchers';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import ProtectedRoute from '../components/ProtectedRoute.jsx';
import { AuthContext } from '../contexts/AuthContext.jsx';

expect.extend(matchers);

const renderWithAuth = (authValue) => {
  return render(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route
            path="/protected"
            element={(
              <ProtectedRoute roles={['CANDIDATE']}>
                <div>Candidate Content</div>
              </ProtectedRoute>
            )}
          />
          <Route path="/login" element={<div>Login Page</div>} />
          <Route path="/candidate-dashboard" element={<div>Candidate Dashboard</div>} />
          <Route path="/company-dashboard" element={<div>Company Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
};

describe('ProtectedRoute', () => {
  it('renders children when user is authenticated and authorized', () => {
    renderWithAuth({
      status: 'authenticated',
      user: { accountType: 'CANDIDATE' },
    });

    expect(screen.getByText('Candidate Content')).toBeInTheDocument();
  });

  it('redirects unauthenticated users to login', () => {
    renderWithAuth({
      status: 'unauthenticated',
      user: null,
    });

    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('redirects unauthorized roles to their default dashboard', () => {
    renderWithAuth({
      status: 'authenticated',
      user: { accountType: 'COMPANY' },
    });

    expect(screen.getByText('Company Dashboard')).toBeInTheDocument();
  });
});

