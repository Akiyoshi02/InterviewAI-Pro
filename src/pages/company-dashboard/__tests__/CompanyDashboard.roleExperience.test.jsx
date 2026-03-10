import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import CompanyDashboard from '../index.jsx';

const mockUseAuth = vi.fn();
const mockUseMaintenanceMode = vi.fn();
const mockUseInterviewRealtimeFeed = vi.fn();
const mockUseRealtimePathFeed = vi.fn();

vi.mock('framer-motion', () => {
  const MotionDiv = ({ children, ...props }) => <div {...props}>{children}</div>;
  return {
    motion: {
      div: MotionDiv,
      section: MotionDiv,
    },
  };
});

vi.mock('../../../contexts/AuthContext.jsx', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../../../hooks/useMaintenanceMode', () => ({
  useMaintenanceMode: () => mockUseMaintenanceMode(),
}));

vi.mock('../../../hooks/useInterviewRealtimeFeed', () => ({
  useInterviewRealtimeFeed: (...args) => mockUseInterviewRealtimeFeed(...args),
}));

vi.mock('../../../hooks/useRealtimePathFeed', () => ({
  useRealtimePathFeed: (...args) => mockUseRealtimePathFeed(...args),
}));

vi.mock('../../../services/apiClient.js', () => ({
  default: {
    interviews: {
      getCompanyInterviews: vi.fn(),
    },
    analytics: {
      getCompanyMetrics: vi.fn(),
      getDashboardMetrics: vi.fn(),
    },
    jobs: {
      getOrganizationJobs: vi.fn(),
    },
  },
}));

vi.mock('../../../components/ui/Header', () => ({
  default: () => <div>Header</div>,
}));

vi.mock('../../../components/ui/UserContextNavigation', () => ({
  default: () => <div>User Context Navigation</div>,
}));

vi.mock('../components/OverviewPanel', () => ({
  default: ({ roleVariant }) => <div>{`OverviewPanel ${roleVariant}`}</div>,
}));

vi.mock('../components/CandidatePipeline', () => ({
  default: () => <div>CandidatePipeline</div>,
}));

vi.mock('../components/CandidateTable', () => ({
  default: ({ canUpdateStatus, roleVariant, onViewRecording, onViewAnalysis }) => (
    <div>
      <div>{`CandidateTable ${roleVariant} ${canUpdateStatus ? 'editable' : 'readonly'}`}</div>
      <button type="button" onClick={() => onViewRecording?.('candidate-1')}>
        Trigger Recording
      </button>
      <button type="button" onClick={() => onViewAnalysis?.('candidate-1')}>
        Trigger Analysis
      </button>
    </div>
  ),
}));

vi.mock('../components/HiringMetrics', () => ({
  default: () => <div>HiringMetrics</div>,
}));

vi.mock('../components/QuickActions', () => ({
  default: ({ organizationRole }) => <div>{`QuickActions ${organizationRole}`}</div>,
}));

vi.mock('../components/ReviewerDashboardPanel', () => ({
  default: () => <div>ReviewerDashboardPanel</div>,
}));

vi.mock('../components/HiringInsightsBoard', () => ({
  default: () => <div>HiringInsightsBoard</div>,
}));

vi.mock('../components/HiringFocusPanel', () => ({
  default: () => <div>HiringFocusPanel</div>,
}));

vi.mock('../components/InterviewReviewEnhanced', () => ({
  default: ({ initialActiveTab }) => <div>{`InterviewReviewEnhanced ${initialActiveTab}`}</div>,
}));

vi.mock('../components/PendingApprovalBanner', () => ({
  default: () => <div>PendingApprovalBanner</div>,
}));

vi.mock('../../../components/ui/MaintenanceBanner', () => ({
  default: () => <div>MaintenanceBanner</div>,
}));

vi.mock('../../../components/AppIcon', () => ({
  default: () => <span data-testid="mock-icon" />,
}));

vi.mock('../../../components/ui/Button', () => ({
  default: ({ children, ...props }) => <button {...props}>{children}</button>,
}));

vi.mock('../../../components/ui/LoadingState', () => ({
  default: ({ title }) => <div>{title}</div>,
}));

import apiClient from '../../../services/apiClient.js';

const buildCompanyUser = (role) => ({
  id: `${role.toLowerCase()}-user`,
  fullName: role === 'REVIEWER' ? 'Reviewer UI Test' : 'Recruiter UI Test',
  email: role === 'REVIEWER' ? 'reviewer@example.com' : 'recruiter@example.com',
  accountType: 'COMPANY',
  organizationContext: {
    organization: {
      id: 'org-123',
      name: 'Cynectex',
      status: 'APPROVED',
    },
    membership: {
      role,
    },
  },
});

const renderPage = (initialEntries = ['/company-dashboard']) =>
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <CompanyDashboard />
      <LocationProbe />
    </MemoryRouter>,
  );

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location-probe">{`${location.pathname}${location.search}`}</div>;
};

