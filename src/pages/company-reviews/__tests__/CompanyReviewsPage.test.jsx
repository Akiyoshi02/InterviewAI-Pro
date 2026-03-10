import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CompanyReviewsPage from '../index.jsx';
import apiClient from '../../../services/apiClient.js';

const mockUseAuth = vi.fn();
const mockUseMaintenanceMode = vi.fn();

vi.mock('framer-motion', () => {
  const MotionSection = ({ children, ...props }) => <section {...props}>{children}</section>;
  return {
    motion: {
      section: MotionSection,
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
  useInterviewRealtimeFeed: vi.fn(),
}));

vi.mock('../../../hooks/useRealtimePathFeed', () => ({
  useRealtimePathFeed: vi.fn(),
}));

vi.mock('../../../constants/realtimeFeedEvents.js', () => ({
  INTERVIEW_FEED_EVENTS: { lifecycle: [], reviews: [] },
  ORGANIZATION_FEED_EVENTS: { reviews: [], interviews: [], applications: [] },
  combineRealtimeEventTypes: vi.fn(() => []),
}));

vi.mock('../../../services/apiClient.js', () => ({
  default: {
    interviews: {
      getCompanyInterviews: vi.fn(),
    },
  },
}));

vi.mock('../../../components/ui/Header', () => ({
  default: () => <div data-testid="header" />,
}));

vi.mock('../../../components/ui/UserContextNavigation', () => ({
  default: () => <div data-testid="user-context-navigation" />,
}));

vi.mock('../../../components/ui/LoadingState', () => ({
  default: ({ title }) => <div>{title}</div>,
}));

vi.mock('../../company-dashboard/components/InterviewReviewEnhanced', () => ({
  default: ({ interviewId, initialActiveTab }) => (
    <div data-testid="interview-review-enhanced">{`${interviewId}:${initialActiveTab}`}</div>
  ),
}));

describe('CompanyReviewsPage', () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    mockUseMaintenanceMode.mockReset();
    apiClient.interviews.getCompanyInterviews.mockReset();

    mockUseAuth.mockReturnValue({
      status: 'authenticated',
      user: {
        id: 'reviewer-1',
        accountType: 'company',
        organizationContext: {
          organization: { id: 'org-1' },
          membership: { role: 'REVIEWER' },
        },
      },
    });
    mockUseMaintenanceMode.mockReturnValue({ maintenanceMode: false });

    apiClient.interviews.getCompanyInterviews.mockResolvedValue({
      success: true,
      interviews: [
        {
          id: 'interview-1',
          status: 'COMPLETED',
          reviewerAssignments: ['reviewer-1'],
          candidate: { fullName: 'Assigned Candidate' },
          jobRole: 'Platform Engineer',
        },
      ],
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('loads the assigned review workspace and opens the selected interview with the requested tab', async () => {
    render(
      <MemoryRouter initialEntries={['/company-reviews?interviewId=interview-1&tab=video']}>
        <CompanyReviewsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(apiClient.interviews.getCompanyInterviews).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByRole('heading', { name: 'Assigned Reviews' })).toBeTruthy();
    expect(screen.getByText('Canonical Review Workspace')).toBeTruthy();
    expect(screen.getAllByText('Assigned Candidate').length).toBeGreaterThan(0);
    expect(screen.getByTestId('interview-review-enhanced').textContent).toContain('interview-1:video');
  });

  it('keeps recruiter role semantics in the review workspace instead of coercing recruiter to admin', async () => {
    mockUseAuth.mockReturnValue({
      status: 'authenticated',
      user: {
        id: 'recruiter-1',
        accountType: 'company',
        organizationContext: {
          organization: { id: 'org-1' },
          membership: { role: 'RECRUITER' },
        },
      },
    });

    apiClient.interviews.getCompanyInterviews.mockResolvedValue({
      success: true,
      interviews: [
        {
          id: 'interview-1',
          status: 'COMPLETED',
          reviewerAssignments: ['reviewer-1'],
          candidate: { fullName: 'Assigned Candidate' },
          jobRole: 'Platform Engineer',
        },
      ],
    });

    render(
      <MemoryRouter initialEntries={['/company-reviews?interviewId=interview-1&tab=review']}>
        <CompanyReviewsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(apiClient.interviews.getCompanyInterviews).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByRole('heading', { name: 'Review Workspace' })).toBeTruthy();
    expect(screen.getByText('Inspect assigned review coverage and complete your own structured interview feedback.')).toBeTruthy();
    expect(screen.getByTestId('interview-review-enhanced').textContent).toContain('interview-1:review');
  });
});
