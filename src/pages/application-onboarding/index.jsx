import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import Header from '../../components/ui/Header';
import UserContextNavigation from '../../components/ui/UserContextNavigation';
import Button from '../../components/ui/Button';
import LoadingState from '../../components/ui/LoadingState';
import MaintenanceBanner from '../../components/ui/MaintenanceBanner';
import Icon from '../../components/AppIcon';
import apiClient from '../../services/apiClient.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useMaintenanceMode } from '../../hooks/useMaintenanceMode';
import { canAccessApplicationOnboarding } from '../../utils/applicationOnboardingPresentation.js';
import {
  formatOfferCompensation,
} from '../../utils/applicationOfferPresentation.js';
import {
  formatOnboardingHistoryEventLabel,
  formatOnboardingStatusLabel,
  formatOnboardingTaskStatusLabel,
  getOnboardingProgress,
  getOnboardingTaskTone,
  groupOnboardingTasksByOwner,
} from '../../utils/applicationOnboardingPresentation.js';

const formatDate = (value, options = {}) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString(undefined, options.showTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' });
};

const CandidateOnboardingPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user, logout, status } = useAuth();
  const { maintenanceMode } = useMaintenanceMode();
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submittingTaskId, setSubmittingTaskId] = useState(null);
  const [application, setApplication] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [taskNotes, setTaskNotes] = useState({});

  const handleLogout = useCallback(async () => {
    await logout();
    navigate('/login');
  }, [logout, navigate]);

  const loadApplication = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const result = await apiClient.applications.getApplication(id);
      if (!result?.success || !result?.application) {
        throw new Error(result?.error || 'Failed to load onboarding.');
      }
      setApplication(result.application);
    } catch (loadError) {
      setError(loadError.message || 'Failed to load onboarding.');
      setApplication(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadApplication();
  }, [loadApplication]);

  useEffect(() => {
    document.title = 'Employee Onboarding - InterviewAI Pro';
  }, []);

  const onboarding = application?.onboarding || null;
  const progress = useMemo(() => getOnboardingProgress(onboarding), [onboarding]);
  const { candidateTasks, teamTasks } = useMemo(() => groupOnboardingTasksByOwner(onboarding), [onboarding]);
  const canAccess = canAccessApplicationOnboarding(application);

  const submitTask = async (task) => {
    if (!application?.id || !task?.id) return;
    setSubmittingTaskId(task.id);
    setError('');
    setSuccess('');
    try {
      const result = await apiClient.applications.respondToOnboardingTask(application.id, task.id, {
        note: taskNotes[task.id] || null,
      });
      if (!result?.success || !result?.application) {
        throw new Error(result?.error || 'Failed to update the onboarding task.');
      }
      setApplication(result.application);
      setTaskNotes((previous) => ({ ...previous, [task.id]: '' }));
      setSuccess(result.message || 'Onboarding task updated.');
    } catch (submitError) {
      setError(submitError.message || 'Failed to update the onboarding task.');
    } finally {
      setSubmittingTaskId(null);
    }
  };

  if (status === 'loading' || !user || loading) {
    return (
      <LoadingState
        title="Loading onboarding"
        message="Preparing your onboarding checklist."
        variant="fullscreen"
        tone="primary"
      />
    );
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 transition-colors duration-300">
      <Header userType="candidate" isAuthenticated onLogout={handleLogout} />
      {maintenanceMode && <MaintenanceBanner />}
      <div className="h-14 xs:h-16" />

      <div className="relative z-10">
        <div className="flex flex-col lg:flex-row">
          <UserContextNavigation
            userType="candidate"
            isCollapsed={isNavCollapsed}
            onToggleCollapse={() => setIsNavCollapsed(!isNavCollapsed)}
          />
          <main className={`flex-1 transition-all duration-300 pb-20 lg:pb-0 ${isNavCollapsed ? 'lg:ml-20' : 'lg:ml-72 xl:ml-80'}`}>
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="container-responsive py-6 xs:py-8 sm:py-10 space-y-6"
            >
              <div className="rounded-3xl border border-white/40 dark:border-slate-700/60 bg-white/90 dark:bg-slate-900/80 p-6 shadow-xl backdrop-blur">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-blue-500 p-3 shadow-lg shadow-emerald-500/25">
                      <Icon name="ClipboardCheck" className="h-7 w-7 text-white" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-600 dark:text-emerald-300">
                        Employee Onboarding
                      </p>
                      <h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-slate-100">
                        {application?.offer?.title || application?.job?.title || 'Onboarding Checklist'}
                      </h1>
                      <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">
                        Complete the final joining tasks, track hiring-team approvals, and keep everything tied to your accepted offer.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">
                      {formatOnboardingStatusLabel(onboarding?.status)}
                    </div>
                    <Button variant="outline" onClick={() => navigate(`/my-applications/${id}/handoff`)}>
                      Back to Handoff
                    </Button>
                  </div>
                </div>
              </div>

              {error && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                  {error}
                </div>
              )}
              {success && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                  {success}
                </div>
              )}

              {!application ? (
                <div className="rounded-3xl border border-white/40 dark:border-slate-700/60 bg-white/90 dark:bg-slate-900/80 p-8 shadow-lg">
                  <p className="text-sm text-gray-600 dark:text-slate-400">The requested onboarding checklist could not be loaded.</p>
                </div>
              ) : !canAccess ? (
                <div className="rounded-3xl border border-white/40 dark:border-slate-700/60 bg-white/90 dark:bg-slate-900/80 p-8 shadow-lg space-y-3">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Onboarding not ready</h2>
                  <p className="text-sm text-gray-600 dark:text-slate-400">
                    Onboarding becomes available once your offer has been accepted and the hiring team marks the application as hired.
                  </p>
                </div>
              ) : (
                <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
                  <div className="space-y-6">
                    <div className="rounded-3xl border border-white/40 dark:border-slate-700/60 bg-white/90 dark:bg-slate-900/80 p-6 shadow-lg">
                      <div className="grid gap-4 sm:grid-cols-3">
                        <div className="rounded-2xl border border-gray-200/80 dark:border-slate-700/70 bg-white/70 dark:bg-slate-950/60 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-500">Progress</p>
                          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-slate-100">{progress.percentComplete}%</p>
                          <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">{progress.completedTasks} of {progress.totalTasks} tasks complete</p>
                        </div>
                        <div className="rounded-2xl border border-gray-200/80 dark:border-slate-700/70 bg-white/70 dark:bg-slate-950/60 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-500">Start Date</p>
                          <p className="mt-2 text-lg font-semibold text-gray-900 dark:text-slate-100">{formatDate(onboarding?.startDate || application?.offer?.startDate)}</p>
                          <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">{formatOfferCompensation(application?.offer) || 'Offer details saved in your record'}</p>
                        </div>
                        <div className="rounded-2xl border border-gray-200/80 dark:border-slate-700/70 bg-white/70 dark:bg-slate-950/60 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-500">Hiring Team Note</p>
                          <p className="mt-2 text-sm text-gray-700 dark:text-slate-300">{onboarding?.welcomeNote || 'Follow the checklist and keep the hiring team updated on any blockers.'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-white/40 dark:border-slate-700/60 bg-white/90 dark:bg-slate-900/80 p-6 shadow-lg space-y-4">
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Your Tasks</h2>
                        <p className="text-sm text-gray-600 dark:text-slate-400">Complete your checklist items here. Some tasks are approved by the hiring team after you submit them.</p>
                      </div>
                      {candidateTasks.map((task) => {
                        const normalizedStatus = String(task.status || '').toUpperCase();
                        const requiresReview = String(task.type || '').toUpperCase() === 'DOCUMENT';
                        const canSubmit = normalizedStatus === 'PENDING' || normalizedStatus === 'REJECTED';
                        return (
                          <div key={task.id} className={`rounded-2xl border p-4 ${getOnboardingTaskTone(task.status)}`}>
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100">{task.title}</h3>
                                  <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-gray-700 dark:bg-slate-900/80 dark:text-slate-200">
                                    {formatOnboardingTaskStatusLabel(task.status)}
                                  </span>
                                </div>
                                {task.description && (
                                  <p className="mt-2 text-sm text-gray-700 dark:text-slate-300">{task.description}</p>
                                )}
                                <p className="mt-2 text-xs font-medium uppercase tracking-[0.08em] text-gray-500 dark:text-slate-500">
                                  Due {formatDate(task.dueAt)}
                                </p>
                                {task.reviewerNote && (
                                  <p className="mt-2 text-sm text-gray-700 dark:text-slate-300">
                                    Hiring team note: {task.reviewerNote}
                                  </p>
                                )}
                              </div>
                              {canSubmit && (
                                <div className="w-full max-w-md space-y-2">
                                  <textarea
                                    value={taskNotes[task.id] || ''}
                                    onChange={(event) => setTaskNotes((previous) => ({ ...previous, [task.id]: event.target.value }))}
                                    placeholder={requiresReview ? 'Add context for the hiring team before submitting this task.' : 'Optional note for the hiring team'}
                                    className="min-h-[110px] w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                  />
                                  <Button
                                    onClick={() => submitTask(task)}
                                    loading={submittingTaskId === task.id}
                                    disabled={submittingTaskId === task.id}
                                  >
                                    {requiresReview ? 'Submit For Review' : 'Mark Complete'}
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="rounded-3xl border border-white/40 dark:border-slate-700/60 bg-white/90 dark:bg-slate-900/80 p-6 shadow-lg space-y-4">
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Hiring Team Tasks</h2>
                        <p className="text-sm text-gray-600 dark:text-slate-400">These are handled by the hiring team. You can track their progress here.</p>
                      </div>
                      {teamTasks.map((task) => (
                        <div key={task.id} className={`rounded-2xl border p-4 ${getOnboardingTaskTone(task.status)}`}>
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100">{task.title}</h3>
                              {task.description && (
                                <p className="mt-2 text-sm text-gray-700 dark:text-slate-300">{task.description}</p>
                              )}
                            </div>
                            <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-gray-700 dark:bg-slate-900/80 dark:text-slate-200">
                              {formatOnboardingTaskStatusLabel(task.status)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="rounded-3xl border border-white/40 dark:border-slate-700/60 bg-white/90 dark:bg-slate-900/80 p-6 shadow-lg">
                      <div className="flex items-center gap-3">
                        <div className="rounded-2xl bg-slate-100 dark:bg-slate-800 p-2">
                          <Icon name="History" className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                        </div>
                        <div>
                          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Onboarding Timeline</h2>
                          <p className="text-sm text-gray-600 dark:text-slate-400">Every checklist change and approval in one place.</p>
                        </div>
                      </div>
                      <div className="mt-5 space-y-3">
                        {(onboarding?.history || []).length === 0 ? (
                          <p className="text-sm text-gray-500 dark:text-slate-400">No onboarding updates yet.</p>
                        ) : (
                          onboarding.history.map((entry) => (
                            <div key={entry.id} className="rounded-2xl border border-gray-200/80 dark:border-slate-700/70 bg-white/70 dark:bg-slate-950/60 px-4 py-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{formatOnboardingHistoryEventLabel(entry.eventType)}</p>
                                <span className="text-xs text-gray-500 dark:text-slate-500">{formatDate(entry.createdAt, { showTime: true })}</span>
                              </div>
                              {entry.note && <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">{entry.note}</p>}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.section>
          </main>
        </div>
      </div>
    </div>
  );
};

export default CandidateOnboardingPage;
