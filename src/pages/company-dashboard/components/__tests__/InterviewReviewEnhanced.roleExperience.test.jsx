import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import matchers from '@testing-library/jest-dom/matchers';
import InterviewReviewEnhanced from '../InterviewReviewEnhanced.jsx';

expect.extend(matchers);

const mockUseAuth = vi.fn();
const mockUseInterviewRealtimeFeed = vi.fn();
const mockNavigate = vi.fn();

vi.mock('framer-motion', () => {
  const MotionDiv = ({ children, ...props }) => <div {...props}>{children}</div>;
  return {
    motion: {
      div: MotionDiv,
    },
    AnimatePresence: ({ children }) => <>{children}</>,
  };
});

vi.mock('../../../../contexts/AuthContext.jsx', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../../../../hooks/useInterviewRealtimeFeed', () => ({
  useInterviewRealtimeFeed: (...args) => mockUseInterviewRealtimeFeed(...args),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../../../../components/AppIcon', () => ({
  default: ({ name }) => <span>{name || 'Icon'}</span>,
}));

vi.mock('../../../../components/ui/Button', () => ({
  default: ({ children, type = 'button', onClick, disabled, loading, ...props }) => (
    <button type={type} onClick={onClick} disabled={disabled || loading} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('../../../../components/ui/LoadingState', () => ({
  default: ({ title }) => <div>{title}</div>,
}));

vi.mock('../../../../services/apiClient.js', () => ({
  default: {
    applications: {
      updateStatus: vi.fn(),
    },
    interviews: {
      getInterview: vi.fn(),
      getRecordingUrl: vi.fn(),
      runEvaluation: vi.fn(),
      updateStageOutcome: vi.fn(),
    },
    reviews: {
      getReviewForInterview: vi.fn(),
      list: vi.fn(),
      submitReview: vi.fn(),
    },
    uploads: {
      getDownloadUrl: vi.fn(),
    },
  },
}));

import apiClient from '../../../../services/apiClient.js';

const buildInterview = (status) => ({
  id: 'interview-1',
  status,
  mode: 'HIRING',
  candidateId: 'candidate-1',
  candidate: {
    fullName: 'Aki Yapa',
    email: 'aki@example.com',
  },
  jobRole: 'DevOps Engineer',
  duration: 30,
  evaluation: {
    overallScore: 84,
  },
  overallScore: 84,
  readinessLevel: 'Ready',
});

describe('InterviewReviewEnhanced role experience', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockUseInterviewRealtimeFeed.mockReset();
    mockUseAuth.mockReturnValue({
      user: {
        id: 'reviewer-1',
        organizationContext: {
          membership: { role: 'REVIEWER' },
        },
      },
    });

    apiClient.interviews.getRecordingUrl = vi.fn().mockResolvedValue({
      success: false,
    });
    apiClient.applications.updateStatus = vi.fn().mockResolvedValue({
      success: true,
    });
    apiClient.interviews.runEvaluation = vi.fn().mockResolvedValue({
      success: true,
    });
    apiClient.interviews.updateStageOutcome = vi.fn().mockResolvedValue({
      success: true,
      interview: buildInterview('COMPLETED'),
    });
    apiClient.reviews.getReviewForInterview = vi.fn().mockResolvedValue({
      success: true,
      review: null,
    });
    apiClient.reviews.list = vi.fn().mockResolvedValue({
      success: true,
      reviews: [],
    });
    apiClient.reviews.submitReview = vi.fn().mockResolvedValue({
      success: true,
      review: { id: 'review-1' },
    });
    apiClient.uploads.getDownloadUrl = vi.fn().mockResolvedValue('');
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
    vi.clearAllMocks();
  });

  it('keeps review actions locked until the interview is completed', async () => {
    apiClient.interviews.getInterview = vi.fn().mockResolvedValue({
      success: true,
      interview: buildInterview('SCHEDULED'),
    });

    render(<InterviewReviewEnhanced interviewId="interview-1" />);

    await waitFor(() => {
      expect(screen.queryByText('Loading interview review')).toBeNull();
    });

    expect(screen.getByRole('button', { name: /Review Unlocks After Completion/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /My Review/i })).toBeDisabled();
  });

  it('keeps review actions available for completed interviews', async () => {
    apiClient.interviews.getInterview = vi.fn().mockResolvedValue({
      success: true,
      interview: buildInterview('COMPLETED'),
    });

    render(<InterviewReviewEnhanced interviewId="interview-1" />);

    await waitFor(() => {
      expect(screen.queryByText('Loading interview review')).toBeNull();
    });

    expect(screen.getByRole('button', { name: /Submit Review/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /My Review/i })).not.toBeDisabled();
    expect(screen.queryByRole('button', { name: /Export report/i })).toBeNull();
    expect(screen.queryByText(/Use my overall score as the official SME final score/i)).toBeNull();
  });

  it('does not expose AI evaluation reruns to reviewer users', async () => {
    apiClient.interviews.getInterview = vi.fn().mockResolvedValue({
      success: true,
      interview: {
        ...buildInterview('COMPLETED'),
        pendingEvaluation: true,
      },
    });

    render(<InterviewReviewEnhanced interviewId="interview-1" initialActiveTab="evaluation" />);

    await waitFor(() => {
      expect(screen.queryByText('Loading interview review')).toBeNull();
    });

    expect(screen.queryByRole('button', { name: /Run AI Evaluation Now/i })).toBeNull();
  });

  it('keeps SME override available for reviewer users while export stays hidden', async () => {
    apiClient.interviews.getInterview = vi.fn().mockResolvedValue({
      success: true,
      interview: buildInterview('COMPLETED'),
    });

    render(<InterviewReviewEnhanced interviewId="interview-1" initialActiveTab="review" />);

    await waitFor(() => {
      expect(screen.queryByText('Loading interview review')).toBeNull();
    });

    screen.getByRole('button', { name: /My Review/i }).click();
    await screen.findByRole('checkbox');

    expect(screen.queryByRole('button', { name: /Export report/i })).toBeNull();
    expect(screen.getByText(/No official SME final score has been set yet/i)).toBeTruthy();
  });

  it('keeps export and SME override controls available for company admin users', async () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'admin-1',
        organizationContext: {
          membership: { role: 'ADMIN' },
        },
      },
    });
    apiClient.interviews.getInterview = vi.fn().mockResolvedValue({
      success: true,
      interview: buildInterview('COMPLETED'),
    });

    render(<InterviewReviewEnhanced interviewId="interview-1" initialActiveTab="review" />);

    await waitFor(() => {
      expect(screen.queryByText('Loading interview review')).toBeNull();
    });

    screen.getByRole('button', { name: /My Review/i }).click();
    await screen.findByRole('checkbox');

    expect(screen.getByRole('button', { name: /Export report/i })).toBeTruthy();
    expect(screen.getByText(/No official SME final score has been set yet/i)).toBeTruthy();
  });

  it('keeps export available but hides SME override controls for recruiter users', async () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'recruiter-1',
        organizationContext: {
          membership: { role: 'RECRUITER' },
        },
      },
    });
    apiClient.interviews.getInterview = vi.fn().mockResolvedValue({
      success: true,
      interview: buildInterview('COMPLETED'),
    });

    render(<InterviewReviewEnhanced interviewId="interview-1" initialActiveTab="review" />);

    await waitFor(() => {
      expect(screen.queryByText('Loading interview review')).toBeNull();
    });

    screen.getByRole('button', { name: /My Review/i }).click();

    expect(screen.getByRole('button', { name: /Export report/i })).toBeTruthy();
    expect(screen.queryByText(/Use my overall score as the official SME final score/i)).toBeNull();
  });

  it('shows submitted reviewer scores before a reviewer submits their own review', async () => {
    apiClient.interviews.getInterview = vi.fn().mockResolvedValue({
      success: true,
      interview: {
        ...buildInterview('COMPLETED'),
        officialSmeReviewerId: 'reviewer-2',
        officialSmeReviewId: 'review-2',
        officialSmeReviewer: { id: 'reviewer-2', fullName: 'Official Reviewer' },
        finalOverallScore: 80,
        finalScoreSource: 'SME',
      },
    });
    apiClient.reviews.list = vi.fn().mockResolvedValue({
      success: true,
      reviews: [
        {
          id: 'review-2',
          reviewerId: 'reviewer-2',
          reviewer: { id: 'reviewer-2', fullName: 'Official Reviewer' },
          rating: 8,
          smeOverallScore: 80,
          recommendation: 'YES',
          notes: 'Strong depth across the stack.',
          updatedAt: '2026-03-06T09:05:00.000Z',
        },
      ],
    });

    render(<InterviewReviewEnhanced interviewId="interview-1" initialActiveTab="review" />);

    await waitFor(() => {
      expect(screen.queryByText('Loading interview review')).toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: /My Review/i }));

    expect(screen.getByText(/Submitted Reviewer Scores/i)).toBeTruthy();
    expect(screen.getByText(/Official Reviewer owns the official SME final score/i)).toBeTruthy();
    expect(screen.getByText(/Strong depth across the stack/i)).toBeTruthy();
  });

  it('hides the official-score checkbox from peer reviewers when another official reviewer already owns it', async () => {
    apiClient.interviews.getInterview = vi.fn().mockResolvedValue({
      success: true,
      interview: {
        ...buildInterview('COMPLETED'),
        officialSmeReviewerId: 'reviewer-2',
        officialSmeReviewId: 'review-2',
        officialSmeReviewer: { id: 'reviewer-2', fullName: 'Official Reviewer' },
        finalOverallScore: 80,
        finalScoreSource: 'SME',
      },
    });

    render(<InterviewReviewEnhanced interviewId="interview-1" initialActiveTab="review" />);

    await waitFor(() => {
      expect(screen.queryByText('Loading interview review')).toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: /My Review/i }));

    expect(screen.queryByText(/Use my overall score as the official SME final score/i)).toBeNull();
    expect(screen.getByText(/only that reviewer can update the official final score/i)).toBeTruthy();
  });

  it('submits reviewer SME overrides with the explicit overall rating and without untouched zero category scores', async () => {
    apiClient.interviews.getInterview = vi
      .fn()
      .mockResolvedValueOnce({
        success: true,
        interview: buildInterview('COMPLETED'),
      })
      .mockResolvedValueOnce({
        success: true,
        interview: {
          ...buildInterview('COMPLETED'),
          finalOverallScore: 90,
          finalScoreSource: 'SME',
        },
      });

    render(<InterviewReviewEnhanced interviewId="interview-1" initialActiveTab="review" />);

    await waitFor(() => {
      expect(screen.queryByText('Loading interview review')).toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: /My Review/i }));
    fireEvent.change(screen.getAllByRole('slider')[0], { target: { value: '9' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.change(screen.getByPlaceholderText(/Provide detailed feedback/i), {
      target: { value: 'Strong interview performance.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Submit Review/i }));

    await waitFor(() => {
      expect(apiClient.reviews.submitReview).toHaveBeenCalled();
    });

    const payload = apiClient.reviews.submitReview.mock.calls[0][0];
    expect(payload).toMatchObject({
      interviewId: 'interview-1',
      rating: 9,
      overrideOverall: true,
      recommendation: 'UNDECIDED',
      notes: 'Strong interview performance.',
    });
    expect(payload).not.toHaveProperty('technicalScore');
    expect(payload).not.toHaveProperty('communicationScore');
    expect(payload).not.toHaveProperty('problemSolvingScore');
    expect(payload).not.toHaveProperty('culturalFitScore');
  });

  it('blocks reviewer SME overrides until an overall rating is set', async () => {
    apiClient.interviews.getInterview = vi.fn().mockResolvedValue({
      success: true,
      interview: buildInterview('COMPLETED'),
    });

    render(<InterviewReviewEnhanced interviewId="interview-1" initialActiveTab="review" />);

    await waitFor(() => {
      expect(screen.queryByText('Loading interview review')).toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: /My Review/i }));
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.change(screen.getByPlaceholderText(/Provide detailed feedback/i), {
      target: { value: 'Strong interview performance.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Submit Review/i }));

    expect(apiClient.reviews.submitReview).not.toHaveBeenCalled();
    expect(screen.getByText(/Set an overall rating before setting the official SME final score/i)).toBeTruthy();
  });

  it('lets recruiter users record the completed round outcome from the review tab', async () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'recruiter-1',
        organizationContext: {
          membership: { role: 'RECRUITER' },
        },
      },
    });
    apiClient.interviews.getInterview = vi.fn().mockResolvedValue({
      success: true,
      interview: {
        ...buildInterview('COMPLETED'),
        planStageId: 'sme-stage',
        planStageName: 'SME Interview',
        applicationInterviewPlan: {
          currentStageId: 'sme-stage',
          stages: [
            {
              id: 'sme-stage',
              name: 'SME Interview',
              sequence: 2,
              status: 'COMPLETED',
              outcome: 'PENDING',
              outcomeNote: '',
              advanceRule: 'PASS_REQUIRED',
            },
          ],
        },
      },
    });
    apiClient.interviews.updateStageOutcome = vi.fn().mockResolvedValue({
      success: true,
      interview: {
        ...buildInterview('COMPLETED'),
        planStageId: 'sme-stage',
        planStageName: 'SME Interview',
        applicationInterviewPlan: {
          currentStageId: 'sme-stage',
          stages: [
            {
              id: 'sme-stage',
              name: 'SME Interview',
              sequence: 2,
              status: 'COMPLETED',
              outcome: 'PASS',
              outcomeNote: 'Strong domain validation.',
              advanceRule: 'PASS_REQUIRED',
            },
          ],
        },
      },
    });

    render(<InterviewReviewEnhanced interviewId="interview-1" initialActiveTab="review" />);

    await waitFor(() => {
      expect(screen.queryByText('Loading interview review')).toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: /My Review/i }));
    expect(screen.getByText('Round Decision')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Pass' }));
    fireEvent.change(screen.getByPlaceholderText(/Explain why this round passed/i), {
      target: { value: 'Strong domain validation.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save Stage Outcome/i }));

    await waitFor(() => {
      expect(apiClient.interviews.updateStageOutcome).toHaveBeenCalledWith('interview-1', {
        outcome: 'PASS',
        note: 'Strong domain validation.',
      });
    });

    expect(await screen.findByText(/Pass outcome recorded/i)).toBeTruthy();
  });

  it('shows the application-closed confirmation when a failed round auto-rejects the candidate', async () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'recruiter-1',
        organizationContext: {
          membership: { role: 'RECRUITER' },
        },
      },
    });
    apiClient.interviews.getInterview = vi.fn().mockResolvedValue({
      success: true,
      interview: {
        ...buildInterview('COMPLETED'),
        planStageId: 'sme-stage',
        planStageName: 'SME Interview',
        applicationInterviewPlan: {
          currentStageId: 'sme-stage',
          stages: [
            {
              id: 'sme-stage',
              name: 'SME Interview',
              sequence: 2,
              status: 'COMPLETED',
              outcome: 'PENDING',
              outcomeNote: '',
              advanceRule: 'PASS_REQUIRED',
              failDispositionCode: 'NOT_SELECTED',
            },
          ],
        },
      },
    });
    apiClient.interviews.updateStageOutcome = vi.fn().mockResolvedValue({
      success: true,
      interview: {
        ...buildInterview('COMPLETED'),
        planStageId: 'sme-stage',
        planStageName: 'SME Interview',
        applicationInterviewPlan: {
          currentStageId: 'sme-stage',
          stages: [
            {
              id: 'sme-stage',
              name: 'SME Interview',
              sequence: 2,
              status: 'COMPLETED',
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

    render(<InterviewReviewEnhanced interviewId="interview-1" initialActiveTab="review" />);

    await waitFor(() => {
      expect(screen.queryByText('Loading interview review')).toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: /My Review/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Fail' }));
    fireEvent.change(screen.getByPlaceholderText(/Explain why this round passed/i), {
      target: { value: 'Role fit was not strong enough.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save Stage Outcome/i }));

    await waitFor(() => {
      expect(apiClient.interviews.updateStageOutcome).toHaveBeenCalledWith('interview-1', {
        outcome: 'FAIL',
        note: 'Role fit was not strong enough.',
      });
    });

    expect(await screen.findByText(/The application was closed based on this round result\./i)).toBeTruthy();
  });

  it('lets recruiter users create the next stage from the round decision flow', async () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'recruiter-1',
        organizationContext: {
          membership: { role: 'RECRUITER' },
        },
      },
    });
    apiClient.interviews.getInterview = vi.fn().mockResolvedValue({
      success: true,
      interview: {
        ...buildInterview('COMPLETED'),
        planStageId: 'sme-stage',
        planStageName: 'SME Interview',
        hasNextPlanStage: true,
        applicationInterviewPlan: {
          currentStageId: 'sme-stage',
          stages: [
            {
              id: 'sme-stage',
              name: 'SME Interview',
              sequence: 2,
              status: 'COMPLETED',
              outcome: 'PENDING',
              outcomeNote: '',
              advanceRule: 'PASS_REQUIRED',
              autoAdvanceOnPass: true,
            },
            {
              id: 'final-stage',
              name: 'Final Interview',
              sequence: 3,
              status: 'PENDING',
              outcome: 'PENDING',
              advanceRule: 'PASS_REQUIRED',
              autoAdvanceOnPass: false,
            },
          ],
        },
      },
    });
    apiClient.interviews.updateStageOutcome = vi.fn().mockResolvedValue({
      success: true,
      interview: {
        ...buildInterview('COMPLETED'),
        planStageId: 'sme-stage',
        planStageName: 'SME Interview',
        hasNextPlanStage: false,
        applicationInterviewPlan: {
          currentStageId: 'final-stage',
          stages: [
            {
              id: 'sme-stage',
              name: 'SME Interview',
              sequence: 2,
              status: 'COMPLETED',
              outcome: 'PASS',
              outcomeNote: 'Advance to the final round.',
              advanceRule: 'PASS_REQUIRED',
              autoAdvanceOnPass: true,
            },
            {
              id: 'final-stage',
              name: 'Final Interview',
              sequence: 3,
              status: 'ACTIVE',
              outcome: 'PENDING',
              advanceRule: 'PASS_REQUIRED',
              autoAdvanceOnPass: false,
            },
          ],
        },
      },
      nextInterview: {
        ...buildInterview('PENDING'),
        id: 'interview-2',
        planStageId: 'final-stage',
        planStageName: 'Final Interview',
      },
      autoAdvance: {
        attempted: true,
        created: true,
        scheduled: false,
      },
    });

    render(<InterviewReviewEnhanced interviewId="interview-1" initialActiveTab="review" />);

    await waitFor(() => {
      expect(screen.queryByText('Loading interview review')).toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: /My Review/i }));
    fireEvent.change(screen.getByPlaceholderText(/Explain why this round passed/i), {
      target: { value: 'Advance to the final round.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Pass & Create Next Stage' }));

    await waitFor(() => {
      expect(apiClient.interviews.updateStageOutcome).toHaveBeenCalledWith('interview-1', {
        outcome: 'PASS',
        note: 'Advance to the final round.',
      });
    });

    expect(await screen.findByText(/The next interview stage was created/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Open Next Stage in Interviews/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/company-interviews?interviewId=interview-2');
  });

  it('lets recruiter users move the completed final round application into the offer stage', async () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'recruiter-1',
        organizationContext: {
          membership: { role: 'RECRUITER' },
        },
      },
    });
    apiClient.interviews.getInterview = vi
      .fn()
      .mockResolvedValueOnce({
        success: true,
        interview: {
          ...buildInterview('COMPLETED'),
          applicationId: 'application-1',
          applicationStatus: 'SHORTLISTED',
          planStageId: 'final-stage',
          planStageName: 'Final Interview',
          hasNextPlanStage: false,
          applicationInterviewPlan: {
            currentStageId: 'final-stage',
            stages: [
              {
                id: 'final-stage',
                name: 'Final Interview',
                sequence: 3,
                status: 'COMPLETED',
                outcome: 'PASS',
                outcomeNote: 'Ready for an offer.',
                advanceRule: 'PASS_REQUIRED',
              },
            ],
          },
        },
      })
      .mockResolvedValueOnce({
        success: true,
        interview: {
          ...buildInterview('COMPLETED'),
          applicationId: 'application-1',
          applicationStatus: 'OFFER',
          planStageId: 'final-stage',
          planStageName: 'Final Interview',
          hasNextPlanStage: false,
          applicationInterviewPlan: {
            currentStageId: 'final-stage',
            stages: [
              {
                id: 'final-stage',
                name: 'Final Interview',
                sequence: 3,
                status: 'COMPLETED',
                outcome: 'PASS',
                outcomeNote: 'Ready for an offer.',
                advanceRule: 'PASS_REQUIRED',
              },
            ],
          },
        },
      });

    render(<InterviewReviewEnhanced interviewId="interview-1" initialActiveTab="review" />);

    await waitFor(() => {
      expect(screen.queryByText('Loading interview review')).toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: /My Review/i }));
    fireEvent.click(screen.getByRole('button', { name: /Move to Offer/i }));

    await waitFor(() => {
      expect(apiClient.applications.updateStatus).toHaveBeenCalledWith('application-1', 'OFFER');
    });

    expect(await screen.findByText(/moved to the offer stage/i)).toBeTruthy();
  });

  it('does not expose round-decision controls to reviewer users', async () => {
    apiClient.interviews.getInterview = vi.fn().mockResolvedValue({
      success: true,
      interview: {
        ...buildInterview('COMPLETED'),
        planStageId: 'sme-stage',
        planStageName: 'SME Interview',
        applicationInterviewPlan: {
          currentStageId: 'sme-stage',
          stages: [
            {
              id: 'sme-stage',
              name: 'SME Interview',
              sequence: 2,
              status: 'COMPLETED',
              outcome: 'PENDING',
              outcomeNote: '',
              advanceRule: 'PASS_REQUIRED',
            },
          ],
        },
      },
    });

    render(<InterviewReviewEnhanced interviewId="interview-1" initialActiveTab="review" />);

    await waitFor(() => {
      expect(screen.queryByText('Loading interview review')).toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: /My Review/i }));
    expect(screen.queryByText('Round Decision')).toBeNull();
    expect(screen.queryByRole('button', { name: /Save Stage Outcome/i })).toBeNull();
  });

  it('keeps the mobile header and review tabs readable for recruiter users', async () => {
    const onClose = vi.fn();

    mockUseAuth.mockReturnValue({
      user: {
        id: 'recruiter-1',
        organizationContext: {
          membership: { role: 'RECRUITER' },
        },
      },
    });
    apiClient.interviews.getInterview = vi.fn().mockResolvedValue({
      success: true,
      interview: buildInterview('COMPLETED'),
    });

    render(<InterviewReviewEnhanced interviewId="interview-1" onClose={onClose} />);

    await waitFor(() => {
      expect(screen.queryByText('Loading interview review')).toBeNull();
    });

    const heading = screen.getByText('Interview Review');
    const headerRow = heading.closest('div')?.parentElement;
    expect(headerRow).not.toBeNull();
    expect(headerRow.className).toContain('flex-col');
    expect(headerRow.className).toContain('sm:flex-row');

    const exportButton = screen.getByRole('button', { name: /Export report/i });
    const actionRow = exportButton.parentElement;
    expect(actionRow).not.toBeNull();
    expect(actionRow.className).toContain('w-full');
    expect(actionRow.className).toContain('sm:w-auto');
    expect(exportButton.className).toContain('flex-1');
    expect(exportButton.className).toContain('sm:flex-none');
    expect(screen.getByRole('button', { name: /Close interview review/i })).toBeTruthy();

    const overviewButton = screen.getByRole('button', { name: /Overview/i });
    const tabRail = overviewButton.parentElement;
    const tabScroller = tabRail?.parentElement;
    expect(tabScroller).not.toBeNull();
    expect(tabScroller.className).toContain('overflow-x-auto');
    expect(tabRail).not.toBeNull();
    expect(tabRail.className).toContain('min-w-max');
    expect(overviewButton.className).toContain('shrink-0');
    expect(overviewButton.className).toContain('whitespace-nowrap');
  });

  it('keeps recruiter users in the modal after submitting a review', async () => {
    const onClose = vi.fn();

    mockUseAuth.mockReturnValue({
      user: {
        id: 'recruiter-1',
        organizationContext: {
          membership: { role: 'RECRUITER' },
        },
      },
    });
    apiClient.interviews.getInterview = vi
      .fn()
      .mockResolvedValueOnce({
        success: true,
        interview: buildInterview('COMPLETED'),
      })
      .mockResolvedValueOnce({
        success: true,
        interview: buildInterview('COMPLETED'),
      });

    render(<InterviewReviewEnhanced interviewId="interview-1" initialActiveTab="review" onClose={onClose} />);

    await waitFor(() => {
      expect(screen.queryByText('Loading interview review')).toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: /My Review/i }));
    fireEvent.change(screen.getByPlaceholderText(/Provide detailed feedback/i), {
      target: { value: 'Strong interview performance.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Submit Review/i }));

    await waitFor(() => {
      expect(apiClient.reviews.submitReview).toHaveBeenCalled();
    });

    await new Promise((resolve) => {
      setTimeout(resolve, 1300);
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});


