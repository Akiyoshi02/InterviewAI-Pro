import React, { useMemo } from 'react';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/AppIcon';
import { useAuth } from '../../../contexts/AuthContext.jsx';
import { formatReviewRequestDateTime } from '../../../utils/reviewRequests.js';
import {
  buildReviewerQueue,
  buildReviewerQueueMetrics,
  getReviewerRecentSubmissions,
} from '../../../utils/reviewerQueue.js';

const getStateBadgeClasses = (tone) => {
  switch (tone) {
    case 'emerald':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200';
    case 'rose':
      return 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-200';
    case 'amber':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200';
    default:
      return 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-200';
  }
};

const ReviewerDashboardPanel = ({
  interviews = [],
  onOpenWorkspace,
  onOpenInterview,
}) => {
  const { user } = useAuth();
  const organizationRole = String(user?.organizationContext?.membership?.role || '').toUpperCase();

  const reviewQueue = useMemo(
    () => buildReviewerQueue({
      interviews,
      reviewerId: user?.id,
      organizationRole,
    }),
    [interviews, organizationRole, user?.id],
  );

  const metrics = useMemo(() => buildReviewerQueueMetrics(reviewQueue), [reviewQueue]);
  const activeQueue = useMemo(
    () => reviewQueue.filter((entry) => entry.reviewQueueState !== 'COMPLETED'),
    [reviewQueue],
  );
  const priorityReview = activeQueue[0] || reviewQueue[0] || null;
  const queuePreview = activeQueue.slice(0, 3);
  const recentSubmissions = useMemo(
    () => getReviewerRecentSubmissions(reviewQueue, 3),
    [reviewQueue],
  );

  const summaryCards = [
    {
      label: 'Pending',
      value: metrics.pending,
      tone: 'amber',
      detail: metrics.pending > 0 ? 'Ready for review' : 'No pending reviews',
    },
    {
      label: 'Due Soon',
      value: metrics.dueSoon,
      tone: 'orange',
      detail: metrics.dueSoon > 0 ? 'Deadlines approaching' : 'No near deadlines',
    },
    {
      label: 'Overdue',
      value: metrics.overdue,
      tone: 'rose',
      detail: metrics.overdue > 0 ? 'Needs follow-up now' : 'No overdue items',
    },
    {
      label: 'Submitted',
      value: metrics.submitted,
      tone: 'emerald',
      detail: metrics.submitted > 0 ? 'Completed feedback' : 'Nothing submitted yet',
    },
  ];

  return (
    <div className="rounded-2xl border border-white/30 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4 sm:p-5 shadow-[0_20px_60px_rgba(15,23,42,0.12)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-500/10 dark:text-violet-200 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]">
            <Icon name="ClipboardCheck" size={14} />
            Review Snapshot
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-slate-100">
              Reviewer Priorities
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-slate-400 max-w-3xl">
              See the next review to tackle, your active queue, and recent submissions without opening the full workspace.
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          {priorityReview ? (
            <Button
              variant="outline"
              onClick={() => onOpenInterview?.(priorityReview.id)}
              className="rounded-full border border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-200"
            >
              Open Next Review
            </Button>
          ) : null}
          <Button
            onClick={onOpenWorkspace}
            className="rounded-full bg-gradient-to-r from-blue-600 to-purple-600 border-none text-white shadow-md shadow-blue-500/30 hover:from-blue-700 hover:to-purple-700"
          >
            Open Assigned Reviews
          </Button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 xl:grid-cols-4 gap-2.5">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className={`rounded-2xl border px-3.5 py-3 ${
              card.tone === 'emerald'
                ? 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10'
                : card.tone === 'rose'
                  ? 'border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10'
                  : card.tone === 'orange'
                    ? 'border-orange-200 dark:border-orange-500/30 bg-orange-50 dark:bg-orange-500/10'
                    : 'border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10'
            }`}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-600 dark:text-slate-300">
              {card.label}
            </p>
            <p className="mt-1 text-xl sm:text-2xl font-semibold text-gray-900 dark:text-slate-100">
              {card.value}
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
              {card.detail}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[1.45fr_0.95fr] items-start">
        <div className="rounded-2xl border border-blue-200/70 dark:border-blue-500/30 bg-blue-50/70 dark:bg-blue-500/10 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-700 dark:text-blue-200">
                Next Priority
              </p>
              {priorityReview ? (
                <>
                  <h3 className="mt-2 text-lg font-semibold text-gray-900 dark:text-slate-100">
                    {priorityReview.candidate?.fullName || 'Candidate'}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-slate-300">
                    {priorityReview.jobRole || 'Role'}
                  </p>
                  <p className="mt-2 text-sm text-gray-700 dark:text-slate-200">
                    {priorityReview.reviewStatusText}
                  </p>
                  {priorityReview.reviewDueAt ? (
                    <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                      Due {formatReviewRequestDateTime(priorityReview.reviewDueAt)}
                    </p>
                  ) : null}
                </>
              ) : (
                <>
                  <h3 className="mt-2 text-lg font-semibold text-gray-900 dark:text-slate-100">
                    You are caught up
                  </h3>
                  <p className="mt-2 text-sm text-gray-600 dark:text-slate-300">
                    No assigned completed interviews need action right now.
                  </p>
                </>
              )}
            </div>
            {priorityReview ? (
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${getStateBadgeClasses(priorityReview.reviewQueueStateMeta?.tone)}`}>
                {priorityReview.reviewQueueStateMeta?.label || 'Pending'}
              </span>
            ) : null}
          </div>

          <div className="mt-4 rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-900/50 p-3.5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                  Queue Preview
                </h3>
                <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                  Highest-priority assigned reviews from your queue.
                </p>
              </div>
              <Button
                variant="ghost"
                onClick={onOpenWorkspace}
                className="rounded-full px-3 text-blue-600 dark:text-blue-300"
              >
                See all
              </Button>
            </div>

            {queuePreview.length > 0 ? (
              <div className="mt-3 grid gap-2.5 md:grid-cols-2">
                {queuePreview.map((review) => (
                  <button
                    key={review.id}
                    type="button"
                    onClick={() => onOpenInterview?.(review.id)}
                    className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white/90 dark:bg-slate-800/70 p-3 text-left transition-colors hover:border-blue-300 dark:hover:border-blue-500/60"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate">
                          {review.candidate?.fullName || 'Candidate'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
                          {review.jobRole || 'Role'}
                        </p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${getStateBadgeClasses(review.reviewQueueStateMeta?.tone)}`}>
                        {review.reviewQueueStateMeta?.label || 'Pending'}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-gray-600 dark:text-slate-300">
                      {review.reviewStatusText}
                    </p>
                    {review.reviewDueAt ? (
                      <p className="mt-1 text-[11px] text-gray-500 dark:text-slate-400">
                        Due {formatReviewRequestDateTime(review.reviewDueAt)}
                      </p>
                    ) : null}
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-dashed border-gray-200 dark:border-slate-700 px-4 py-5 text-center">
                <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                  No active review queue
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                  Completed interviews assigned to you will appear here automatically.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl border border-white/30 dark:border-slate-700/50 bg-white/70 dark:bg-slate-900/50 p-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
              Recent Submissions
            </h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
              Your latest completed reviewer feedback.
            </p>

            {recentSubmissions.length > 0 ? (
              <div className="mt-3 space-y-2.5">
                {recentSubmissions.map((review) => (
                  <div
                    key={review.id}
                    className="rounded-xl border border-emerald-200/70 dark:border-emerald-500/20 bg-emerald-50/70 dark:bg-emerald-500/10 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate">
                          {review.candidate?.fullName || 'Candidate'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
                          {review.jobRole || 'Role'}
                        </p>
                      </div>
                      <span className="rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]">
                        Submitted
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-gray-600 dark:text-slate-300">
                      {review.reviewStatusText}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-dashed border-gray-200 dark:border-slate-700 px-4 py-5 text-center">
                <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                  No submissions yet
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                  Submitted reviews will stay visible here for quick reference.
                </p>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-violet-200/70 dark:border-violet-500/20 bg-violet-50/70 dark:bg-violet-500/10 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-xl bg-violet-100 dark:bg-violet-500/10 p-2 text-violet-700 dark:text-violet-200">
                <Icon name="BellRing" size={16} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                  Reminder Workflow
                </h3>
                <p className="mt-1 text-xs leading-5 text-gray-600 dark:text-slate-300">
                  {metrics.overdue > 0 || metrics.dueSoon > 0
                    ? `${metrics.overdue > 0 ? `${metrics.overdue} overdue` : ''}${metrics.overdue > 0 && metrics.dueSoon > 0 ? ' • ' : ''}${metrics.dueSoon > 0 ? `${metrics.dueSoon} due soon` : ''}.`
                    : 'No reminder pressure right now.'}{' '}
                  Due-soon and overdue reminders continue automatically in the review workspace.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReviewerDashboardPanel;
