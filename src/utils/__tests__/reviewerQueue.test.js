import { describe, expect, it } from 'vitest';
import { buildReviewerQueue } from '../reviewerQueue.js';

const completedInterview = {
  id: 'interview-1',
  status: 'COMPLETED',
  reviewerAssignments: ['reviewer-1'],
  candidate: { fullName: 'Assigned Candidate' },
  jobRole: 'Platform Engineer',
  reviewRequests: [
    {
      reviewerId: 'reviewer-1',
      workflowState: 'PENDING',
      dueAt: '2026-03-10T10:00:00.000Z',
    },
  ],
};

describe('buildReviewerQueue', () => {
  it('keeps recruiter queue access without coercing the role to admin', () => {
    const queue = buildReviewerQueue({
      interviews: [completedInterview],
      organizationRole: 'RECRUITER',
      reviewerId: null,
    });

    expect(queue).toHaveLength(1);
    expect(queue[0].id).toBe('interview-1');
    expect(queue[0].myReviewRequest).toBeNull();
  });

  it('limits reviewer queue access to assigned interviews', () => {
    const queue = buildReviewerQueue({
      interviews: [completedInterview],
      organizationRole: 'REVIEWER',
      reviewerId: 'reviewer-2',
    });

    expect(queue).toHaveLength(0);
  });
});
