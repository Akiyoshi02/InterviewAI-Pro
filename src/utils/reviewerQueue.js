import {
  describeReviewRequest,
  getReviewRequestForReviewer,
  getReviewRequestPriority,
  getReviewRequestStateMeta,
} from './reviewRequests.js';

export const buildReviewerQueue = ({
  interviews = [],
  reviewerId,
  organizationRole = '',
  submittedReviewIds = [],
} = {}) => {
  const normalizedRole = String(organizationRole || '').toUpperCase();
  const canSeeAllAssignedQueues = normalizedRole === 'ADMIN' || normalizedRole === 'RECRUITER';
  const submittedIds = submittedReviewIds instanceof Set
    ? submittedReviewIds
    : new Set(Array.isArray(submittedReviewIds) ? submittedReviewIds : []);

  return (Array.isArray(interviews) ? interviews : [])
    .filter((interview) => interview && String(interview.status || '').toUpperCase() === 'COMPLETED')
    .filter((interview) => {
      const reviewerAssignments = Array.isArray(interview?.reviewerAssignments)
        ? interview.reviewerAssignments.filter(Boolean)
        : [];

      if (!reviewerAssignments.length) return false;
      if (canSeeAllAssignedQueues) return true;
      return Boolean(reviewerId) && reviewerAssignments.includes(reviewerId);
    })
    .map((interview) => {
      const submitted = String(interview?.myReviewStatus || 'PENDING').toUpperCase() === 'SUBMITTED'
        || submittedIds.has(interview.id);
      const myReviewRequest = getReviewRequestForReviewer(interview, reviewerId);
      const reviewQueueState = submitted
        ? 'COMPLETED'
        : (myReviewRequest?.workflowState || 'PENDING');
      const reviewQueueStateMeta = getReviewRequestStateMeta(reviewQueueState);
      const reviewDueAt = myReviewRequest?.dueAt || interview?.reviewWorkflowSummary?.nextDueAt || null;

      return {
        ...interview,
        value: interview.id,
        label: `${interview.candidate?.fullName || 'Candidate'} - ${interview.jobRole || 'Role'}`,
        myReviewStatus: submitted ? 'SUBMITTED' : 'PENDING',
        myReviewRequest,
        reviewQueueState,
        reviewQueueStateMeta,
        reviewDueAt,
        reviewStatusText: describeReviewRequest({
          workflowState: reviewQueueState,
          dueAt: reviewDueAt,
          completedAt: myReviewRequest?.completedAt,
          submittedAt: interview?.myReviewSubmittedAt,
        }),
      };
    })
    .sort((left, right) => {
      const priorityDiff = getReviewRequestPriority(left.reviewQueueState) - getReviewRequestPriority(right.reviewQueueState);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      const leftDueAt = left.reviewDueAt ? Date.parse(left.reviewDueAt) : Number.NaN;
      const rightDueAt = right.reviewDueAt ? Date.parse(right.reviewDueAt) : Number.NaN;
      if (Number.isFinite(leftDueAt) && Number.isFinite(rightDueAt) && leftDueAt !== rightDueAt) {
        return leftDueAt - rightDueAt;
      }

      const leftTime = left.myReviewSubmittedAt || left.completedAt || left.updatedAt || left.createdAt || '';
      const rightTime = right.myReviewSubmittedAt || right.completedAt || right.updatedAt || right.createdAt || '';
      return String(rightTime).localeCompare(String(leftTime));
    });
};

export const buildReviewerQueueMetrics = (reviewQueue = []) => reviewQueue.reduce(
  (totals, interview) => {
    switch (interview.reviewQueueState) {
      case 'OVERDUE':
        totals.overdue += 1;
        break;
      case 'DUE_SOON':
        totals.dueSoon += 1;
        break;
      case 'COMPLETED':
        totals.submitted += 1;
        break;
      default:
        totals.pending += 1;
        break;
    }
    return totals;
  },
  {
    pending: 0,
    dueSoon: 0,
    overdue: 0,
    submitted: 0,
  },
);

export const getReviewerRecentSubmissions = (reviewQueue = [], limit = 3) => (
  reviewQueue
    .filter((interview) => String(interview?.myReviewStatus || '').toUpperCase() === 'SUBMITTED')
    .sort((left, right) => {
      const leftTime = Date.parse(left?.myReviewSubmittedAt || left?.updatedAt || left?.createdAt || 0);
      const rightTime = Date.parse(right?.myReviewSubmittedAt || right?.updatedAt || right?.createdAt || 0);
      return rightTime - leftTime;
    })
    .slice(0, limit)
);
