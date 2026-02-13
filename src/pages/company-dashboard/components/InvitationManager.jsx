import React, { useEffect, useRef, useState } from 'react';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/AppIcon';
import apiClient from '../../../services/apiClient.js';
import { useAuth } from '../../../contexts/AuthContext.jsx';
import { useRealtimePathFeed } from '../../../hooks/useRealtimePathFeed';
import { ORGANIZATION_FEED_EVENTS } from '../../../constants/realtimeFeedEvents.js';

const stageOptions = [
  { value: 'SCREENING', label: 'AI Screening' },
  { value: 'INTERVIEW', label: 'Live Interview' },
  { value: 'FINAL', label: 'Final Review' },
];

const InvitationManager = ({ onRefresh }) => {
  const { organization } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    jobId: '',
    email: '',
    stage: 'SCREENING',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(3);
  const realtimeRefreshTimeoutRef = useRef(null);
  const loadDataRef = useRef(null);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [jobsRes, invitesRes] = await Promise.all([
        apiClient.jobs.list(),
        apiClient.invitations.list(),
      ]);

      if (jobsRes.success) {
        setJobs(jobsRes.jobs || []);
        if (!form.jobId && jobsRes.jobs?.length) {
          setForm((prev) => ({ ...prev, jobId: jobsRes.jobs[0].id }));
        }
      }

      if (invitesRes.success) {
        setInvitations(invitesRes.invitations || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load invitations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDataRef.current = loadData;
  }, [loadData]);

  useRealtimePathFeed({
    path: organization?.id ? `organizationFeeds/${organization.id}` : null,
    enabled: Boolean(organization?.id),
    eventTypes: ORGANIZATION_FEED_EVENTS.invitations,
    onFeedUpdate: (_feed, { initial }) => {
      if (initial) return;
      if (realtimeRefreshTimeoutRef.current) {
        clearTimeout(realtimeRefreshTimeoutRef.current);
      }
      realtimeRefreshTimeoutRef.current = setTimeout(() => {
        loadDataRef.current?.();
      }, 300);
    },
  });

  useEffect(
    () => () => {
      if (realtimeRefreshTimeoutRef.current) {
        clearTimeout(realtimeRefreshTimeoutRef.current);
      }
    },
    [],
  );

  // Pagination calculations
  const totalPages = Math.ceil(invitations.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedInvitations = invitations.slice(startIndex, endIndex);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Expose loadData to parent via callback
  useEffect(() => {
    if (onRefresh) {
      onRefresh(loadData);
    }
  }, [onRefresh]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.jobId || !form.email) {
      setError('Job and candidate email are required.');
      return;
    }

    setSubmitting(true);
    setError('');
    setStatusMessage('');

    try {
      const result = await apiClient.invitations.create({
        jobId: form.jobId,
        email: form.email.trim(),
        stage: form.stage,
      });

      if (result.success) {
        setInvitations((prev) => [result.invitation, ...prev]);
        setForm((prev) => ({ ...prev, email: '' }));
        setStatusMessage('Invitation sent successfully.');
      } else {
        setError(result.error || 'Failed to send invitation.');
      }
    } catch (err) {
      setError(err.message || 'Failed to send invitation.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/30 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-3 sm:p-4 shadow-[0_20px_60px_rgba(15,23,42,0.12)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur">
      {statusMessage && (
        <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs sm:text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
          {statusMessage}
        </div>
      )}

      {error && (
        <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs sm:text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          {error}
        </div>
      )}

      <form className="grid gap-3 md:grid-cols-3 items-end mb-4" onSubmit={handleSubmit}>
        <Select
          label="Job"
          options={jobs.map((job) => ({ value: job.id, label: job.title }))}
          value={form.jobId}
          onChange={(value) => setForm((prev) => ({ ...prev, jobId: value }))}
          loading={loading}
        />
        <Input
          label="Candidate Email"
          type="email"
          placeholder="candidate@example.com"
          value={form.email}
          onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
        />
        <Select
          label="Stage"
          options={stageOptions}
          value={form.stage}
          onChange={(value) => setForm((prev) => ({ ...prev, stage: value }))}
        />
        <div className="md:col-span-3">
          <Button 
            type="submit" 
            fullWidth
            disabled={submitting || !form.jobId || !form.email}
            className="rounded-full bg-gradient-to-r from-blue-600 to-purple-600 border-none text-white shadow-md shadow-blue-500/30 hover:from-blue-700 hover:to-purple-700"
          >
            {submitting ? 'Sending...' : 'Send Invite'}
          </Button>
        </div>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 dark:text-slate-400 uppercase tracking-wide text-xs border-b border-white/30 dark:border-slate-700">
              <th className="pb-2 py-2">Email</th>
              <th className="pb-2 py-2">Job</th>
              <th className="pb-2 py-2">Stage</th>
              <th className="pb-2 py-2">Status</th>
              <th className="pb-2 py-2">Sent</th>
            </tr>
          </thead>
          <tbody>
            {paginatedInvitations.map((invite) => (
              <tr key={invite.id} className="border-b border-white/30 dark:border-slate-700/50 hover:bg-white/60 dark:hover:bg-slate-800/60 transition-colors duration-200">
                <td className="py-3 text-gray-900 dark:text-slate-100">{invite.email}</td>
                <td className="py-3 text-gray-500 dark:text-slate-400">{invite.jobId}</td>
                <td className="py-3">
                  <span className="inline-flex items-center rounded-full border border-blue-100 dark:border-blue-500/30 bg-blue-50/60 dark:bg-blue-500/10 px-2 py-1 text-xs font-semibold text-blue-700 dark:text-blue-200">
                    {invite.stage}
                  </span>
                </td>
                <td className="py-3">
                  <span className="text-xs font-semibold text-gray-600 dark:text-slate-300">
                    {invite.status}
                  </span>
                </td>
                <td className="py-3 text-xs text-gray-500 dark:text-slate-400">
                  {invite.createdAt ? new Date(invite.createdAt).toLocaleString() : '—'}
                </td>
              </tr>
            ))}
            {!invitations.length && (
              <tr>
                <td className="py-4 text-sm text-gray-500 dark:text-slate-400" colSpan={5}>
                  {loading ? 'Loading invitations...' : 'No invitations sent yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4 mt-6">
          <div className="text-sm text-gray-600 dark:text-slate-400">
            Showing {startIndex + 1} to {Math.min(endIndex, invitations.length)} of {invitations.length} invitations
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="rounded-full"
            >
              <Icon name="ChevronLeft" size={16} />
              Previous
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                if (
                  page === 1 ||
                  page === totalPages ||
                  (page >= currentPage - 1 && page <= currentPage + 1)
                ) {
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`min-w-[40px] h-10 px-3 rounded-full text-sm font-medium transition-colors ${
                        currentPage === page
                          ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                          : 'bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      {page}
                    </button>
                  );
                } else if (
                  page === currentPage - 2 ||
                  page === currentPage + 2
                ) {
                  return (
                    <span key={page} className="text-gray-500 dark:text-slate-500 px-1">
                      ...
                    </span>
                  );
                }
                return null;
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="rounded-full"
            >
              Next
              <Icon name="ChevronRight" size={16} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvitationManager;
