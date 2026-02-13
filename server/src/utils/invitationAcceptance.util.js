const DEFAULT_LOCK_STALE_MS = 2 * 60 * 1000;

const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  return 0;
};

export const INVITATION_ACCEPTANCE_CLAIM_STATUS = {
  CLAIM_ALLOWED: 'CLAIM_ALLOWED',
  IN_PROGRESS: 'IN_PROGRESS',
  ALREADY_COMPLETED: 'ALREADY_COMPLETED',
  EXPIRED: 'EXPIRED',
  UNAVAILABLE: 'UNAVAILABLE',
};

export const isInvitationAcceptanceLockStale = (
  invitation,
  nowValue = new Date().toISOString(),
  staleAfterMs = DEFAULT_LOCK_STALE_MS,
) => {
  if (!invitation?.acceptanceInProgress) return false;
  const lockStartedAt = invitation.acceptanceStartedAt || invitation.updatedAt || invitation.acceptedAt;
  const lockStartedAtMs = toMillis(lockStartedAt);
  if (!lockStartedAtMs) return true;
  const nowMs = toMillis(nowValue) || Date.now();
  return nowMs - lockStartedAtMs > staleAfterMs;
};

export const evaluateInvitationAcceptanceClaim = (
  invitation,
  userId,
  nowValue = new Date().toISOString(),
) => {
  if (!invitation) {
    return INVITATION_ACCEPTANCE_CLAIM_STATUS.UNAVAILABLE;
  }

  const status = String(invitation.status || '').toUpperCase();
  const isExpired = invitation.expiresAt && new Date(invitation.expiresAt) < new Date(nowValue);

  if (status === 'PENDING' && isExpired) {
    return INVITATION_ACCEPTANCE_CLAIM_STATUS.EXPIRED;
  }

  const sameCandidate = !invitation.candidateUserId || invitation.candidateUserId === userId;
  const hasAcceptedInterview = Boolean(invitation.acceptedInterviewId || invitation.interviewId);
  const lockStale = isInvitationAcceptanceLockStale(invitation, nowValue);

  if (status === 'ACCEPTED') {
    if (!sameCandidate) return INVITATION_ACCEPTANCE_CLAIM_STATUS.UNAVAILABLE;
    if (hasAcceptedInterview) return INVITATION_ACCEPTANCE_CLAIM_STATUS.ALREADY_COMPLETED;
    if (invitation.acceptanceInProgress && !lockStale) return INVITATION_ACCEPTANCE_CLAIM_STATUS.IN_PROGRESS;
    return INVITATION_ACCEPTANCE_CLAIM_STATUS.CLAIM_ALLOWED;
  }

  if (status === 'PENDING') {
    if (invitation.acceptanceInProgress && !lockStale) return INVITATION_ACCEPTANCE_CLAIM_STATUS.IN_PROGRESS;
    return INVITATION_ACCEPTANCE_CLAIM_STATUS.CLAIM_ALLOWED;
  }

  return INVITATION_ACCEPTANCE_CLAIM_STATUS.UNAVAILABLE;
};
