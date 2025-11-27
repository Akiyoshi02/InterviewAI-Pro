import React, { useEffect, useMemo, useState } from 'react';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import Button from '../../../components/ui/Button';
import apiClient from '../../../services/apiClient.js';

const decisionOptions = [
  { value: 'ADVANCE', label: 'Advance' },
  { value: 'HOLD', label: 'Hold' },
  { value: 'REJECT', label: 'Reject' },
];

const ReviewerPanel = ({ interviews = [] }) => {
  const reviewableInterviews = useMemo(
    () =>
      interviews
        .filter((interview) => interview && ['IN_PROGRESS', 'COMPLETED'].includes(interview.status))
        .map((interview) => ({
          value: interview.id,
          label: `${interview.candidate?.fullName || 'Candidate'} • ${interview.jobRole || 'Role'}`,
        })),
    [interviews],
  );
  const hasReviewTargets = reviewableInterviews.length > 0;

  const [selectedInterviewId, setSelectedInterviewId] = useState(
    reviewableInterviews[0]?.value || '',
  );
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    score: '',
    decision: 'ADVANCE',
    notes: '',
  });
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    if (reviewableInterviews.length && !selectedInterviewId) {
      setSelectedInterviewId(reviewableInterviews[0]?.value || '');
    }
  }, [reviewableInterviews, selectedInterviewId]);

  const loadReviews = async (interviewId) => {
    if (!interviewId) return;
    setLoading(true);
    setStatusMessage('');
    try {
      const result = await apiClient.reviews.list(interviewId);
      if (result.success) {
        setReviews(result.reviews || []);
      } else {
        setReviews([]);
      }
    } catch (err) {
      setReviews([]);
      setStatusMessage(err.message || 'Failed to load reviews.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedInterviewId) {
      loadReviews(selectedInterviewId);
    }
  }, [selectedInterviewId]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedInterviewId) return;

    setSubmitting(true);
    setStatusMessage('');
    try {
      const payload = {
        score: form.score ? Number(form.score) : undefined,
        decision: form.decision,
        notes: form.notes,
      };
      const result = await apiClient.reviews.submit(selectedInterviewId, payload);
      if (result.success) {
        setReviews((prev) => [result.review, ...prev]);
        setForm({ score: '', decision: 'ADVANCE', notes: '' });
        setStatusMessage('Review submitted.');
      } else {
        setStatusMessage(result.error || 'Failed to submit review.');
      }
    } catch (err) {
      setStatusMessage(err.message || 'Failed to submit review.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-3xl border border-white/30 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-6 shadow-[0_25px_70px_rgba(15,23,42,0.12)] dark:shadow-[0_25px_70px_rgba(0,0,0,0.4)] backdrop-blur">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">Reviewer Portal</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Capture structured feedback that augments the AI interview analysis.
          </p>
        </div>
        <Select
          className="sm:w-72"
          placeholder={hasReviewTargets ? 'Select interview' : 'No interviews ready'}
          value={selectedInterviewId}
          options={reviewableInterviews}
          onChange={(value) => setSelectedInterviewId(value)}
          disabled={!hasReviewTargets}
        />
      </div>

      {statusMessage && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">
          {statusMessage}
        </div>
      )}

      {!hasReviewTargets && (
        <p className="mt-6 text-sm text-gray-500 dark:text-slate-400">
          No interviews are awaiting reviewer feedback yet. Candidates will appear here once their AI sessions finish.
        </p>
      )}

      {hasReviewTargets && (
      <div className="grid gap-6 lg:grid-cols-2 mt-6">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <Input
            label="Overall Score"
            type="number"
            min="0"
            max="100"
            value={form.score}
            onChange={(e) => setForm((prev) => ({ ...prev, score: e.target.value }))}
          />
          <Select
            label="Decision"
            options={decisionOptions}
            value={form.decision}
            onChange={(value) => setForm((prev) => ({ ...prev, decision: value }))}
          />
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-900 dark:text-slate-100">Notes</label>
            <textarea
              className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/40 p-3 text-sm text-gray-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
              rows={5}
              placeholder="Summarize strengths, concerns, and next steps..."
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={submitting || !selectedInterviewId}>
              {submitting ? 'Submitting...' : 'Submit Review'}
            </Button>
          </div>
        </form>

        <div className="rounded-2xl border border-white/30 dark:border-slate-700/50 bg-white/90 dark:bg-slate-900/60 p-4 space-y-3 max-h-[360px] overflow-y-auto">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Recent reviews</h3>
            <Button variant="ghost" size="sm" onClick={() => loadReviews(selectedInterviewId)} disabled={loading}>
              Reload
            </Button>
          </div>
          {loading && <p className="text-sm text-gray-500 dark:text-slate-400">Loading reviews...</p>}
          {!loading && reviews.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-slate-400">No reviews submitted yet.</p>
          )}
          {reviews.map((review) => (
            <div
              key={review.id}
              className="rounded-xl border border-white/30 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/70 p-3 space-y-1"
            >
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
                <span>{review.reviewer?.fullName || review.reviewer?.email || 'Reviewer'}</span>
                <span>{new Date(review.createdAt).toLocaleString()}</span>
              </div>
              <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                {review.decision || 'Feedback'} • {review.score ? `${review.score}/100` : 'No score'}
              </p>
              {review.notes && (
                <p className="text-sm text-gray-600 dark:text-slate-300 whitespace-pre-wrap">{review.notes}</p>
              )}
            </div>
          ))}
        </div>
      </div>
      )}
    </div>
  );
};

export default ReviewerPanel;

