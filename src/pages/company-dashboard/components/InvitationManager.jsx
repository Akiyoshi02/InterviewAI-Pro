import React, { useEffect, useState } from 'react';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/AppIcon';
import apiClient from '../../../services/apiClient.js';

const stageOptions = [
  { value: 'SCREENING', label: 'AI Screening' },
  { value: 'INTERVIEW', label: 'Live Interview' },
  { value: 'FINAL', label: 'Final Review' },
];

const InvitationManager = () => {
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
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2 mb-3 sm:mb-4">
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100">Invitation Manager</h2>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            Send AI-powered pre-screening invites
          </p>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          iconName="RefreshCw"
          onClick={loadData} 
          disabled={loading}
          className="rounded-full text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
        >
          Refresh
        </Button>
      </div>

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
            {invitations.map((invite) => (
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
    </div>
  );
};

export default InvitationManager;
