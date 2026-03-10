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
import { hasPermission } from '../../utils/rolePermissions.js';
import {
  canAccessApplicationOnboarding,
  formatOfferCompensation,
  formatOfferHistoryEventLabel,
} from '../../utils/applicationOfferPresentation.js';
import {
  buildInitialOfferDraft,
  buildOfferPayloadFromDraft,
  OFFER_COMPENSATION_PERIOD_OPTIONS,
  validateOfferDraft,
} from '../../utils/applicationOfferForm.js';
import { downloadOfferDocument } from '../../utils/offerDocument.js';

const formatDate = (value, options = {}) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString(undefined, options.showTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' });
};

const OFFER_STATUS_LABELS = {
  PENDING: 'Pending Candidate Response',
  ACCEPTED: 'Accepted',
  DECLINED: 'Declined',
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
      {OFFER_STATUS_LABELS[normalized] || normalized || 'Pending'}
    </span>
  );
};

const CompanyOfferPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user, logout, status } = useAuth();
  const { maintenanceMode } = useMaintenanceMode();
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resending, setResending] = useState(false);
  const [application, setApplication] = useState(null);
  const [offerDraft, setOfferDraft] = useState(() => buildInitialOfferDraft(null));
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const organizationRole = (user?.organizationContext?.membership?.role || '').toString().toUpperCase();
  const canEditOffer = hasPermission(organizationRole, 'UPDATE_APPLICATION_STATUS');

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
        throw new Error(result?.error || 'Failed to load the offer workspace.');
      }
      setApplication(result.application);
      setOfferDraft(buildInitialOfferDraft(result.application));
    } catch (loadError) {
      setError(loadError.message || 'Failed to load the offer workspace.');
      setApplication(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadApplication();
  }, [loadApplication]);

  useEffect(() => {
    document.title = 'Offer Workspace - InterviewAI Pro';
  }, []);

  const offer = application?.offer || null;
  const history = useMemo(() => Array.isArray(application?.offerHistory) ? application.offerHistory : [], [application?.offerHistory]);
  const onboardingReady = canAccessApplicationOnboarding(application);

  const handleDraftChange = (field, value) => {
    setOfferDraft((previous) => ({ ...previous, [field]: value }));
    setSuccess('');
  };

  const handleSave = async () => {
    if (!application?.id || !canEditOffer) return;
    const validationMessage = validateOfferDraft(offerDraft);
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const result = await apiClient.applications.upsertOffer(application.id, buildOfferPayloadFromDraft(offerDraft));
      if (!result?.success || !result?.application) {
        throw new Error(result?.error || 'Failed to save offer details.');
      }
      setApplication(result.application);
      setOfferDraft(buildInitialOfferDraft(result.application));
      setSuccess(result.message || 'Offer details saved.');
    } catch (saveError) {
      setError(saveError.message || 'Failed to save offer details.');
    } finally {
      setSaving(false);
    }
  };

  const handleResend = async () => {
    if (!application?.id || !canEditOffer) return;
    setResending(true);
    setError('');
    setSuccess('');
    try {
      const result = await apiClient.applications.resendOffer(application.id);
      if (!result?.success || !result?.application) {
        throw new Error(result?.error || 'Failed to resend the offer.');
      }
      setApplication(result.application);
      setOfferDraft(buildInitialOfferDraft(result.application));
      setSuccess(result.message || 'Offer email resent successfully.');
    } catch (resendError) {
      setError(resendError.message || 'Failed to resend the offer.');
    } finally {
      setResending(false);
    }
  };

  if (status === 'loading' || !user || loading) {
    return (
      <LoadingState
        title="Loading offer workspace"
        message="Preparing the hiring team's offer details."
        variant="fullscreen"
        tone="primary"
      />
    );
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 transition-colors duration-300">
      <Header
        userType="company"
        isAuthenticated
        onLogout={handleLogout}
        organizationRole={user?.organizationContext?.membership?.role}
      />

      {maintenanceMode && <MaintenanceBanner />}

      <div className="h-14 xs:h-16" />

      <div className="relative z-10">
        <div className="flex flex-col lg:flex-row">
          <UserContextNavigation
            userType="company"
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
                    <div className="rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 p-3 shadow-lg shadow-amber-500/25">
                      <Icon name="Briefcase" className="h-7 w-7 text-white" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-600 dark:text-amber-300">
                        Offer Workspace
                      </p>
                      <h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-slate-100">
                        {offer?.title || application?.job?.title || 'Structured Offer'}
                      </h1>
                      <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">
                        Manage the final offer, track every resend and response, and export a clean hiring record for the candidate.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {offer && <OfferStatusBadge status={offer.status} />}
                    {offer && (
                      <Button variant="outline" onClick={() => downloadOfferDocument(application, { generatedFor: 'company' })}>
                        Download Offer PDF
                      </Button>
                    )}
                    {onboardingReady && (
                      <Button variant="outline" onClick={() => navigate(`/company-applications/${application.id}/onboarding`)}>
                        Open Onboarding
                      </Button>
                    )}
                    <Button variant="outline" onClick={() => navigate('/company-applications')}>
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

              {success && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                  {success}
                </div>
              )}

              {!application ? (
                <div className="rounded-3xl border border-white/40 dark:border-slate-700/60 bg-white/90 dark:bg-slate-900/80 p-8 shadow-lg">
                  <p className="text-sm text-gray-600 dark:text-slate-400">The requested application could not be loaded.</p>
                </div>
              ) : (
                <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
                  <div className="space-y-6">
                    <div className="rounded-3xl border border-white/40 dark:border-slate-700/60 bg-white/90 dark:bg-slate-900/80 p-6 shadow-lg">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-500">Candidate</p>
                          <p className="mt-1 text-base font-semibold text-gray-900 dark:text-slate-100">{application.candidate?.fullName || 'Candidate'}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-500">Company</p>
                          <p className="mt-1 text-base font-semibold text-gray-900 dark:text-slate-100">{application.organization?.name || 'Company'}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-500">Role</p>
                          <p className="mt-1 text-base font-semibold text-gray-900 dark:text-slate-100">{application.job?.title || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-500">Application Status</p>
                          <p className="mt-1 text-base font-semibold text-gray-900 dark:text-slate-100">{application.status}</p>
                        </div>
                      </div>

                      {offer?.declineReason && (
                        <div className="mt-5 rounded-2xl border border-rose-200/70 dark:border-rose-500/25 bg-rose-50/70 dark:bg-rose-500/10 px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-rose-700 dark:text-rose-300">Candidate decline note</p>
                          <p className="mt-2 text-sm text-gray-700 dark:text-slate-300">{offer.declineReason}</p>
                        </div>
                      )}
                    </div>

                    <div className="rounded-3xl border border-amber-200/70 dark:border-amber-500/25 bg-amber-50/60 dark:bg-amber-500/8 p-6 shadow-lg">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Offer Details</h2>
                          <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
                            Keep the candidate-facing offer, resend history, and compensation details in one ATS workspace.
                          </p>
                        </div>
                        {offer && <OfferStatusBadge status={offer.status} />}
                      </div>

                      {offer && (
                        <div className="mt-5 rounded-2xl border border-white/60 dark:border-slate-700/60 bg-white/70 dark:bg-slate-950/60 px-4 py-4">
                          <div className="grid gap-3 text-xs text-gray-600 dark:text-slate-400 sm:grid-cols-3">
                            <div>
                              <p className="font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-500">Compensation</p>
                              <p className="mt-1 text-sm text-gray-900 dark:text-slate-100">
                                {formatOfferCompensation(offer) || 'Not set'}
                              </p>
                            </div>
                            <div>
                              <p className="font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-500">Last Sent</p>
                              <p className="mt-1 text-sm text-gray-900 dark:text-slate-100">
                                {offer.sentAt ? formatDate(offer.sentAt, { showTime: true }) : 'Not sent'}
                              </p>
                            </div>
                            <div>
                              <p className="font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-500">Response</p>
                              <p className="mt-1 text-sm text-gray-900 dark:text-slate-100">
                                {offer.respondedAt ? formatDate(offer.respondedAt, { showTime: true }) : 'Awaiting candidate response'}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-slate-300">Offer Title</label>
                          <input
                            value={offerDraft.title}
                            onChange={(event) => handleDraftChange('title', event.target.value)}
                            disabled={!canEditOffer || saving}
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-slate-300">Compensation Amount</label>
                          <input
                            type="number"
                            value={offerDraft.compensationAmount}
                            onChange={(event) => handleDraftChange('compensationAmount', event.target.value)}
                            disabled={!canEditOffer || saving}
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-slate-300">Currency</label>
                          <input
                            value={offerDraft.compensationCurrency}
                            onChange={(event) => handleDraftChange('compensationCurrency', event.target.value.toUpperCase())}
                            disabled={!canEditOffer || saving}
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-slate-300">Compensation Period</label>
                          <select
                            value={offerDraft.compensationPeriod}
                            onChange={(event) => handleDraftChange('compensationPeriod', event.target.value)}
                            disabled={!canEditOffer || saving}
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          >
                            {OFFER_COMPENSATION_PERIOD_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-slate-300">Start Date</label>
                          <input
                            type="date"
                            value={offerDraft.startDate}
                            onChange={(event) => handleDraftChange('startDate', event.target.value)}
                            disabled={!canEditOffer || saving}
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-slate-300">Offer Expiry</label>
                          <input
                            type="datetime-local"
                            value={offerDraft.expiresAt}
                            onChange={(event) => handleDraftChange('expiresAt', event.target.value)}
                            disabled={!canEditOffer || saving}
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-blue-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          />
                        </div>
                      </div>

                      <div className="mt-4">
                        <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-slate-300">Offer Note</label>
                        <textarea
                          value={offerDraft.note}
                          onChange={(event) => handleDraftChange('note', event.target.value)}
                          disabled={!canEditOffer || saving}
                          placeholder="Summarize compensation context, joining expectations, or next steps."
                          className="min-h-[120px] w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        />
                      </div>

                      {canEditOffer && (
                        <div className="mt-5 flex flex-wrap justify-end gap-3">
                          {offer?.status === 'PENDING' && (
                            <Button
                              variant="outline"
                              onClick={handleResend}
                              loading={resending}
                              disabled={resending || saving}
                            >
                              {!resending && <Icon name="Send" className="w-4 h-4 mr-2" />}
                              Resend Offer Email
                            </Button>
                          )}
                          <Button
                            onClick={handleSave}
                            loading={saving}
                            disabled={saving || resending}
                            className="bg-amber-600 hover:bg-amber-700 text-white"
                          >
                            {!saving && <Icon name="Briefcase" className="w-4 h-4 mr-2" />}
                            Save Offer Details
                          </Button>
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
                          <p className="text-sm text-gray-600 dark:text-slate-400">Track every offer update, resend, and candidate response.</p>
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

export default CompanyOfferPage;
