import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CompanyInterviews from '../index.jsx';
import apiClient from '../../../services/apiClient.js';

const mockUseAuth = vi.fn();

vi.mock('framer-motion', () => {
  const createMockMotionComponent = (tag) => {
    const MotionComponent = ({ children, ...props }) => React.createElement(tag, props, children);
    MotionComponent.displayName = `Motion${tag}`;
    return MotionComponent;
  };

  return {
    motion: {
      div: createMockMotionComponent('div'),
      section: createMockMotionComponent('section'),
    },
  };
});

vi.mock('../../../contexts/AuthContext.jsx', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../../../hooks/useInterviewRealtimeFeed', () => ({
  useInterviewRealtimeFeed: vi.fn(),
}));

vi.mock('../../../constants/realtimeFeedEvents.js', () => ({
  INTERVIEW_FEED_EVENTS: { lifecycle: [], pipeline: [], reviews: [] },
  combineRealtimeEventTypes: vi.fn(() => []),
}));

vi.mock('../../../services/apiClient.js', () => ({
  default: {
    applications: {
      updateStatus: vi.fn(),
    },
    interviews: {
      getCompanyInterviews: vi.fn(),
      createNextStage: vi.fn(),
      rejectRescheduleRequest: vi.fn(),
      updateStageOutcome: vi.fn(),
      updateReviewRequests: vi.fn(),
      sendReviewReminder: vi.fn(),
    },
    organizations: {
      listMembers: vi.fn(),
    },
  },
}));

vi.mock('../../../components/ui/Header', () => ({
  default: () => <div data-testid="header" />,
}));

vi.mock('../../../components/ui/UserContextNavigation', () => ({
  default: () => <div data-testid="user-context-navigation" />,
}));

vi.mock('../../../components/AppIcon', () => ({
  default: ({ name }) => <span data-testid={`icon-${name || 'default'}`} />,
}));

vi.mock('../../../components/ui/Button', () => ({
  default: ({ children, onClick, type = 'button', disabled, title }) => (
    <button type={type} onClick={onClick} disabled={disabled} title={title}>
      {children}
    </button>
  ),
}));

vi.mock('../../../components/ui/LoadingState', () => ({
  default: ({ title }) => <div>{title}</div>,
}));

vi.mock('../../../components/ui/InterviewCalendar', () => ({
  default: () => <div data-testid="interview-calendar" />,
}));

vi.mock('../../../components/ui/ScheduleInterviewModal', () => ({
  default: () => <div data-testid="schedule-interview-modal" />,
}));

vi.mock('../../../components/ui/InterviewScorecard', () => ({
  default: () => <div data-testid="interview-scorecard" />,
}));

