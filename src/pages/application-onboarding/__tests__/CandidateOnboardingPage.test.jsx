import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CandidateOnboardingPage from '../index.jsx';

const mockUseAuth = vi.fn();
const mockUseMaintenanceMode = vi.fn();

vi.mock('framer-motion', () => ({
  motion: { section: ({ children, ...props }) => <section {...props}>{children}</section> },
}));

vi.mock('../../../contexts/AuthContext.jsx', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../../../hooks/useMaintenanceMode', () => ({
  useMaintenanceMode: () => mockUseMaintenanceMode(),
}));

vi.mock('../../../components/ui/Header', () => ({ default: () => <div>Header</div> }));
vi.mock('../../../components/ui/UserContextNavigation', () => ({ default: () => <div>Nav</div> }));
vi.mock('../../../components/ui/Button', () => ({
  default: ({ children, onClick, disabled, loading, ...props }) => (
    <button type="button" onClick={onClick} disabled={disabled || loading} {...props}>
      {children}
    </button>
  ),
}));
vi.mock('../../../components/ui/LoadingState', () => ({ default: ({ title }) => <div>{title}</div> }));
vi.mock('../../../components/ui/MaintenanceBanner', () => ({ default: () => null }));
vi.mock('../../../components/AppIcon', () => ({ default: ({ name }) => <span>{name}</span> }));

vi.mock('../../../services/apiClient.js', () => ({
  default: {
    applications: {
      getApplication: vi.fn(),
      respondToOnboardingTask: vi.fn(),
    },
  },
}));

import apiClient from '../../../services/apiClient.js';

const application = {
  id: 'app-1',
  status: 'HIRED',
  job: { title: 'Data Analyst' },
  offer: { title: 'Data Analyst Offer', startDate: '2026-04-01T00:00:00.000Z' },
  onboarding: {
    status: 'IN_PROGRESS',
    startDate: '2026-04-01T00:00:00.000Z',
    welcomeNote: 'Welcome to Cynectex.',
    progress: { totalTasks: 5, completedTasks: 1, requiredTasks: 5, percentComplete: 20 },
    tasks: [
      {
        id: 'candidate-share-documents',
        title: 'Share onboarding documents',
        description: 'Submit payroll details to the hiring team.',
        owner: 'CANDIDATE',
        type: 'DOCUMENT',
        status: 'PENDING',
        dueAt: '2026-03-28T00:00:00.000Z',
      },
    ],
    history: [],
  },
};

describe('CandidateOnboardingPage', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: { id: 'candidate-1' },
      logout: vi.fn(),
      status: 'authenticated',
    });
    mockUseMaintenanceMode.mockReturnValue({ maintenanceMode: false });
    apiClient.applications.getApplication.mockResolvedValue({ success: true, application });
    apiClient.applications.respondToOnboardingTask.mockResolvedValue({
      success: true,
      message: 'Task submitted for hiring team review.',
      application: {
        ...application,
        onboarding: {
          ...application.onboarding,
          tasks: [{ ...application.onboarding.tasks[0], status: 'SUBMITTED', candidateNote: 'Shared with HR.' }],
        },
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('loads onboarding and lets the candidate submit a task', async () => {
    render(
      <MemoryRouter initialEntries={['/my-applications/app-1/onboarding']}>
        <Routes>
          <Route path="/my-applications/:id/onboarding" element={<CandidateOnboardingPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByText(/employee onboarding/i);
    fireEvent.change(screen.getByPlaceholderText(/add context for the hiring team/i), {
      target: { value: 'Shared with HR.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /submit for review/i }));

    await waitFor(() => {
      expect(apiClient.applications.respondToOnboardingTask).toHaveBeenCalledWith(
        'app-1',
        'candidate-share-documents',
        { note: 'Shared with HR.' },
      );
      expect(screen.getByText(/task submitted for hiring team review/i)).toBeTruthy();
    });
  });
});
