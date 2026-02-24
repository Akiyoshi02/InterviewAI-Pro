import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CandidateDashboard from '../index.jsx';
import apiClient from '../../../services/apiClient.js';

const mockNavigate = vi.fn();
const mockUseAuth = vi.fn();
const mockUseMaintenanceMode = vi.fn();
const mockUseInterviewRealtimeFeed = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../../contexts/AuthContext.jsx', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../../../hooks/useMaintenanceMode', () => ({
  useMaintenanceMode: () => mockUseMaintenanceMode(),
}));

vi.mock('../../../hooks/useInterviewRealtimeFeed', () => ({
  useInterviewRealtimeFeed: (args) => mockUseInterviewRealtimeFeed(args),
}));

vi.mock('../../../services/apiClient.js', () => ({
  default: {
    interviews: {
      getMyInterviews: vi.fn(),
    },
    analytics: {
      getDashboard: vi.fn(),
      getCandidateDashboardMetrics: vi.fn(),
    },
    applications: {
      getMyApplications: vi.fn(),
    },
  },
}));

vi.mock('../../../components/ui/Header.jsx', () => ({
  default: () => <div data-testid="header" />,
}));

vi.mock('../../../components/ui/UserContextNavigation.jsx', () => ({
  default: () => <div data-testid="user-context-navigation" />,
}));

vi.mock('../../../components/ui/DashboardQuickActions.jsx', () => ({
  default: () => <div data-testid="dashboard-quick-actions" />,
}));

vi.mock('../../../pages/candidate-dashboard/components/ProgressOverviewCard.jsx', () => ({
  default: () => <div data-testid="progress-overview-card" />,
}));

vi.mock('../../../pages/candidate-dashboard/components/RecentActivityFeed.jsx', () => ({
  default: () => <div data-testid="recent-activity-feed" />,
}));

vi.mock('../../../pages/candidate-dashboard/components/RecommendedTopics.jsx', () => ({
  default: () => <div data-testid="recommended-topics" />,
}));

vi.mock('../../../pages/candidate-dashboard/components/AchievementBadges.jsx', () => ({
  default: () => <div data-testid="achievement-badges" />,
}));

vi.mock('../../../pages/candidate-dashboard/components/QuickStartPanel.jsx', () => ({
  default: ({ onStartPractice }) => (
    <button
      type="button"
      onClick={() => onStartPractice?.({ role: 'backend-developer', difficulty: 'advanced' })}
    >
      Trigger Quick Start
    </button>
  ),
}));

vi.mock('../../../pages/candidate-dashboard/components/SchedulingWidget.jsx', () => ({
  default: ({ onScheduleSaved }) => (
    <button type="button" onClick={() => onScheduleSaved?.()}>
      Trigger Schedule Save
    </button>
  ),
}));

vi.mock('../../../components/ui/MaintenanceBanner.jsx', () => ({
  default: () => <div data-testid="maintenance-banner" />,
}));

vi.mock('../../../components/AppIcon.jsx', () => ({
  default: () => <span data-testid="mock-icon" />,
}));

vi.mock('../../../components/ui/Button.jsx', () => ({
  default: ({ children, onClick, type = 'button' }) => (
    <button type={type} onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock('../../../components/ui/LoadingState.jsx', () => ({
  default: ({ title }) => <div>{title}</div>,
}));

describe('CandidateDashboard flow', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockUseInterviewRealtimeFeed.mockReset();

    localStorage.clear();

    mockUseAuth.mockReturnValue({
      status: 'authenticated',
      user: {
        id: 'candidate_1',
        accountType: 'CANDIDATE',
        fullName: 'Jane Candidate',
        email: 'jane@example.com',
      },
      logout: vi.fn(),
    });

    mockUseMaintenanceMode.mockReturnValue({ maintenanceMode: false });

    apiClient.interviews.getMyInterviews.mockReset();
    apiClient.analytics.getDashboard.mockReset();
    apiClient.analytics.getCandidateDashboardMetrics.mockReset();
    apiClient.applications.getMyApplications.mockReset();

    apiClient.interviews.getMyInterviews.mockResolvedValue({
      success: true,
      interviews: [
        {
          id: 'interview_1',
          status: 'SCHEDULED',
          company: 'Acme Corp',
          jobRole: 'Backend Engineer',
          scheduledFor: '2026-03-12T11:30:00.000Z',
        },
      ],
    });
    apiClient.analytics.getDashboard.mockResolvedValue({
      success: true,
      stats: { averageScore: 74 },
    });
    apiClient.analytics.getCandidateDashboardMetrics.mockResolvedValue({
      success: true,
      metrics: {
        averageScore: { value: 76 },
        completedInterviews: { value: 4 },
        scheduledInterviews: { value: 1 },
      },
    });
    apiClient.applications.getMyApplications.mockResolvedValue({
      success: true,
      applications: [],
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const renderDashboard = () =>
    render(
      <MemoryRouter>
        <CandidateDashboard />
      </MemoryRouter>,
    );

  it('loads dashboard data, wires realtime lifecycle events, and navigates to my applications', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(apiClient.interviews.getMyInterviews).toHaveBeenCalledTimes(1);
      expect(apiClient.analytics.getDashboard).toHaveBeenCalledTimes(1);
      expect(apiClient.analytics.getCandidateDashboardMetrics).toHaveBeenCalledTimes(1);
      expect(apiClient.applications.getMyApplications).toHaveBeenCalledTimes(1);
    });

    expect(mockUseInterviewRealtimeFeed).toHaveBeenCalledWith(
      expect.objectContaining({
        eventTypes: expect.arrayContaining([
          'interview-created',
          'interview-scheduled',
          'interview-rescheduled',
        ]),
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'View All' }));
    expect(mockNavigate).toHaveBeenCalledWith('/my-applications');
  });

  it('quick start callback stores setup defaults and navigates to practice setup', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(apiClient.interviews.getMyInterviews).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Trigger Quick Start' }));

    expect(mockNavigate).toHaveBeenCalledWith('/practice-interview-setup');
    const draft = JSON.parse(localStorage.getItem('interviewSetupDraft') || '{}');
    expect(draft.jobRole).toBe('backend-developer');
    expect(draft.advancedSettings?.difficulty).toBe('hard');
  });

  it('scheduling callback refreshes dashboard data without hard reload', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(apiClient.interviews.getMyInterviews).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Trigger Schedule Save' }));

    await waitFor(() => {
      expect(apiClient.interviews.getMyInterviews).toHaveBeenCalledTimes(2);
      expect(apiClient.analytics.getDashboard).toHaveBeenCalledTimes(2);
      expect(apiClient.analytics.getCandidateDashboardMetrics).toHaveBeenCalledTimes(2);
      expect(apiClient.applications.getMyApplications).toHaveBeenCalledTimes(2);
    });
  });
});
