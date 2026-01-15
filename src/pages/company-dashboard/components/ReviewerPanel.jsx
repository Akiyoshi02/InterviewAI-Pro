import React, { useEffect, useMemo, useState } from 'react';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/AppIcon';
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
      const errorMsg = err?.message || (typeof err === 'string' ? err : 'Failed to load reviews.');
      setStatusMessage(errorMsg);
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
        const errorMsg = typeof result.error === 'string' ? result.error : (result.error?.message || 'Failed to submit review.');
        setStatusMessage(errorMsg);
      }
    } catch (err) {
      const errorMsg = err?.message || (typeof err === 'string' ? err : 'Failed to submit review.');
      setStatusMessage(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/30 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-3 sm:p-4 shadow-[0_20px_60px_rgba(15,23,42,0.12)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3 sm:mb-4">
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100">Reviewer Portal</h2>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            Capture structured feedback that augments AI analysis
          </p>
        </div>
        <Select
          className="sm:w-64"
          placeholder={hasReviewTargets ? 'Select interview' : 'No interviews ready'}
          value={selectedInterviewId}
          options={reviewableInterviews}
          onChange={(value) => setSelectedInterviewId(value)}
          disabled={!hasReviewTargets}
        />
      </div>

      {statusMessage && (
        <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs sm:text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
          {typeof statusMessage === 'string' ? statusMessage : String(statusMessage)}
        </div>
      )}

      {!hasReviewTargets && (
        <div className="text-center py-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-slate-800 dark:to-slate-900 border border-white/50 dark:border-slate-700/60 rounded-full flex items-center justify-center mx-auto mb-2">
            <Icon name="CheckCircle" size={20} className="text-emerald-500" />
          </div>
          <h3 className="font-medium text-gray-900 dark:text-slate-100 text-sm mb-1">All Caught Up!</h3>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            No interviews are awaiting reviewer feedback yet.
          </p>
        </div>
      )}

      {hasReviewTargets && (
        <div className="grid gap-4 lg:grid-cols-2">
          <form className="space-y-3" onSubmit={handleSubmit}>
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
                className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/40 p-3 text-sm text-gray-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                rows={4}
                placeholder="Summarize strengths, concerns, and next steps..."
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </div>
            <div className="flex justify-end">
              <Button 
                type="submit" 
                disabled={submitting || !selectedInterviewId}
                className="rounded-full bg-gradient-to-r from-blue-600 to-purple-600 border-none text-white shadow-md shadow-blue-500/30 hover:from-blue-700 hover:to-purple-700"
              >
                {submitting ? 'Submitting...' : 'Submit Review'}
              </Button>
            </div>
          </form>

          <div className="rounded-xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-900/60 p-3 sm:p-4 space-y-3 max-h-[320px] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100">Recent Reviews</h3>
              <Button 
                variant="ghost" 
                size="sm" 
                iconName="RefreshCw"
                onClick={() => loadReviews(selectedInterviewId)} 
                disabled={loading}
                className="rounded-full text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
              />
            </div>
            {loading && <p className="text-sm text-gray-500 dark:text-slate-400">Loading reviews...</p>}
            {!loading && reviews.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-slate-400">No reviews submitted yet.</p>
            )}
            {reviews.map((review) => (
              <div
                key={review.id}
                className="rounded-xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/70 p-3 space-y-2 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(15,23,42,0.1)] dark:hover:shadow-[0_10px_30px_rgba(0,0,0,0.3)] transition-all duration-200"
              >
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
                  <span>
                    {(() => {
                      const reviewer = review.reviewer;
                      if (typeof reviewer === 'object' && reviewer !== null) {
                        return reviewer.fullName || reviewer.email || 'Reviewer';
                      }
                      return 'Reviewer';
                    })()}
                  </span>
                  <span>{review.createdAt ? new Date(review.createdAt).toLocaleString() : '—'}</span>
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
