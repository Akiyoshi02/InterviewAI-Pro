import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import Header from '../../components/ui/Header';
import UserContextNavigation from '../../components/ui/UserContextNavigation';
import Button from '../../components/ui/Button';
import LoadingState from '../../components/ui/LoadingState';
import Icon from '../../components/AppIcon';
import apiClient from '../../services/apiClient.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import {
  canAccessApplicationOnboarding,
  canAccessHiredHandoff,
  formatOfferCompensation,
  formatOfferHistoryEventLabel,
  isOfferExpired,
} from '../../utils/applicationOfferPresentation.js';
import { downloadOfferDocument } from '../../utils/offerDocument.js';

const formatDate = (value, options = {}) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString(undefined, options.showTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' });
};

const OfferStatusBadge = ({ status }) => {
  const normalized = String(status || '').toUpperCase();
  const className = normalized === 'ACCEPTED'
    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200'
    : normalized === 'DECLINED'
      ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200'
      : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200';

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] ${className}`}>
      {normalized || 'PENDING'}
    </span>
  );
};

const CandidateOfferPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user, logout, status } = useAuth();
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [application, setApplication] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [declineReason, setDeclineReason] = useState('');
  const [showDeclineForm, setShowDeclineForm] = useState(false);

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
        throw new Error(result?.error || 'Failed to load offer details.');
      }
      setApplication(result.application);
    } catch (loadError) {
      setError(loadError.message || 'Failed to load offer details.');
      setApplication(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadApplication();
  }, [loadApplication]);

  useEffect(() => {
    document.title = 'Offer Details - InterviewAI Pro';
  }, []);

  const offer = application?.offer || null;
  const offerStatus = String(offer?.status || '').toUpperCase();
  const offerExpired = isOfferExpired(offer);
  const canRespond = application?.status === 'OFFER' && offerStatus === 'PENDING' && !offerExpired;
  const history = useMemo(() => Array.isArray(application?.offerHistory) ? application.offerHistory : [], [application?.offerHistory]);
  const canOpenHandoff = canAccessHiredHandoff(application);
  const canOpenOnboarding = canAccessApplicationOnboarding(application);

  const handleAccept = async () => {
    if (!application?.id) return;
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const result = await apiClient.applications.acceptOffer(application.id);
      if (!result?.success || !result?.application) {
        throw new Error(result?.error || 'Failed to accept offer.');
      }
      setApplication(result.application);
      setSuccess(result.message || 'Offer accepted successfully.');
    } catch (acceptError) {
      setError(acceptError.message || 'Failed to accept offer.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecline = async () => {
    if (!application?.id) return;
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const result = await apiClient.applications.declineOffer(application.id, {
        declineReason: declineReason.trim() || null,
      });
      if (!result?.success || !result?.application) {
        throw new Error(result?.error || 'Failed to decline offer.');
      }
      setApplication(result.application);
      setShowDeclineForm(false);
      setDeclineReason('');
      setSuccess(result.message || 'Offer declined successfully.');
    } catch (declineError) {
      setError(declineError.message || 'Failed to decline offer.');
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'loading' || !user || loading) {
    return (
      <LoadingState
        title="Loading offer details"
        message="Fetching the latest offer information."
        variant="fullscreen"
        tone="primary"
      />
    );
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 transition-colors duration-300">
      <Header userType="candidate" isAuthenticated onLogout={handleLogout} />
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
              className="container-responsive py-4 xs:py-6 sm:py-8"
            >
              <div className="mb-6 rounded-3xl border border-white/40 dark:border-slate-700/60 bg-white/90 dark:bg-slate-900/80 p-6 shadow-xl backdrop-blur">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 p-3 shadow-lg shadow-amber-500/25">
                      <Icon name="Briefcase" className="h-7 w-7 text-white" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-600 dark:text-amber-300">
                        Offer Stage
                      </p>
                      <h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-slate-100">
                        {offer?.title || application?.job?.title || 'Offer Details'}
                      </h1>
                      <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">
                        Review the final offer details, confirm your decision, and keep a record of every offer update in one place.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {offer && <OfferStatusBadge status={offer.status} />}
                    {offer && (
                      <Button
                        variant="outline"
                        onClick={() => downloadOfferDocument(application, { generatedFor: 'candidate' })}
                      >
                        Download Offer PDF
                      </Button>
                    )}
                    {canOpenHandoff && (
                      <Button
                        variant="outline"
                        onClick={() => navigate(`/my-applications/${application.id}/handoff`)}
                      >
                        View Handoff
                      </Button>
                    )}
                    {canOpenOnboarding && (
                      <Button
                        variant="outline"
                        onClick={() => navigate(`/my-applications/${application.id}/onboarding`)}
                      >
                        Open Onboarding
                      </Button>
                    )}
                    <Button variant="outline" onClick={() => navigate('/my-applications')}>
                      Back to Applications
                    </Button>
                  </div>
                </div>
              </div>

              {error && (
                <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                  {error}
                </div>
              )}

              {success && (
                <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                  {success}
                </div>
              )}

              {!application ? (
                <div className="rounded-3xl border border-white/40 dark:border-slate-700/60 bg-white/90 dark:bg-slate-900/80 p-8 shadow-lg">
                  <p className="text-sm text-gray-600 dark:text-slate-400">The requested offer could not be loaded.</p>
                </div>
              ) : (
                <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
                  <div className="space-y-6">
                    <div className="rounded-3xl border border-white/40 dark:border-slate-700/60 bg-white/90 dark:bg-slate-900/80 p-6 shadow-lg">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-500">Role</p>
                          <p className="mt-1 text-base font-semibold text-gray-900 dark:text-slate-100">{application.job?.title || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-500">Company</p>
                          <p className="mt-1 text-base font-semibold text-gray-900 dark:text-slate-100">{application.organization?.name || 'Company'}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-500">Compensation</p>
                          <p className="mt-1 text-base font-semibold text-gray-900 dark:text-slate-100">{offer ? formatOfferCompensation(offer) : 'Preparing offer details'}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-500">Start Date</p>
                          <p className="mt-1 text-base font-semibold text-gray-900 dark:text-slate-100">{offer?.startDate ? formatDate(offer.startDate) : 'To be confirmed'}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-500">Respond By</p>
                          <p className="mt-1 text-base font-semibold text-gray-900 dark:text-slate-100">{offer?.expiresAt ? formatDate(offer.expiresAt, { showTime: true }) : 'Pending'}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-500">Application Status</p>
                          <p className="mt-1 text-base font-semibold text-gray-900 dark:text-slate-100">{application.status}</p>
                        </div>
                      </div>

                      {offer?.note && (
                        <div className="mt-5 rounded-2xl border border-amber-200/70 dark:border-amber-500/25 bg-amber-50/70 dark:bg-amber-500/10 px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-amber-700 dark:text-amber-300">Offer Note</p>
                          <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700 dark:text-slate-300">{offer.note}</p>
                        </div>
                      )}

                      {!offer && application.status === 'OFFER' && (
                        <div className="mt-5 rounded-2xl border border-blue-200/70 dark:border-blue-500/25 bg-blue-50/70 dark:bg-blue-500/10 px-4 py-3 text-sm text-blue-700 dark:text-blue-200">
                          The hiring team has moved you into the offer stage and is preparing the final details.
                        </div>
                      )}

                      {offer && offerExpired && offerStatus === 'PENDING' && (
                        <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                          This offer has expired. Contact the hiring team if you need an updated offer.
                        </div>
                      )}

                      {offerStatus === 'DECLINED' && offer?.declineReason && (
                        <div className="mt-5 rounded-2xl border border-rose-200/70 dark:border-rose-500/25 bg-white/80 dark:bg-slate-950/70 px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-rose-700 dark:text-rose-300">Your decline note</p>
                          <p className="mt-2 text-sm text-gray-700 dark:text-slate-300">{offer.declineReason}</p>
                        </div>
                      )}

                      {canOpenHandoff && (
                        <div className="mt-5 rounded-2xl border border-emerald-200/70 dark:border-emerald-500/25 bg-emerald-50/70 dark:bg-emerald-500/10 px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-emerald-700 dark:text-emerald-300">
                            Hired
                          </p>
                          <p className="mt-2 text-sm text-gray-700 dark:text-slate-300">
                            Your offer is complete and your hiring handoff is ready. Review next steps before your start date.
                          </p>
                          <div className="mt-3">
                            <Button variant="outline" onClick={() => navigate(`/my-applications/${application.id}/handoff`)}>
                              Open Handoff
                            </Button>
                            <Button variant="outline" onClick={() => navigate(`/my-applications/${application.id}/onboarding`)}>
                              Open Onboarding
                            </Button>
                          </div>
                        </div>
                      )}

                      {canRespond && (
                        <div className="mt-6 space-y-3">
                          <div className="flex flex-wrap gap-3">
                            <Button onClick={handleAccept} loading={submitting} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                              Accept Offer
                            </Button>
                            <Button variant="outline" onClick={() => setShowDeclineForm((previous) => !previous)} disabled={submitting}>
                              Decline Offer
                            </Button>
                          </div>
                          {showDeclineForm && (
                            <div className="space-y-3 rounded-2xl border border-gray-200 dark:border-slate-700 bg-white/70 dark:bg-slate-950/60 p-4">
                              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                                Optional note for the hiring team
                              </label>
                              <textarea
                                value={declineReason}
                                onChange={(event) => setDeclineReason(event.target.value)}
                                placeholder="Explain your reason if you want the hiring team to see it."
                                className="min-h-[120px] w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                              />
                              <div className="flex gap-3">
                                <Button variant="outline" onClick={() => { setShowDeclineForm(false); setDeclineReason(''); }} disabled={submitting}>
                                  Cancel
                                </Button>
                                <Button onClick={handleDecline} loading={submitting} disabled={submitting} className="bg-rose-600 hover:bg-rose-700 text-white">
                                  Confirm Decline
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
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
                          <p className="text-sm text-gray-600 dark:text-slate-400">Every offer update and response in one place.</p>
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
                              {entry.offer?.title && (
                                <p className="mt-1 text-sm text-gray-700 dark:text-slate-300">{entry.offer.title}</p>
                              )}
                              {entry.offer && (
                                <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{formatOfferCompensation(entry.offer) || 'Compensation unavailable'}</p>
                              )}
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

export default CandidateOfferPage;
