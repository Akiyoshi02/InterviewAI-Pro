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
import {
  canAccessApplicationOnboarding,
  canAccessHiredHandoff,
  formatOfferCompensation,
  formatOfferHistoryEventLabel,
} from '../../utils/applicationOfferPresentation.js';
import { downloadOfferDocument } from '../../utils/offerDocument.js';

const formatDate = (value, options = {}) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString(undefined, options.showTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' });
};

const NEXT_STEPS = [
  'Watch for onboarding contact from the hiring team and confirm any requested documents.',
  'Review the agreed start date, compensation, and final offer note before your first day.',
  'Keep a local copy of the offer PDF for your records and any personal onboarding steps.',
];

const HiredHandoffPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user, logout, status } = useAuth();
  const { maintenanceMode } = useMaintenanceMode();
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState(null);
  const [error, setError] = useState('');

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
        throw new Error(result?.error || 'Failed to load the hired handoff.');
      }
      setApplication(result.application);
    } catch (loadError) {
      setError(loadError.message || 'Failed to load the hired handoff.');
      setApplication(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadApplication();
  }, [loadApplication]);

  useEffect(() => {
    document.title = 'Hired Handoff - InterviewAI Pro';
  }, []);

  const history = useMemo(() => Array.isArray(application?.offerHistory) ? application.offerHistory : [], [application?.offerHistory]);
  const handoffReady = canAccessHiredHandoff(application);
  const onboardingReady = canAccessApplicationOnboarding(application);

  if (status === 'loading' || !user || loading) {
    return (
      <LoadingState
        title="Loading handoff"
        message="Preparing your final offer and onboarding summary."
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
                      <Icon name="Handshake" className="h-7 w-7 text-white" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-600 dark:text-emerald-300">
                        Hired Handoff
                      </p>
                      <h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-slate-100">
                        {application?.offer?.title || application?.job?.title || 'Welcome aboard'}
                      </h1>
                      <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">
                        Review the accepted offer, confirm your next steps, and keep one clean record for your start at {application?.organization?.name || 'the company'}.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {application?.offer && (
                      <Button variant="outline" onClick={() => downloadOfferDocument(application, { generatedFor: 'candidate' })}>
                        Download Offer PDF
                      </Button>
                    )}
                    {onboardingReady && (
                      <Button variant="outline" onClick={() => navigate(`/my-applications/${id}/onboarding`)}>
                        Open Onboarding
                      </Button>
                    )}
                    <Button variant="outline" onClick={() => navigate(`/my-applications/${id}/offer`)}>
                      View Offer
                    </Button>
                    <Button variant="outline" onClick={() => navigate('/my-applications')}>
                      Back to Applications
                    </Button>
                  </div>
                </div>
              </div>

              {error && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                  {error}
                </div>
              )}

              {!application ? (
                <div className="rounded-3xl border border-white/40 dark:border-slate-700/60 bg-white/90 dark:bg-slate-900/80 p-8 shadow-lg">
                  <p className="text-sm text-gray-600 dark:text-slate-400">The requested handoff could not be loaded.</p>
                </div>
              ) : !handoffReady ? (
                <div className="rounded-3xl border border-white/40 dark:border-slate-700/60 bg-white/90 dark:bg-slate-900/80 p-8 shadow-lg space-y-3">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Handoff not ready</h2>
                  <p className="text-sm text-gray-600 dark:text-slate-400">
                    This page becomes available once your offer has been accepted and the hiring team has marked the application as hired.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Button variant="outline" onClick={() => navigate(`/my-applications/${id}/offer`)}>
                      Return to Offer
                    </Button>
                    <Button variant="outline" onClick={() => navigate('/my-applications')}>
                      Back to Applications
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
                  <div className="space-y-6">
                    <div className="rounded-3xl border border-white/40 dark:border-slate-700/60 bg-white/90 dark:bg-slate-900/80 p-6 shadow-lg">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-500">Company</p>
                          <p className="mt-1 text-base font-semibold text-gray-900 dark:text-slate-100">{application.organization?.name || 'Company'}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-500">Role</p>
                          <p className="mt-1 text-base font-semibold text-gray-900 dark:text-slate-100">{application.offer?.title || application.job?.title || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-500">Compensation</p>
                          <p className="mt-1 text-base font-semibold text-gray-900 dark:text-slate-100">{formatOfferCompensation(application.offer) || 'Not set'}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-500">Start Date</p>
                          <p className="mt-1 text-base font-semibold text-gray-900 dark:text-slate-100">{formatDate(application.offer?.startDate)}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-500">Offer Accepted</p>
                          <p className="mt-1 text-base font-semibold text-gray-900 dark:text-slate-100">{formatDate(application.offer?.acceptedAt, { showTime: true })}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-500">Application Status</p>
                          <p className="mt-1 text-base font-semibold text-gray-900 dark:text-slate-100">{application.status}</p>
                        </div>
                      </div>

                      {application.offer?.note && (
                        <div className="mt-5 rounded-2xl border border-emerald-200/70 dark:border-emerald-500/25 bg-emerald-50/70 dark:bg-emerald-500/10 px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-emerald-700 dark:text-emerald-300">Hiring Team Note</p>
                          <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700 dark:text-slate-300">{application.offer.note}</p>
                        </div>
                      )}
                    </div>

                    <div className="rounded-3xl border border-white/40 dark:border-slate-700/60 bg-white/90 dark:bg-slate-900/80 p-6 shadow-lg">
                      <div className="flex items-center gap-3">
                        <div className="rounded-2xl bg-slate-100 dark:bg-slate-800 p-2">
                          <Icon name="ListChecks" className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                        </div>
                        <div>
                          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Next Steps</h2>
                          <p className="text-sm text-gray-600 dark:text-slate-400">Use this checklist to finish your transition from accepted offer to start date.</p>
                        </div>
                      </div>
                      <div className="mt-5 space-y-3">
                        {NEXT_STEPS.map((step, index) => (
                          <div key={step} className="flex items-start gap-3 rounded-2xl border border-gray-200/80 dark:border-slate-700/70 bg-white/70 dark:bg-slate-950/60 px-4 py-3">
                            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">
                              {index + 1}
                            </span>
                            <p className="text-sm text-gray-700 dark:text-slate-300">{step}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="rounded-3xl border border-white/40 dark:border-slate-700/60 bg-white/90 dark:bg-slate-900/80 p-6 shadow-lg">
                      <div className="flex items-center gap-3">
                        <div className="rounded-2xl bg-slate-100 dark:bg-slate-800 p-2">
                          <Icon name="History" className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                        </div>
                        <div>
                          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Offer Timeline</h2>
                          <p className="text-sm text-gray-600 dark:text-slate-400">Keep the accepted-offer trail and hiring decision in one place.</p>
                        </div>
                      </div>
                      <div className="mt-5 space-y-3">
                        {history.length === 0 ? (
                          <p className="text-sm text-gray-500 dark:text-slate-400">No offer history is available yet.</p>
                        ) : (
                          history.map((entry) => (
                            <div key={entry.id} className="rounded-2xl border border-gray-200/80 dark:border-slate-700/70 bg-white/70 dark:bg-slate-950/60 px-4 py-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{formatOfferHistoryEventLabel(entry.eventType)}</p>
                                <span className="text-xs text-gray-500 dark:text-slate-500">{formatDate(entry.createdAt, { showTime: true })}</span>
                              </div>
                              {entry.note && (
                                <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">{entry.note}</p>
                              )}
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

export default HiredHandoffPage;
