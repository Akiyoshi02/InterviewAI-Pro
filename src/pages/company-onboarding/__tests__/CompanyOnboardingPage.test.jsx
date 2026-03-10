import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CompanyOnboardingPage from '../index.jsx';

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
      updateOnboarding: vi.fn(),
      reviewOnboardingTask: vi.fn(),
    },
  },
}));

import apiClient from '../../../services/apiClient.js';

const application = {
  id: 'app-1',
  status: 'HIRED',
  candidate: { fullName: 'Candidate One', email: 'candidate@example.com' },
  job: { title: 'Data Analyst' },
  onboarding: {
    status: 'IN_PROGRESS',
    startDate: '2026-04-01T00:00:00.000Z',
    welcomeNote: 'Welcome to Cynectex.',
    progress: { totalTasks: 5, completedTasks: 2, requiredTasks: 5, percentComplete: 40 },
    tasks: [
      {
        id: 'candidate-confirm-details',
        title: 'Confirm personal details',
        owner: 'CANDIDATE',
        type: 'ACKNOWLEDGEMENT',
        status: 'COMPLETED',
      },
      {
        id: 'candidate-share-documents',
        title: 'Share onboarding documents',
        owner: 'CANDIDATE',
        type: 'DOCUMENT',
        status: 'SUBMITTED',
        candidateNote: 'Submitted payroll details.',
      },
      {
        id: 'team-prepare-access',
        title: 'Prepare account access and equipment',
        owner: 'TEAM',
        type: 'ACTION',
        status: 'PENDING',
      },
    ],
    history: [],
  },
};

describe('CompanyOnboardingPage', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'recruiter-1',
        organizationContext: { membership: { role: 'RECRUITER' } },
      },
      logout: vi.fn(),
      status: 'authenticated',
    });
    mockUseMaintenanceMode.mockReturnValue({ maintenanceMode: false });
    apiClient.applications.getApplication.mockResolvedValue({ success: true, application });
    apiClient.applications.updateOnboarding.mockResolvedValue({
      success: true,
      message: 'Onboarding details updated successfully.',
      application,
    });
    apiClient.applications.reviewOnboardingTask.mockResolvedValue({
      success: true,
      message: 'Onboarding task updated successfully.',
      application: {
        ...application,
        onboarding: {
          ...application.onboarding,
          tasks: application.onboarding.tasks.map((task) => (
            task.id === 'candidate-share-documents'
              ? { ...task, status: 'APPROVED', reviewerNote: 'Verified and approved.' }
              : task
          )),
        },
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('lets the recruiter save onboarding overview and approve a submitted task', async () => {
    render(
      <MemoryRouter initialEntries={['/company-applications/app-1/onboarding']}>
        <Routes>
          <Route path="/company-applications/:id/onboarding" element={<CompanyOnboardingPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByText(/onboarding workspace/i);

    fireEvent.change(screen.getByLabelText(/welcome note/i), {
      target: { value: 'Updated welcome note.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save overview/i }));

    await waitFor(() => {
      expect(apiClient.applications.updateOnboarding).toHaveBeenCalledWith('app-1', expect.objectContaining({
        welcomeNote: 'Updated welcome note.',
      }));
    });

    fireEvent.change(screen.getByPlaceholderText(/optional note for the candidate/i), {
      target: { value: 'Verified and approved.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /approve/i }));

    await waitFor(() => {
      expect(apiClient.applications.reviewOnboardingTask).toHaveBeenCalledWith(
        'app-1',
        'candidate-share-documents',
        { status: 'APPROVED', note: 'Verified and approved.' },
      );
    });
  });

  it('does not show review actions for candidate acknowledgement tasks that are already complete', async () => {
    render(
      <MemoryRouter initialEntries={['/company-applications/app-1/onboarding']}>
        <Routes>
          <Route path="/company-applications/:id/onboarding" element={<CompanyOnboardingPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByText(/confirm personal details/i);

    const acknowledgementCard = screen.getByText(/confirm personal details/i).closest('div.rounded-2xl');
    expect(acknowledgementCard).toBeTruthy();
    expect(within(acknowledgementCard).queryByRole('button', { name: /approve/i })).toBeNull();
    expect(within(acknowledgementCard).queryByRole('button', { name: /request update/i })).toBeNull();
    expect(within(acknowledgementCard).getByText(/no recruiter review is required/i)).toBeTruthy();
  });
});