vi.mock('../../../components/ui/UnifiedFilterPanel', () => {
  const Panel = ({ children }) => <div data-testid="unified-filter-panel">{children}</div>;
  const Select = ({ value, onChange, options = [], label }) => (
    <label>
      {label || 'select'}
      <select value={value} onChange={(event) => onChange?.(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
  const ToggleButton = ({ children, onClick }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  );
  const SearchField = ({ value, onChange, placeholder }) => (
    <input
      aria-label={placeholder || 'search'}
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
      placeholder={placeholder}
    />
  );
  const TextInput = ({ type = 'text', value, onChange }) => (
    <input type={type} value={value} onChange={onChange} />
  );

  return {
    default: Panel,
    FILTER_DATE_GRID_CLASS: 'filter-date-grid',
    FILTER_GRID_CLASS: 'filter-grid',
    FILTER_SUBPANEL_CLASS: 'filter-subpanel',
    UnifiedFilterSelect: Select,
    UnifiedFilterToggleButton: ToggleButton,
    UnifiedSearchField: SearchField,
    UnifiedTextInput: TextInput,
  };
});

const baseInterview = {
  id: 'interview-1',
  mode: 'HIRING',
  status: 'SCHEDULED',
  scheduledFor: '2026-03-10T09:00:00.000Z',
  createdAt: '2026-03-01T10:00:00.000Z',
  jobRole: 'DevOps Engineer',
  candidate: {
    fullName: 'Aki Yapa',
    email: 'aki@example.com',
  },
};

const renderPage = async (interviews) => {
  apiClient.interviews.getCompanyInterviews.mockResolvedValue({
    success: true,
    interviews,
  });

  render(
    <MemoryRouter>
      <CompanyInterviews />
    </MemoryRouter>,
  );

  await screen.findByText('Aki Yapa');
};

describe('CompanyInterviews meeting link delivery status', () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    apiClient.interviews.getCompanyInterviews.mockReset();
    apiClient.interviews.createNextStage.mockReset();
    apiClient.interviews.rejectRescheduleRequest.mockReset();
    apiClient.interviews.updateStageOutcome.mockReset();
    apiClient.interviews.updateReviewRequests.mockReset();
    apiClient.interviews.sendReviewReminder.mockReset();
    apiClient.applications.updateStatus.mockReset();
    apiClient.organizations.listMembers.mockReset();

    mockUseAuth.mockReturnValue({
      user: {
        id: 'company-user-1',
        accountType: 'COMPANY',
        organizationContext: {
          membership: { role: 'ADMIN' },
        },
      },
      logout: vi.fn(),
      status: 'authenticated',
    });

    apiClient.organizations.listMembers.mockResolvedValue({
      success: true,
      members: [],
    });
    apiClient.applications.updateStatus.mockResolvedValue({
      success: true,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows automated meeting-link delivery status for scheduled hiring interviews in list and details', async () => {
    await renderPage([baseInterview]);

    expect(screen.getByText('Candidate join link emails automatically')).toBeTruthy();
    expect(screen.getByText(/secure join link is generated automatically/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'View Details' }));

    await waitFor(() => {
      expect(screen.getByText('Meeting link delivery')).toBeTruthy();
    });

    expect(screen.getAllByText('Candidate join link emails automatically').length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/previous join link is invalidated automatically/i).length,
    ).toBeGreaterThan(0);
  });

  it('shows current interview round context in list and details', async () => {
    await renderPage([
      {
        ...baseInterview,
        id: 'interview-stage-1',
        planStageId: 'recruiter-screen',
        planStageName: 'Recruiter Screen',
        planStageSequence: 1,
        planStageTotal: 3,
        planStageCategory: 'SCREENING',
        applicationInterviewPlan: {
          stages: [
            { id: 'recruiter-screen', name: 'Recruiter Screen', sequence: 1, category: 'SCREENING' },
            { id: 'sme-interview', name: 'SME Interview', sequence: 2, category: 'TECHNICAL' },
            { id: 'final-interview', name: 'Final Interview', sequence: 3, category: 'FINAL' },
          ],
        },
      },
    ]);

    expect(screen.getByText('Round 1 of 3')).toBeTruthy();
    expect(screen.getAllByText('Recruiter Screen').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'View Details' }));

    await waitFor(() => {
      expect(screen.getByText('Interview stage')).toBeTruthy();
    });

    expect(screen.getAllByText('Round 1 of 3 active').length).toBeGreaterThan(0);
    expect(screen.getAllByText('SME Interview').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Final Interview').length).toBeGreaterThan(0);
  });

  it('uses a stacked mobile card layout so interview summaries span full width below the candidate identity row', async () => {
    await renderPage([
      {
        ...baseInterview,
        scheduleDecision: { source: 'AUTO_EARLIEST' },
        schedulingStrategy: 'PREFERRED_FIRST',
        reviewerAssignments: [],
      },
    ]);

    const identity = screen.getByTestId('interview-card-interview-1-identity');
    const summaries = screen.getByTestId('interview-card-interview-1-summaries');
    const actions = screen.getByTestId('interview-card-interview-1-actions');
    const avatar = identity.firstElementChild;

    expect(identity.className).toContain('items-start');
    expect(avatar.className).toContain('self-start');
    expect(within(identity).queryByText('Auto fallback slot assigned')).toBeNull();
    expect(within(summaries).getByText('Auto fallback slot assigned')).toBeTruthy();
    expect(within(summaries).getByText('Candidate join link emails automatically')).toBeTruthy();
    expect(within(summaries).getByText('No reviewers assigned')).toBeTruthy();
    expect(actions.className).toContain('flex-wrap');
  });

  it('shows the unscheduled automatic email status before a hiring interview is booked', async () => {
    await renderPage([
      {
        ...baseInterview,
        id: 'interview-2',
        status: 'PENDING',
        scheduledFor: null,
      },
    ]);

    expect(screen.getByText('Join link will be emailed automatically')).toBeTruthy();
    expect(screen.getByText(/once you schedule the interview/i)).toBeTruthy();
  });

  it('hides scheduling controls for reviewers while keeping interview details visible', async () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'reviewer-user-1',
        accountType: 'COMPANY',
        organizationContext: {
          membership: { role: 'REVIEWER' },
        },
      },
      logout: vi.fn(),
      status: 'authenticated',
    });

    await renderPage([
      {
        ...baseInterview,
        status: 'COMPLETED',
      },
    ]);

    expect(screen.queryByTitle('Reschedule')).toBeNull();
    expect(screen.getByRole('button', { name: 'View Details' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'View Details' }));

    await waitFor(() => {
      expect(screen.getByText('Interview Details')).toBeTruthy();
    });

    expect(screen.queryByRole('button', { name: /reschedule/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /review & reschedule/i })).toBeNull();
    expect(screen.getByText('Meeting link delivery')).toBeTruthy();
    expect(screen.queryByText('Review request admin')).toBeNull();
    expect(screen.queryByTestId('interview-scorecard')).toBeNull();
    expect(screen.getByRole('button', { name: 'Open Assigned Reviews' })).toBeTruthy();
  });

  it('shows review workflow status for assigned reviewer follow-up in list and details', async () => {
    await renderPage([
      {
        ...baseInterview,
        id: 'interview-3',
        status: 'COMPLETED',
        reviewerAssignments: ['reviewer-1'],
        reviewerAssignees: [{ id: 'reviewer-1', fullName: 'Riley Reviewer', email: 'riley@example.com' }],
        reviewWorkflowSummary: {
          total: 1,
          pending: 1,
          completed: 0,
          waiting: 0,
          dueSoon: 0,
          overdue: 1,
          nextDueAt: '2026-03-08T09:00:00.000Z',
        },
      },
    ]);

    expect(screen.getByText('1 review overdue')).toBeTruthy();
    expect(screen.getByText(/follow up with assigned reviewers/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'View Details' }));

    await waitFor(() => {
      expect(screen.getByText('Review workflow')).toBeTruthy();
    });

    expect(screen.getAllByText('1 review overdue').length).toBeGreaterThan(0);
  });

  it('shows reminder activity summary in the interview list and details', async () => {
    await renderPage([
      {
        ...baseInterview,
        id: 'interview-reminder-summary',
        status: 'COMPLETED',
        reviewerAssignments: ['reviewer-1'],
        reviewerAssignees: [{ id: 'reviewer-1', fullName: 'Riley Reviewer', email: 'riley@example.com' }],
        reviewRequestsDetailed: [
          {
            reviewerId: 'reviewer-1',
            dueSource: 'AUTO',
            dueAt: '2026-03-11T09:00:00.000Z',
            workflowState: 'PENDING',
            lastReminderAt: '2026-03-10T11:00:00.000Z',
            reminderHistory: [
              {
                sentAt: '2026-03-10T11:00:00.000Z',
                workflowState: 'PENDING',
                channel: 'EMAIL',
                source: 'MANUAL',
              },
            ],
          },
        ],
        reviewWorkflowSummary: {
          total: 1,
          pending: 1,
          completed: 0,
          waiting: 0,
          dueSoon: 0,
          overdue: 0,
          nextDueAt: '2026-03-11T09:00:00.000Z',
        },
      },
    ]);

    expect(screen.getByText(/last reminder/i)).toBeTruthy();
    expect(screen.getByText(/manual email reminder sent for pending follow-up/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'View Details' }));

    await waitFor(() => {
      expect(screen.getByText('Reminder activity')).toBeTruthy();
    });

    expect(screen.getAllByText(/manual email reminder sent for pending follow-up/i).length).toBeGreaterThan(0);
  });

  it('lets recruiters update reviewer due workflow from interview details', async () => {
    apiClient.organizations.listMembers.mockResolvedValue({
      success: true,
      members: [
        {
          userId: 'reviewer-1',
          role: 'REVIEWER',
          status: 'ACTIVE',
          user: {
            fullName: 'Riley Reviewer',
            email: 'riley@example.com',
          },
        },
      ],
    });
    apiClient.interviews.updateReviewRequests.mockResolvedValue({
      success: true,
      interview: {
        ...baseInterview,
        id: 'interview-4',
        status: 'COMPLETED',
        reviewerAssignments: ['reviewer-1'],
        reviewerAssignees: [{ id: 'reviewer-1', fullName: 'Riley Reviewer', email: 'riley@example.com' }],
        reviewRequestsDetailed: [
          {
            reviewerId: 'reviewer-1',
            dueSource: 'MANUAL',
            dueAt: '2026-03-12T10:30:00.000Z',
            workflowState: 'PENDING',
            lastReminderAt: '2026-03-09T10:00:00.000Z',
            reminderHistory: [
              {
                sentAt: '2026-03-09T10:00:00.000Z',
                workflowState: 'DUE_SOON',
                channel: 'EMAIL',
              },
            ],
          },
        ],
        reviewWorkflowSummary: {
          total: 1,
          pending: 1,
          completed: 0,
          waiting: 0,
          dueSoon: 0,
          overdue: 0,
          nextDueAt: '2026-03-12T10:30:00.000Z',
        },
      },
    });

    await renderPage([
      {
        ...baseInterview,
        id: 'interview-4',
        status: 'COMPLETED',
        reviewerAssignments: ['reviewer-1'],
        reviewerAssignees: [{ id: 'reviewer-1', fullName: 'Riley Reviewer', email: 'riley@example.com' }],
        reviewRequestsDetailed: [
          {
            reviewerId: 'reviewer-1',
            dueSource: 'AUTO',
            dueAt: '2026-03-11T09:00:00.000Z',
            workflowState: 'PENDING',
            lastReminderAt: null,
            reminderHistory: [],
          },
        ],
        reviewWorkflowSummary: {
          total: 1,
          pending: 1,
          completed: 0,
          waiting: 0,
          dueSoon: 0,
          overdue: 0,
          nextDueAt: '2026-03-11T09:00:00.000Z',
        },
      },
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'View Details' }));

    await waitFor(() => {
      expect(screen.getByText('Review request admin')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Due mode for Riley Reviewer'), {
      target: { value: 'MANUAL' },
    });
    fireEvent.change(screen.getByLabelText('Manual due date for Riley Reviewer'), {
      target: { value: '2026-03-12T16:00' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save reviewer workflow' }));

    await waitFor(() => {
      expect(apiClient.interviews.updateReviewRequests).toHaveBeenCalledWith(
        'interview-4',
        expect.objectContaining({
          reviewRequestUpdates: [
            expect.objectContaining({
              reviewerId: 'reviewer-1',
              dueSource: 'MANUAL',
              dueAt: expect.any(String),
            }),
          ],
        }),
      );
    });

    expect(screen.getByText('Reviewer assignments and due dates updated.')).toBeTruthy();
    expect(screen.getByText(/last reminder sent/i)).toBeTruthy();
    expect(screen.getAllByText(/email reminder sent for due soon follow-up/i).length).toBeGreaterThan(0);
  });

  it('lets recruiters send a manual review reminder from interview details', async () => {
    apiClient.organizations.listMembers.mockResolvedValue({
      success: true,
      members: [
        {
          userId: 'reviewer-1',
          role: 'REVIEWER',
          status: 'ACTIVE',
          user: {
            fullName: 'Riley Reviewer',
            email: 'riley@example.com',
          },
        },
      ],
    });
    apiClient.interviews.sendReviewReminder.mockResolvedValue({
      success: true,
      interview: {
        ...baseInterview,
        id: 'interview-5',
        status: 'COMPLETED',
        reviewerAssignments: ['reviewer-1'],
        reviewerAssignees: [{ id: 'reviewer-1', fullName: 'Riley Reviewer', email: 'riley@example.com' }],
        reviewRequestsDetailed: [
          {
            reviewerId: 'reviewer-1',
            dueSource: 'AUTO',
            dueAt: '2026-03-11T09:00:00.000Z',
            workflowState: 'PENDING',
            lastReminderAt: '2026-03-10T11:00:00.000Z',
            reminderHistory: [
              {
                sentAt: '2026-03-10T11:00:00.000Z',
                workflowState: 'PENDING',
                channel: 'EMAIL',
                source: 'MANUAL',
              },
            ],
          },
        ],
        reviewWorkflowSummary: {
          total: 1,
          pending: 1,
          completed: 0,
          waiting: 0,
          dueSoon: 0,
          overdue: 0,
          nextDueAt: '2026-03-11T09:00:00.000Z',
        },
      },
    });

    await renderPage([
      {
        ...baseInterview,
        id: 'interview-5',
        status: 'COMPLETED',
        reviewerAssignments: ['reviewer-1'],
        reviewerAssignees: [{ id: 'reviewer-1', fullName: 'Riley Reviewer', email: 'riley@example.com' }],
        reviewRequestsDetailed: [
          {
            reviewerId: 'reviewer-1',
            dueSource: 'AUTO',
            dueAt: '2026-03-11T09:00:00.000Z',
            workflowState: 'PENDING',
            lastReminderAt: null,
            reminderHistory: [],
          },
        ],
        reviewWorkflowSummary: {
          total: 1,
          pending: 1,
          completed: 0,
          waiting: 0,
          dueSoon: 0,
          overdue: 0,
          nextDueAt: '2026-03-11T09:00:00.000Z',
        },
      },
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'View Details' }));

    await waitFor(() => {
      expect(screen.getByText('Review request admin')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Send Reminder' }));

    await waitFor(() => {
      expect(apiClient.interviews.sendReviewReminder).toHaveBeenCalledWith('interview-5', 'reviewer-1');
    });

    expect(screen.getByText('Reminder sent to Riley Reviewer.')).toBeTruthy();
    expect(screen.getAllByText(/manual email reminder sent for pending follow-up/i).length).toBeGreaterThan(0);
  });

  it('lets recruiters create the next planned interview stage from a completed round', async () => {
    apiClient.interviews.createNextStage.mockResolvedValue({
      success: true,
      interview: {
        ...baseInterview,
        id: 'interview-next-stage',
        status: 'PENDING',
        scheduledFor: null,
        planStageId: 'sme-interview',
        planStageName: 'SME Interview',
        planStageSequence: 2,
        planStageTotal: 3,
        planStageCategory: 'INTERVIEW',
        applicationInterviewPlan: {
          stages: [
            { id: 'recruiter-screen', name: 'Recruiter Screen', sequence: 1, category: 'SCREENING', status: 'COMPLETED', completedAt: '2026-03-09T09:00:00.000Z', outcome: 'PASS', advanceRule: 'PASS_REQUIRED' },
            { id: 'sme-interview', name: 'SME Interview', sequence: 2, category: 'TECHNICAL', status: 'ACTIVE', outcome: 'PENDING', advanceRule: 'PASS_REQUIRED' },
            { id: 'final-interview', name: 'Final Interview', sequence: 3, category: 'FINAL', status: 'PENDING', outcome: 'PENDING', advanceRule: 'PASS_REQUIRED' },
          ],
        },
      },
      created: true,
      scheduled: false,
      slotFound: false,
    });

    await renderPage([
      {
        ...baseInterview,
        id: 'interview-completed-stage',
        status: 'COMPLETED',
        planStageId: 'recruiter-screen',
        planStageName: 'Recruiter Screen',
        planStageSequence: 1,
        planStageTotal: 3,
        hasNextPlanStage: true,
        nextPlanStage: {
          id: 'sme-interview',
          name: 'SME Interview',
          sequence: 2,
          total: 3,
          category: 'TECHNICAL',
        },
        applicationInterviewPlan: {
          stages: [
            { id: 'recruiter-screen', name: 'Recruiter Screen', sequence: 1, category: 'SCREENING', status: 'COMPLETED', completedAt: '2026-03-09T09:00:00.000Z', outcome: 'PASS', advanceRule: 'PASS_REQUIRED' },
            { id: 'sme-interview', name: 'SME Interview', sequence: 2, category: 'TECHNICAL', status: 'PENDING', outcome: 'PENDING', advanceRule: 'PASS_REQUIRED' },
            { id: 'final-interview', name: 'Final Interview', sequence: 3, category: 'FINAL', status: 'PENDING', outcome: 'PENDING', advanceRule: 'PASS_REQUIRED' },
          ],
        },
      },
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'View Details' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Create Next Stage Interview' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create Next Stage Interview' }));

    await waitFor(() => {
      expect(apiClient.interviews.createNextStage).toHaveBeenCalledWith('interview-completed-stage');
    });

    expect(screen.getByTestId('schedule-interview-modal')).toBeTruthy();
  });

  it('lets recruiters save a completed stage outcome before progressing', async () => {
    apiClient.interviews.updateStageOutcome.mockResolvedValue({
      success: true,
      interview: {
        ...baseInterview,
        id: 'interview-stage-outcome',
        status: 'COMPLETED',
        planStageId: 'recruiter-screen',
        planStageName: 'Recruiter Screen',
        planStageSequence: 1,
        planStageTotal: 3,
        hasNextPlanStage: true,
        nextPlanStage: {
          id: 'sme-interview',
          name: 'SME Interview',
          sequence: 2,
          total: 3,
          category: 'TECHNICAL',
        },
        applicationInterviewPlan: {
          stages: [
            { id: 'recruiter-screen', name: 'Recruiter Screen', sequence: 1, category: 'SCREENING', status: 'COMPLETED', completedAt: '2026-03-09T09:00:00.000Z', outcome: 'PASS', outcomeNote: 'Proceed to the SME round.', advanceRule: 'PASS_REQUIRED' },
            { id: 'sme-interview', name: 'SME Interview', sequence: 2, category: 'TECHNICAL', status: 'PENDING', outcome: 'PENDING', advanceRule: 'PASS_REQUIRED' },
          ],
        },
      },
    });

    await renderPage([
      {
        ...baseInterview,
        id: 'interview-stage-outcome',
        status: 'COMPLETED',
        planStageId: 'recruiter-screen',
        planStageName: 'Recruiter Screen',
        planStageSequence: 1,
        planStageTotal: 2,
        hasNextPlanStage: true,
        nextPlanStage: {
          id: 'sme-interview',
          name: 'SME Interview',
          sequence: 2,
          total: 2,
          category: 'TECHNICAL',
        },
        applicationInterviewPlan: {
          stages: [
            { id: 'recruiter-screen', name: 'Recruiter Screen', sequence: 1, category: 'SCREENING', status: 'COMPLETED', completedAt: '2026-03-09T09:00:00.000Z', outcome: 'PENDING', advanceRule: 'PASS_REQUIRED' },
            { id: 'sme-interview', name: 'SME Interview', sequence: 2, category: 'TECHNICAL', status: 'PENDING', outcome: 'PENDING', advanceRule: 'PASS_REQUIRED' },
          ],
        },
      },
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'View Details' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save Stage Outcome' })).toBeTruthy();
    });

    fireEvent.change(screen.getByPlaceholderText('Explain why this round should pass, remain on hold, or fail.'), {
      target: { value: 'Proceed to the SME round.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Stage Outcome' }));

    await waitFor(() => {
      expect(apiClient.interviews.updateStageOutcome).toHaveBeenCalledWith('interview-stage-outcome', {
        outcome: 'PASS',
        note: 'Proceed to the SME round.',
      });
    });

    expect(screen.getByText('Stage outcome saved.')).toBeTruthy();
  });

  it('shows the application-closed message when a failed round auto-rejects the candidate', async () => {
    apiClient.interviews.updateStageOutcome.mockResolvedValue({
      success: true,
      interview: {
        ...baseInterview,
        id: 'interview-stage-reject',
        status: 'COMPLETED',
        planStageId: 'sme-interview',
        planStageName: 'SME Interview',
        planStageSequence: 2,
        planStageTotal: 2,
        hasNextPlanStage: false,
        applicationInterviewPlan: {
          stages: [
            {
              id: 'recruiter-screen',
              name: 'Recruiter Screen',
              sequence: 1,
              category: 'SCREENING',
              status: 'COMPLETED',
              completedAt: '2026-03-09T09:00:00.000Z',
              outcome: 'PASS',
              advanceRule: 'PASS_REQUIRED',
            },
            {
              id: 'sme-interview',
              name: 'SME Interview',
              sequence: 2,
              category: 'TECHNICAL',
              status: 'COMPLETED',
              completedAt: '2026-03-10T09:00:00.000Z',
              outcome: 'FAIL',
              outcomeNote: 'Role fit was not strong enough.',
              advanceRule: 'PASS_REQUIRED',
              failDispositionCode: 'NOT_SELECTED',
            },
          ],
        },
      },
      applicationStatusChange: {
        status: 'REJECTED',
        dispositionCode: 'NOT_SELECTED',
      },
    });

    await renderPage([
      {
        ...baseInterview,
        id: 'interview-stage-reject',
        status: 'COMPLETED',
        planStageId: 'sme-interview',
        planStageName: 'SME Interview',
        planStageSequence: 2,
        planStageTotal: 2,
        hasNextPlanStage: false,
        applicationInterviewPlan: {
          stages: [
            { id: 'recruiter-screen', name: 'Recruiter Screen', sequence: 1, category: 'SCREENING', status: 'COMPLETED', completedAt: '2026-03-09T09:00:00.000Z', outcome: 'PASS', advanceRule: 'PASS_REQUIRED' },
            { id: 'sme-interview', name: 'SME Interview', sequence: 2, category: 'TECHNICAL', status: 'COMPLETED', completedAt: '2026-03-10T09:00:00.000Z', outcome: 'PENDING', advanceRule: 'PASS_REQUIRED', failDispositionCode: 'NOT_SELECTED' },
          ],
        },
      },
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'View Details' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save Stage Outcome' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Fail' }));
    fireEvent.change(screen.getByPlaceholderText('Explain why this round should pass, remain on hold, or fail.'), {
      target: { value: 'Role fit was not strong enough.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Stage Outcome' }));

    await waitFor(() => {
      expect(apiClient.interviews.updateStageOutcome).toHaveBeenCalledWith('interview-stage-reject', {
        outcome: 'FAIL',
        note: 'Role fit was not strong enough.',
      });
    });

    expect(screen.getByText('Stage outcome saved. The application was closed based on this round result.')).toBeTruthy();
  });

  it('lets recruiters save a pass and create the next stage from the outcome editor', async () => {
    apiClient.interviews.updateStageOutcome.mockResolvedValue({
      success: true,
      interview: {
        ...baseInterview,
        id: 'interview-stage-auto-advance',
        status: 'COMPLETED',
        planStageId: 'recruiter-screen',
        planStageName: 'Recruiter Screen',
        planStageSequence: 1,
        planStageTotal: 2,
        hasNextPlanStage: false,
        applicationInterviewPlan: {
          currentStageId: 'sme-interview',
          stages: [
            { id: 'recruiter-screen', name: 'Recruiter Screen', sequence: 1, category: 'SCREENING', status: 'COMPLETED', completedAt: '2026-03-09T09:00:00.000Z', outcome: 'PASS', outcomeNote: 'Advance now.', advanceRule: 'PASS_REQUIRED', autoAdvanceOnPass: true },
            { id: 'sme-interview', name: 'SME Interview', sequence: 2, category: 'TECHNICAL', status: 'ACTIVE', outcome: 'PENDING', advanceRule: 'PASS_REQUIRED', autoAdvanceOnPass: false },
          ],
        },
      },
      nextInterview: {
        ...baseInterview,
        id: 'interview-stage-auto-next',
        status: 'PENDING',
        scheduledFor: null,
        planStageId: 'sme-interview',
        planStageName: 'SME Interview',
        planStageSequence: 2,
        planStageTotal: 2,
        planStageCategory: 'TECHNICAL',
        applicationInterviewPlan: {
          currentStageId: 'sme-interview',
          stages: [
            { id: 'recruiter-screen', name: 'Recruiter Screen', sequence: 1, category: 'SCREENING', status: 'COMPLETED', completedAt: '2026-03-09T09:00:00.000Z', outcome: 'PASS', outcomeNote: 'Advance now.', advanceRule: 'PASS_REQUIRED', autoAdvanceOnPass: true },
            { id: 'sme-interview', name: 'SME Interview', sequence: 2, category: 'TECHNICAL', status: 'ACTIVE', outcome: 'PENDING', advanceRule: 'PASS_REQUIRED', autoAdvanceOnPass: false },
          ],
        },
      },
      autoAdvance: {
        attempted: true,
        created: true,
        scheduled: false,
      },
    });

    await renderPage([
      {
        ...baseInterview,
        id: 'interview-stage-auto-advance',
        status: 'COMPLETED',
        planStageId: 'recruiter-screen',
        planStageName: 'Recruiter Screen',
        planStageSequence: 1,
        planStageTotal: 2,
        hasNextPlanStage: true,
        nextPlanStage: {
          id: 'sme-interview',
          name: 'SME Interview',
          sequence: 2,
          total: 2,
          category: 'TECHNICAL',
        },
        applicationInterviewPlan: {
          stages: [
            { id: 'recruiter-screen', name: 'Recruiter Screen', sequence: 1, category: 'SCREENING', status: 'COMPLETED', completedAt: '2026-03-09T09:00:00.000Z', outcome: 'PENDING', advanceRule: 'PASS_REQUIRED', autoAdvanceOnPass: true },
            { id: 'sme-interview', name: 'SME Interview', sequence: 2, category: 'TECHNICAL', status: 'PENDING', outcome: 'PENDING', advanceRule: 'PASS_REQUIRED', autoAdvanceOnPass: false },
          ],
        },
      },
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'View Details' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save Pass & Create Next Stage' })).toBeTruthy();
    });

    fireEvent.change(screen.getByPlaceholderText('Explain why this round should pass, remain on hold, or fail.'), {
      target: { value: 'Advance now.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Pass & Create Next Stage' }));

    await waitFor(() => {
      expect(apiClient.interviews.updateStageOutcome).toHaveBeenCalledWith('interview-stage-auto-advance', {
        outcome: 'PASS',
        note: 'Advance now.',
      });
    });

    expect(screen.getByTestId('schedule-interview-modal')).toBeTruthy();
  });

  it('lets recruiters move a completed final round application into the offer stage', async () => {
    await renderPage([
      {
        ...baseInterview,
        id: 'interview-offer-stage',
        status: 'COMPLETED',
        applicationId: 'application-offer-1',
        applicationStatus: 'SHORTLISTED',
        planStageId: 'final-stage',
        planStageName: 'Final Interview',
        planStageSequence: 3,
        planStageTotal: 3,
        hasNextPlanStage: false,
        applicationInterviewPlan: {
          stages: [
            { id: 'recruiter-screen', name: 'Recruiter Screen', sequence: 1, category: 'SCREENING', status: 'COMPLETED', outcome: 'PASS', advanceRule: 'PASS_REQUIRED' },
            { id: 'sme-interview', name: 'SME Interview', sequence: 2, category: 'TECHNICAL', status: 'COMPLETED', outcome: 'PASS', advanceRule: 'PASS_REQUIRED' },
            { id: 'final-stage', name: 'Final Interview', sequence: 3, category: 'FINAL', status: 'COMPLETED', outcome: 'PASS', advanceRule: 'PASS_REQUIRED' },
          ],
        },
      },
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'View Details' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Move to Offer' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Move to Offer' }));

    await waitFor(() => {
      expect(apiClient.applications.updateStatus).toHaveBeenCalledWith('application-offer-1', 'OFFER');
    });

    expect(screen.getByText('The candidate has been moved to the offer stage.')).toBeTruthy();
  });

  it('disables manual reminders during the cooldown window', async () => {
    const recentReminderIso = new Date(Date.now() - (60 * 60 * 1000)).toISOString();
    await renderPage([
      {
        ...baseInterview,
        id: 'interview-6',
        status: 'COMPLETED',
        reviewerAssignments: ['reviewer-1'],
        reviewerAssignees: [{ id: 'reviewer-1', fullName: 'Riley Reviewer', email: 'riley@example.com' }],
        reviewRequestsDetailed: [
          {
            reviewerId: 'reviewer-1',
            dueSource: 'AUTO',
            dueAt: '2026-03-11T09:00:00.000Z',
            workflowState: 'PENDING',
            lastReminderAt: recentReminderIso,
            reminderHistory: [
              {
                sentAt: recentReminderIso,
                workflowState: 'PENDING',
                channel: 'EMAIL',
                source: 'MANUAL',
              },
            ],
          },
        ],
        reviewWorkflowSummary: {
          total: 1,
          pending: 1,
          completed: 0,
          waiting: 0,
          dueSoon: 0,
          overdue: 0,
          nextDueAt: '2026-03-11T09:00:00.000Z',
        },
      },
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'View Details' }));

    await waitFor(() => {
      expect(screen.getByText('Review request admin')).toBeTruthy();
    });

    const sendReminderButton = screen.getByRole('button', { name: 'Send Reminder' });
    expect(sendReminderButton.disabled).toBe(true);
    expect(screen.getByText(/manual reminders reopen after 6 hours/i)).toBeTruthy();
    expect(apiClient.interviews.sendReviewReminder).not.toHaveBeenCalled();
  });
});