describe('CompanyDashboard role experience', () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    mockUseMaintenanceMode.mockReset();
    mockUseInterviewRealtimeFeed.mockReset();
    mockUseRealtimePathFeed.mockReset();

    apiClient.interviews.getCompanyInterviews.mockReset();
    apiClient.analytics.getCompanyMetrics.mockReset();
    apiClient.analytics.getDashboardMetrics.mockReset();
    apiClient.jobs.getOrganizationJobs.mockReset();

    mockUseMaintenanceMode.mockReturnValue({ maintenanceMode: false });
    mockUseAuth.mockReturnValue({
      status: 'authenticated',
      user: buildCompanyUser('RECRUITER'),
      logout: vi.fn(),
    });

    apiClient.interviews.getCompanyInterviews.mockResolvedValue({
      success: true,
      interviews: [
        {
          id: 'int-1',
          candidateId: 'candidate-1',
          candidate: { id: 'candidate-1', fullName: 'Assigned Candidate' },
          status: 'SCHEDULED',
          scheduledFor: '2026-03-09T09:00:00.000Z',
        },
      ],
    });
    apiClient.analytics.getCompanyMetrics.mockResolvedValue({
      success: true,
      metrics: {},
    });
    apiClient.analytics.getDashboardMetrics.mockResolvedValue({
      success: true,
      metrics: {},
    });
    apiClient.jobs.getOrganizationJobs.mockResolvedValue({
      success: true,
      jobs: [{ id: 'job-1', status: 'PUBLISHED' }],
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders the reviewer workspace variant without recruiter-only panels', async () => {
    mockUseAuth.mockReturnValue({
      status: 'authenticated',
      user: buildCompanyUser('REVIEWER'),
      logout: vi.fn(),
    });

    renderPage();

    await waitFor(() => {
      expect(screen.queryByText('Checking your session and syncing your company data')).toBeNull();
    });

    expect(screen.getByText('Structured review workspace')).toBeTruthy();
    expect(screen.getByText('Welcome back, Reviewer')).toBeTruthy();
    expect(screen.getByText('OverviewPanel reviewer')).toBeTruthy();
    expect(screen.getByText('QuickActions REVIEWER')).toBeTruthy();
    expect(screen.getByText('CandidateTable reviewer readonly')).toBeTruthy();
    expect(screen.getByText('ReviewerDashboardPanel')).toBeTruthy();

    expect(screen.queryByText('HiringMetrics')).toBeNull();
    expect(screen.queryByText('HiringInsightsBoard')).toBeNull();
    expect(screen.queryByText('HiringFocusPanel')).toBeNull();
    expect(screen.queryByText('CandidatePipeline')).toBeNull();

    expect(apiClient.analytics.getCompanyMetrics).not.toHaveBeenCalled();
    expect(apiClient.analytics.getDashboardMetrics).not.toHaveBeenCalled();
    expect(apiClient.jobs.getOrganizationJobs).not.toHaveBeenCalled();
  });

  it('renders the recruiter workspace variant with recruiter panels enabled', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.queryByText('Checking your session and syncing your company data')).toBeNull();
    });

    expect(screen.getByText('AI-powered hiring control center')).toBeTruthy();
    expect(screen.getByText('Welcome back, Recruiter')).toBeTruthy();
    expect(screen.getByText('OverviewPanel company')).toBeTruthy();
    expect(screen.getByText('QuickActions RECRUITER')).toBeTruthy();
    expect(screen.getByText('CandidateTable company editable')).toBeTruthy();
    expect(screen.getByText('HiringMetrics')).toBeTruthy();
    expect(screen.getByText('HiringInsightsBoard')).toBeTruthy();
    expect(screen.getByText('HiringFocusPanel')).toBeTruthy();
    expect(screen.getByText('CandidatePipeline')).toBeTruthy();
    expect(screen.queryByText('ReviewerDashboardPanel')).toBeNull();

    expect(apiClient.analytics.getCompanyMetrics).toHaveBeenCalledTimes(1);
    expect(apiClient.analytics.getDashboardMetrics).toHaveBeenCalledTimes(1);
  });

  it('opens interview review content inside a dialog overlay when an interview is selected from the dashboard', async () => {
    renderPage(['/company-dashboard?interviewId=int-1&tab=video']);

    await waitFor(() => {
      expect(screen.queryByText('Checking your session and syncing your company data')).toBeNull();
    });

    expect(screen.getByRole('dialog', { name: 'Interview review details' })).toBeTruthy();
    expect(screen.getByText('InterviewReviewEnhanced video')).toBeTruthy();
  });

  it('routes reviewer recording actions into the assigned reviews page instead of opening the dashboard modal', async () => {
    mockUseAuth.mockReturnValue({
      status: 'authenticated',
      user: buildCompanyUser('REVIEWER'),
      logout: vi.fn(),
    });

    renderPage();

    await waitFor(() => {
      expect(screen.queryByText('Checking your session and syncing your company data')).toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Trigger Recording' }));

    await waitFor(() => {
      expect(screen.getByTestId('location-probe').textContent).toContain('/company-reviews?interviewId=int-1&tab=video');
    });

    expect(screen.queryByRole('dialog', { name: 'Interview review details' })).toBeNull();
  });
});
