const normalizeRole = (value) => String(value || '').trim().toUpperCase();

const normalizeId = (value) => (typeof value === 'string' ? value.trim() : '');

const buildCandidateJobScopeKey = (candidateId, jobId) => {
  const normalizedCandidateId = normalizeId(candidateId);
  const normalizedJobId = normalizeId(jobId);
  if (!normalizedCandidateId || !normalizedJobId) return null;
  return `${normalizedCandidateId}::${normalizedJobId}`;
};

export const isReviewerRole = (user) => (
  normalizeRole(user?.organizationContext?.membership?.role) === 'REVIEWER'
);

export const isReviewerAssignedToInterview = (interview, reviewerId) => {
  const normalizedReviewerId = normalizeId(reviewerId);
  if (!interview || !normalizedReviewerId) return false;

  if (normalizeId(interview.companyId) === normalizedReviewerId) {
    return true;
  }

  const reviewerAssignments = Array.isArray(interview?.reviewerAssignments)
    ? interview.reviewerAssignments
    : [];

  return reviewerAssignments
    .map((assignmentId) => normalizeId(assignmentId))
    .filter(Boolean)
    .includes(normalizedReviewerId);
};

export const buildReviewerApplicationScope = (interviews = [], reviewerId) => {
  const allowedInterviewIds = new Set();
  const allowedCandidateJobScopes = new Set();

  interviews.forEach((interview) => {
    if (!isReviewerAssignedToInterview(interview, reviewerId)) {
      return;
    }

    const interviewId = normalizeId(interview?.id);
    if (interviewId) {
      allowedInterviewIds.add(interviewId);
    }

    const scopeKey = buildCandidateJobScopeKey(interview?.candidateId, interview?.jobId);
    if (scopeKey) {
      allowedCandidateJobScopes.add(scopeKey);
    }
  });

  return {
    allowedInterviewIds,
    allowedCandidateJobScopes,
  };
};

export const canReviewerAccessApplication = (application, reviewerScope) => {
  if (!application || !reviewerScope) return false;

  const interviewId = normalizeId(application?.interviewId);
  if (interviewId && reviewerScope.allowedInterviewIds.has(interviewId)) {
    return true;
  }

  const scopeKey = buildCandidateJobScopeKey(application?.candidateId, application?.jobId);
  return Boolean(scopeKey) && reviewerScope.allowedCandidateJobScopes.has(scopeKey);
};

