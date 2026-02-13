import { describe, expect, it } from '@jest/globals';
import {
  evaluateInvitationAcceptanceClaim,
  INVITATION_ACCEPTANCE_CLAIM_STATUS,
  isInvitationAcceptanceLockStale,
} from '../invitationAcceptance.util.js';

describe('invitationAcceptance util', () => {
  it('allows claim for a pending invitation', () => {
    const result = evaluateInvitationAcceptanceClaim(
      { status: 'PENDING', expiresAt: '2026-02-13T00:00:00.000Z' },
      'candidate-1',
      '2026-02-12T00:00:00.000Z',
    );
    expect(result).toBe(INVITATION_ACCEPTANCE_CLAIM_STATUS.CLAIM_ALLOWED);
  });

  it('marks expired pending invitation as expired', () => {
    const result = evaluateInvitationAcceptanceClaim(
      { status: 'PENDING', expiresAt: '2026-02-10T00:00:00.000Z' },
      'candidate-1',
      '2026-02-12T00:00:00.000Z',
    );
    expect(result).toBe(INVITATION_ACCEPTANCE_CLAIM_STATUS.EXPIRED);
  });

  it('returns already completed when accepted interview exists', () => {
    const result = evaluateInvitationAcceptanceClaim(
      {
        status: 'ACCEPTED',
        candidateUserId: 'candidate-1',
        acceptedInterviewId: 'interview-123',
      },
      'candidate-1',
      '2026-02-12T00:00:00.000Z',
    );
    expect(result).toBe(INVITATION_ACCEPTANCE_CLAIM_STATUS.ALREADY_COMPLETED);
  });

  it('returns unavailable for accepted invitation claimed by another candidate', () => {
    const result = evaluateInvitationAcceptanceClaim(
      {
        status: 'ACCEPTED',
        candidateUserId: 'candidate-2',
      },
      'candidate-1',
      '2026-02-12T00:00:00.000Z',
    );
    expect(result).toBe(INVITATION_ACCEPTANCE_CLAIM_STATUS.UNAVAILABLE);
  });

  it('returns in progress while lock is fresh', () => {
    const result = evaluateInvitationAcceptanceClaim(
      {
        status: 'PENDING',
        acceptanceInProgress: true,
        acceptanceStartedAt: '2026-02-12T00:01:30.000Z',
      },
      'candidate-1',
      '2026-02-12T00:02:00.000Z',
    );
    expect(result).toBe(INVITATION_ACCEPTANCE_CLAIM_STATUS.IN_PROGRESS);
  });

  it('treats stale lock as claimable', () => {
    expect(isInvitationAcceptanceLockStale(
      {
        acceptanceInProgress: true,
        acceptanceStartedAt: '2026-02-12T00:00:00.000Z',
      },
      '2026-02-12T00:05:00.000Z',
    )).toBe(true);

    const result = evaluateInvitationAcceptanceClaim(
      {
        status: 'PENDING',
        acceptanceInProgress: true,
        acceptanceStartedAt: '2026-02-12T00:00:00.000Z',
      },
      'candidate-1',
      '2026-02-12T00:05:00.000Z',
    );
    expect(result).toBe(INVITATION_ACCEPTANCE_CLAIM_STATUS.CLAIM_ALLOWED);
  });
});
