const normalizeWorkflowState = (value) => String(value || '').trim().toUpperCase();

const REVIEW_REQUEST_STATE_META = {
  OVERDUE: {
    label: 'Overdue',
    tone: 'rose',
    priority: 0,
  },
  DUE_SOON: {
    label: 'Due Soon',
    tone: 'amber',
    priority: 1,
  },
  PENDING: {
    label: 'Pending',
    tone: 'blue',
    priority: 2,
  },
  WAITING_FOR_INTERVIEW: {
    label: 'Waiting',
    tone: 'slate',
    priority: 3,
  },
  COMPLETED: {
    label: 'Completed',
    tone: 'emerald',
    priority: 4,
  },
  UNASSIGNED: {
    label: 'Unassigned',
    tone: 'slate',
    priority: 5,
  },
};

export const getReviewRequestStateMeta = (workflowState) => (
  REVIEW_REQUEST_STATE_META[normalizeWorkflowState(workflowState)] || REVIEW_REQUEST_STATE_META.UNASSIGNED
);

export const getReviewRequestPriority = (workflowState) => (
  getReviewRequestStateMeta(workflowState).priority
);

export const formatReviewRequestDateTime = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleString();
};

export const describeReviewReminderHistoryEntry = (entry = {}) => {
  const sentAtLabel = formatReviewRequestDateTime(entry?.sentAt);
  const workflowState = normalizeWorkflowState(entry?.workflowState);
  const channel = String(entry?.channel || 'EMAIL').trim().toUpperCase();
  const source = String(entry?.source || 'AUTOMATED').trim().toUpperCase();
  const stateLabel = getReviewRequestStateMeta(workflowState).label.toLowerCase();
  const channelLabel = channel === 'EMAIL' ? 'Email' : channel;
  const prefix = source === 'MANUAL' ? `Manual ${channelLabel.toLowerCase()}` : channelLabel;

  if (sentAtLabel) {
    return `${prefix} reminder sent for ${stateLabel} follow-up on ${sentAtLabel}.`;
  }

  return `${prefix} reminder sent for ${stateLabel} follow-up.`;
};

export const getReviewRequestForReviewer = (interview, reviewerId) => {
  if (!reviewerId || !Array.isArray(interview?.reviewRequestsDetailed)) return null;
  return interview.reviewRequestsDetailed.find((request) => request?.reviewerId === reviewerId) || null;
};

export const describeReviewRequest = ({
  workflowState,
  dueAt,
  completedAt,
  submittedAt,
} = {}) => {
  const normalizedState = normalizeWorkflowState(workflowState);
  const dueLabel = formatReviewRequestDateTime(dueAt);
  const completedLabel = formatReviewRequestDateTime(completedAt || submittedAt);

  if (normalizedState === 'COMPLETED') {
    return completedLabel
      ? `Your review was submitted ${completedLabel}.`
      : 'Your review has been submitted.';
  }

  if (normalizedState === 'OVERDUE') {
    return dueLabel ? `Review overdue since ${dueLabel}.` : 'Review overdue.';
  }

  if (normalizedState === 'DUE_SOON') {
    return dueLabel ? `Review due soon on ${dueLabel}.` : 'Review due soon.';
  }

  if (normalizedState === 'WAITING_FOR_INTERVIEW') {
    return 'This review will open after the interview is completed.';
  }

  if (normalizedState === 'PENDING') {
    return dueLabel ? `Review due ${dueLabel}.` : 'This interview is ready for your feedback.';
  }

  return 'Review status unavailable.';
};

export const summarizeReviewWorkflow = (interview) => {
  const summary = interview?.reviewWorkflowSummary;
  if (!summary || Number(summary.total || 0) <= 0) return null;

  if (summary.completed === summary.total) {
    return {
      label: 'All assigned reviews completed',
      detail: summary.nextDueAt ? `Last due checkpoint was ${formatReviewRequestDateTime(summary.nextDueAt)}.` : 'All reviewer submissions are in.',
      tone: 'emerald',
    };
  }

  if (summary.overdue > 0) {
    return {
      label: `${summary.overdue} review overdue`,
      detail: summary.nextDueAt
        ? `Follow up with assigned reviewers. Next overdue checkpoint was ${formatReviewRequestDateTime(summary.nextDueAt)}.`
        : 'Follow up with assigned reviewers.',
      tone: 'rose',
    };
  }

  if (summary.dueSoon > 0) {
    return {
      label: `${summary.dueSoon} review due soon`,
      detail: summary.nextDueAt
        ? `Assigned reviewers have a deadline approaching. Next due ${formatReviewRequestDateTime(summary.nextDueAt)}.`
        : 'Assigned reviewers have a deadline approaching.',
      tone: 'amber',
    };
  }

  if (summary.waiting === summary.total) {
    return {
      label: 'Waiting for interview completion',
      detail: 'Review due dates will activate after the interview ends.',
      tone: 'slate',
    };
  }

  if (summary.pending > 0) {
    return {
      label: `${summary.pending} review pending`,
      detail: summary.nextDueAt ? `Next due ${formatReviewRequestDateTime(summary.nextDueAt)}.` : 'Assigned reviewers still need to submit feedback.',
      tone: 'blue',
    };
  }

  return null;
};
