import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ReviewerDashboardPanel from '../ReviewerDashboardPanel.jsx';

const mockUseAuth = vi.fn();

vi.mock('../../../../contexts/AuthContext.jsx', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../../../../components/AppIcon', () => ({
  default: ({ name }) => <span>{name || 'Icon'}</span>,
}));

vi.mock('../../../../components/ui/Button', () => ({
  default: ({ children, type = 'button', onClick, disabled, ...props }) => (
    <button type={type} onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

const buildInterview = ({
  id,
  candidateName,
  jobRole,
  reviewerAssignments = ['reviewer-1'],
  myReviewStatus = 'PENDING',
  myReviewSubmittedAt = null,
  workflowState = 'PENDING',
  dueAt = null,
}) => ({
  id,
  status: 'COMPLETED',
  candidate: { fullName: candidateName },
  jobRole,
  reviewerAssignments,
  myReviewStatus,
  myReviewSubmittedAt,
  reviewRequestsDetailed: [
    {
      reviewerId: 'reviewer-1',
      workflowState,
      dueAt,
    },
  ],
  reviewWorkflowSummary: {
    total: 1,
    pending: myReviewStatus === 'SUBMITTED' ? 0 : 1,
    completed: myReviewStatus === 'SUBMITTED' ? 1 : 0,
    waiting: 0,
    dueSoon: workflowState === 'DUE_SOON' ? 1 : 0,
    overdue: workflowState === 'OVERDUE' ? 1 : 0,
    nextDueAt: dueAt,
  },
});

describe('ReviewerDashboardPanel role experience', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'reviewer-1',
        organizationContext: {
          membership: { role: 'REVIEWER' },
        },
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders a compact snapshot and routes into the dedicated reviews workspace', () => {
    const onOpenWorkspace = vi.fn();
    const onOpenInterview = vi.fn();

    render(
      <ReviewerDashboardPanel
        interviews={[
          buildInterview({
            id: 'review-overdue',
            candidateName: 'Overdue Candidate',
            jobRole: 'Security Engineer',
            workflowState: 'OVERDUE',
            dueAt: '2026-03-05T09:00:00.000Z',
          }),
          buildInterview({
            id: 'review-submitted',
            candidateName: 'Submitted Candidate',
            jobRole: 'Platform Engineer',
            myReviewStatus: 'SUBMITTED',
            myReviewSubmittedAt: '2026-03-06T09:00:00.000Z',
            workflowState: 'COMPLETED',
          }),
        ]}
        onOpenWorkspace={onOpenWorkspace}
        onOpenInterview={onOpenInterview}
      />,
    );

    expect(screen.getByText('Reviewer Priorities')).toBeTruthy();
    expect(screen.getByText('Open Assigned Reviews')).toBeTruthy();
    expect(screen.getByText('Open Next Review')).toBeTruthy();
    expect(screen.getByText('Queue Preview')).toBeTruthy();
    expect(screen.getByText('Recent Submissions')).toBeTruthy();
    expect(screen.queryByText('Overall Score')).toBeNull();
    expect(screen.queryByText('Notes')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Open Assigned Reviews' }));
    expect(onOpenWorkspace).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Open Next Review' }));
    expect(onOpenInterview).toHaveBeenCalledWith('review-overdue');
  });

  it('shows the empty-state snapshot when no assigned completed interviews are available', () => {
    render(
      <ReviewerDashboardPanel
        interviews={[]}
        onOpenWorkspace={vi.fn()}
        onOpenInterview={vi.fn()}
      />,
    );

    expect(screen.getByText('Reviewer Priorities')).toBeTruthy();
    expect(screen.getByText('You are caught up')).toBeTruthy();
    expect(screen.getByText('No active review queue')).toBeTruthy();
    expect(screen.getByText('No submissions yet')).toBeTruthy();
    expect(screen.queryByText('Open Next Review')).toBeNull();
  });
});

