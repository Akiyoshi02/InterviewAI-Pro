import React, { useMemo } from 'react';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/AppIcon';
import InterviewReviewEnhanced from '../../company-dashboard/components/InterviewReviewEnhanced';
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

const TAB_COPY = {
  overview: 'Overview',
  transcript: 'Transcript',
  video: 'Recording',
  evaluation: 'AI Evaluation',
  review: 'My Review',
};

const ReviewerWorkspaceLayout = ({
  interviews = [],
  reviewerId,
  organizationRole,
  selectedInterviewId,
  activeTab = 'review',
  onSelectInterview,
}) => {
  const reviewQueue = useMemo(
    () => buildReviewerQueue({
      interviews,
      reviewerId,
      organizationRole,
    }),
    [interviews, organizationRole, reviewerId],
  );

  const metrics = useMemo(() => buildReviewerQueueMetrics(reviewQueue), [reviewQueue]);
  const selectedInterview = useMemo(
    () => reviewQueue.find((interview) => interview.id === selectedInterviewId) || null,
    [reviewQueue, selectedInterviewId],
  );
  const recentSubmissions = useMemo(
    () => getReviewerRecentSubmissions(reviewQueue, 4),
    [reviewQueue],
  );

  const summaryCards = [
    {
      label: 'Pending',
      value: metrics.pending,
      detail: metrics.pending > 0 ? 'Ready for structured feedback' : 'No pending reviews',
      tone: 'amber',
    },
    {
      label: 'Due Soon',
      value: metrics.dueSoon,
      detail: metrics.dueSoon > 0 ? 'Deadlines approaching' : 'No near-term due dates',
      tone: 'orange',
    },
    {
      label: 'Overdue',
      value: metrics.overdue,
      detail: metrics.overdue > 0 ? 'Needs reviewer follow-up' : 'No overdue assignments',
      tone: 'rose',
    },
    {
      label: 'Submitted',
      value: metrics.submitted,
      detail: metrics.submitted > 0 ? 'Completed feedback on file' : 'Nothing submitted yet',
      tone: 'emerald',
    },
  ];

  return (
    <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
      <aside className="space-y-4">
        <div className="rounded-3xl border border-white/30 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.12)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur">
          <div className="inline-flex items-center gap-2 rounded-full bg-violet-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-violet-700 dark:bg-violet-500/10 dark:text-violet-200">
            <Icon name="ClipboardCheck" size={14} />
            Canonical Review Workspace
          </div>
          <h2 className="mt-3 text-lg font-semibold text-slate-900 dark:text-slate-50">
            Assigned queue
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Recording, transcript, AI evaluation, and review submission now live together here. Dashboard actions route into this workspace.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            {summaryCards.map((card) => (
              <div
                key={card.label}
                className={`rounded-2xl border px-3 py-3 ${
                  card.tone === 'emerald'
                    ? 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10'
                    : card.tone === 'rose'
                      ? 'border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10'
                      : card.tone === 'orange'
                        ? 'border-orange-200 dark:border-orange-500/30 bg-orange-50 dark:bg-orange-500/10'
                        : 'border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10'
                }`}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">
                  {card.label}
                </p>
                <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                  {card.value}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {card.detail}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-white/30 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.12)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Review queue
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Select an interview to review or inspect supporting evidence.
              </p>
            </div>
            {selectedInterview ? (
              <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                getStateBadgeClasses(selectedInterview.reviewQueueStateMeta?.tone)
              }`}>
                {selectedInterview.reviewQueueStateMeta?.label || 'Pending'}
              </span>
            ) : null}
          </div>

          {reviewQueue.length > 0 ? (
            <div className="mt-4 space-y-3">
              {reviewQueue.map((interview) => {
                const isSelected = interview.id === selectedInterviewId;
                return (
                  <button
                    key={interview.id}
                    type="button"
                    onClick={() => onSelectInterview?.(interview.id, 'review')}
                    className={`w-full rounded-2xl border px-3 py-3 text-left transition-colors ${
                      isSelected
                        ? 'border-blue-400 bg-blue-50 dark:border-blue-500/60 dark:bg-blue-500/10'
                        : 'border-gray-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/40 hover:border-blue-300 dark:hover:border-blue-500/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {interview.candidate?.fullName || 'Candidate'}
                        </p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                          {interview.jobRole || 'Role'}
                        </p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                        getStateBadgeClasses(interview.reviewQueueStateMeta?.tone)
                      }`}>
                        {interview.reviewQueueStateMeta?.label || 'Pending'}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                      {interview.reviewStatusText}
                    </p>
                    {interview.reviewDueAt ? (
                      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        Due {formatReviewRequestDateTime(interview.reviewDueAt)}
                      </p>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 px-4 py-6 text-center">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                No assigned completed interviews
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Completed interviews assigned to you will appear here automatically.
              </p>
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-white/30 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.12)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Recent submissions
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Latest reviews you have already completed.
              </p>
            </div>
          </div>

          {recentSubmissions.length > 0 ? (
            <div className="mt-4 space-y-3">
              {recentSubmissions.map((interview) => (
                <button
                  key={interview.id}
                  type="button"
                  onClick={() => onSelectInterview?.(interview.id, 'review')}
                  className="w-full rounded-2xl border border-emerald-200/70 bg-emerald-50/70 px-3 py-3 text-left dark:border-emerald-500/20 dark:bg-emerald-500/10"
                >
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {interview.candidate?.fullName || 'Candidate'}
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                    {interview.jobRole || 'Role'}
                  </p>
                  <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                    {interview.reviewStatusText}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 px-4 py-6 text-center">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                No submissions yet
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Submitted reviews will stay visible here for quick reference.
              </p>
            </div>
          )}
        </div>
      </aside>

      <section className="rounded-3xl border border-white/30 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4 sm:p-5 shadow-[0_20px_60px_rgba(15,23,42,0.12)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur">
        {selectedInterview ? (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 rounded-2xl border border-blue-200/70 bg-blue-50/80 px-4 py-3 dark:border-blue-500/20 dark:bg-blue-500/10 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-700 dark:text-blue-200">
                  Active Review Focus
                </p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {selectedInterview.candidate?.fullName || 'Candidate'}
                </h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {selectedInterview.jobRole || 'Role'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${
                  getStateBadgeClasses(selectedInterview.reviewQueueStateMeta?.tone)
                }`}>
                  {selectedInterview.reviewQueueStateMeta?.label || 'Pending'}
                </span>
                <span className="rounded-full border border-blue-200 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-blue-700 dark:border-blue-500/30 dark:text-blue-200">
                  {TAB_COPY[activeTab] || 'Review'}
                </span>
              </div>
            </div>

            <InterviewReviewEnhanced
              interviewId={selectedInterview.id}
              initialActiveTab={activeTab}
            />
          </div>
        ) : (
          <div className="flex min-h-[520px] items-center justify-center rounded-2xl border border-dashed border-slate-200 px-6 text-center dark:border-slate-700">
            <div>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-200">
                <Icon name="ClipboardCheck" size={24} />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
                Select a review to begin
              </h3>
              <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
                Choose an assigned interview from the queue to open the full review workspace with transcript, recording, AI evaluation, and your feedback form.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default ReviewerWorkspaceLayout;
