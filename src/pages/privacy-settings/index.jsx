import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/ui/Header';
import UserContextNavigation from '../../components/ui/UserContextNavigation';
import MaintenanceBanner from '../../components/ui/MaintenanceBanner';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Checkbox';
import LoadingState from '../../components/ui/LoadingState';
import apiClient from '../../services/apiClient.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useMaintenanceMode } from '../../hooks/useMaintenanceMode';
import TwoFASettings from '../../components/ui/TwoFASettings';
import {
  DEFAULT_CONSENT,
  readStoredConsent,
  writeStoredConsent,
} from '../../services/cookieConsent.js';

const Section = ({ title, icon, children }) => (
  <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-5 sm:p-6 shadow-lg space-y-4">
    <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2">
      <Icon name={icon} size={16} className="text-blue-500" />
      {title}
    </h2>
    {children}
  </div>
);

const PrivacySettingsPage = () => {
  const { user, logout } = useAuth();
  const { maintenanceMode } = useMaintenanceMode();
  const navigate = useNavigate();
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);

  const [consent, setConsent] = useState(DEFAULT_CONSENT);
  const [consentLoading, setConsentLoading] = useState(true);
  const [consentSaving, setConsentSaving] = useState(false);
  const [consentMsg, setConsentMsg] = useState(null);

  const [exportLoading, setExportLoading] = useState(false);
  const [exportMsg, setExportMsg] = useState(null);

  const [deletionLoading, setDeletionLoading] = useState(false);
  const [deletionMsg, setDeletionMsg] = useState(null);
  const [pendingDeletion, setPendingDeletion] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const userType = user?.accountType === 'COMPANY' ? 'company'
    : user?.accountType === 'CANDIDATE' ? 'candidate'
    : ['ADMIN', 'SYSTEM_ADMIN'].includes(user?.accountType) ? 'admin'
    : null;

  useEffect(() => {
    const load = async () => {
      setConsentLoading(true);
      const localConsent = readStoredConsent();
      if (localConsent) {
        setConsent(localConsent);
      }

      try {
        const res = await apiClient.gdpr.getConsent();
        if (res?.consent) {
          const synced = writeStoredConsent(res.consent);
          setConsent({
            functional: synced.functional,
            analytics: synced.analytics,
            marketing: synced.marketing,
          });
        }
      } catch {
        // Keep local fallback when server fetch is unavailable.
      } finally {
        setConsentLoading(false);
      }
    };
    load();
    setPendingDeletion(Boolean(user?.pendingDeletion));
  }, [user]);

  const handleSaveConsent = async () => {
    setConsentSaving(true);
    setConsentMsg(null);
    writeStoredConsent(consent);
    try {
      await apiClient.gdpr.saveConsent(consent);
      setConsentMsg({ type: 'success', text: 'Preferences saved.' });
    } catch (err) {
      setConsentMsg({ type: 'warning', text: err?.message || 'Saved locally, but failed to sync to your account.' });
    } finally {
      setConsentSaving(false);
    }
  };

  const handleExport = async () => {
    setExportLoading(true);
    setExportMsg(null);
    try {
      const res = await apiClient.gdpr.exportData();
      if (res?.data) {
        const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `my-data-export-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        setExportMsg({ type: 'success', text: 'Your data has been downloaded.' });
      }
    } catch (err) {
      setExportMsg({ type: 'error', text: err?.message || 'Export failed.' });
    } finally {
      setExportLoading(false);
    }
  };

  const handleRequestDeletion = async () => {
    setDeletionLoading(true);
    setDeletionMsg(null);
    try {
      const res = await apiClient.gdpr.requestDeletion();
      setDeletionMsg({ type: 'success', text: res?.message || 'Deletion requested.' });
      setPendingDeletion(true);
      setShowDeleteConfirm(false);
    } catch (err) {
      setDeletionMsg({ type: 'error', text: err?.message || 'Failed to request deletion.' });
    } finally {
      setDeletionLoading(false);
    }
  };

  const handleCancelDeletion = async () => {
    setDeletionLoading(true);
    setDeletionMsg(null);
    try {
      const res = await apiClient.gdpr.cancelDeletion();
      setDeletionMsg({ type: 'success', text: res?.message || 'Deletion cancelled.' });
      setPendingDeletion(false);
    } catch (err) {
      setDeletionMsg({ type: 'error', text: err?.message || 'Failed to cancel.' });
    } finally {
      setDeletionLoading(false);
    }
  };

  if (consentLoading) {
    return (
      <LoadingState title="Loading privacy settings" message="Please wait..." variant="fullscreen" tone="primary" />
    );
  }

  return (
    <div className="dashboard-shell">
      <Header userType={userType} isAuthenticated onLogout={async () => { await logout(); navigate('/login'); }} />
      {maintenanceMode && <MaintenanceBanner />}
      <div className="h-14 xs:h-16" />
      <div className="relative z-10 flex flex-col lg:flex-row">
        <UserContextNavigation userType={userType} isCollapsed={isNavCollapsed} onToggleCollapse={() => setIsNavCollapsed(!isNavCollapsed)} />
        <main className={`flex-1 transition-all duration-300 pb-20 lg:pb-0 ${isNavCollapsed ? 'lg:ml-20' : 'lg:ml-72 xl:ml-80'}`}>
          <div className="container-responsive py-6 xs:py-8 sm:py-10 space-y-6">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Privacy & Data</h1>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                Manage your data, consent preferences and account deletion rights under GDPR.
              </p>
            </motion.div>

            {/* Two-Factor Authentication */}
            <Section title="Two-Factor Authentication" icon="ShieldCheck">
              <p className="text-sm text-gray-600 dark:text-slate-400">
                Add an extra layer of security to your account. Once enabled, you'll be asked for a
                verification code in addition to your password when logging in.
              </p>
              <TwoFASettings />
            </Section>

            {/* Cookie Consent */}
            <Section title="Cookie & Tracking Preferences" icon="Cookie">
              <div className="space-y-3">
                {[
                  { key: 'functional', label: 'Functional (required)', desc: 'Enables core site features such as login and settings.', disabled: true },
                  { key: 'analytics', label: 'Analytics', desc: 'Helps us understand how you use the platform so we can improve it.' },
                  { key: 'marketing', label: 'Marketing', desc: 'Allows personalised recommendations and occasional promotional content.' },
                ].map(({ key, label, desc, disabled }) => (
                  <Checkbox
                    key={key}
                    checked={consent[key]}
                    disabled={disabled}
                    onChange={(e) => setConsent((p) => ({ ...p, [key]: e.target.checked }))}
                    label={<span className="text-sm font-medium text-gray-800 dark:text-slate-200">{label}</span>}
                    description={desc}
                    className={disabled ? 'opacity-60' : ''}
                    size="default"
                  />
                ))}
              </div>
              {consentMsg && (
                <p className={`text-xs mt-1 ${consentMsg.type === 'success' ? 'text-green-600' : consentMsg.type === 'warning' ? 'text-amber-600' : 'text-red-500'}`}>
                  {consentMsg.text}
                </p>
              )}
              <Button onClick={handleSaveConsent} disabled={consentSaving} size="sm" className="mt-1">
                {consentSaving ? 'Saving…' : 'Save preferences'}
              </Button>
            </Section>

            {/* Data Export */}
            <Section title="Download Your Data" icon="Download">
              <p className="text-sm text-gray-600 dark:text-slate-400">
                Under GDPR Article 20 (right to data portability) you can download a complete copy of all data
                we hold about you, including your profile, interviews, applications, and activity.
              </p>
              {exportMsg && (
                <p className={`text-xs ${exportMsg.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                  {exportMsg.text}
                </p>
              )}
              <Button
                onClick={handleExport}
                disabled={exportLoading}
                iconName="Download"
                size="sm"
                variant="outline"
              >
                {exportLoading ? 'Exporting…' : 'Export my data (JSON)'}
              </Button>
            </Section>

            {/* Account Deletion */}
            <Section title="Delete Account & Data" icon="Trash2">
              {pendingDeletion ? (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 p-4 space-y-3">
                  <p className="text-sm text-amber-800 dark:text-amber-300 font-medium flex items-center gap-2">
                    <Icon name="AlertTriangle" size={16} />
                    Account deletion is scheduled
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Your account and all associated data will be permanently deleted within 30 days.
                    You can cancel this request before the grace period expires.
                  </p>
                  {deletionMsg && (
                    <p className={`text-xs ${deletionMsg.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                      {deletionMsg.text}
                    </p>
                  )}
                  <Button
                    onClick={handleCancelDeletion}
                    disabled={deletionLoading}
                    variant="outline"
                    size="sm"
                  >
                    {deletionLoading ? 'Cancelling…' : 'Cancel deletion request'}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600 dark:text-slate-400">
                    Under GDPR Article 17 (right to erasure) you may request permanent deletion of your account and all
                    data. This action includes a 30-day grace period during which you can cancel.
                  </p>
                  {deletionMsg && (
                    <p className={`text-xs ${deletionMsg.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                      {deletionMsg.text}
                    </p>
                  )}
                  {showDeleteConfirm ? (
                    <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 p-4 space-y-3">
                      <p className="text-sm text-red-800 dark:text-red-300 font-medium">
                        Are you sure? This cannot be undone after the 30-day grace period.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          onClick={handleRequestDeletion}
                          disabled={deletionLoading}
                          size="sm"
                          className="bg-red-600 hover:bg-red-700 text-white"
                        >
                          {deletionLoading ? 'Submitting…' : 'Yes, request deletion'}
                        </Button>
                        <Button
                          onClick={() => setShowDeleteConfirm(false)}
                          variant="outline"
                          size="sm"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      onClick={() => setShowDeleteConfirm(true)}
                      variant="outline"
                      size="sm"
                      iconName="Trash2"
                      className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400"
                    >
                      Request account deletion
                    </Button>
                  )}
                </div>
              )}
            </Section>

            {/* Info */}
            <Section title="Your Rights Under GDPR" icon="Shield">
              <ul className="space-y-2 text-sm text-gray-600 dark:text-slate-400">
                {[
                  ['Right of Access (Art. 15)', 'Export your data above at any time.'],
                  ['Right to Rectification (Art. 16)', 'Update your profile in account settings.'],
                  ['Right to Erasure (Art. 17)', 'Request deletion above.'],
                  ['Right to Portability (Art. 20)', 'Download your data in machine-readable JSON.'],
                  ['Right to Object (Art. 21)', 'Opt out of analytics and marketing above.'],
                ].map(([right, action]) => (
                  <li key={right} className="flex gap-2">
                    <Icon name="CheckCircle" size={15} className="text-green-500 mt-0.5 shrink-0" />
                    <span><strong className="text-gray-800 dark:text-slate-200">{right}</strong> — {action}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-2">
                For any data protection queries contact{' '}
                <a href="mailto:privacy@interviewer.app" className="text-blue-600 dark:text-blue-400 hover:underline">
                  privacy@interviewer.app
                </a>.
              </p>
            </Section>
          </div>
        </main>
      </div>
    </div>
  );
};

export default PrivacySettingsPage;
