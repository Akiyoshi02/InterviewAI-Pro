import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '../AppIcon';
import Button from './Button';
import apiClient from '../../services/apiClient.js';


/**
 * Self-contained 2FA settings panel.
 * Supports:
 *  - TOTP (authenticator app) with QR code setup
 *  - Email OTP enable/verify
 *  - Backup codes display
 *  - Disable TOTP
 */
export default function TwoFASettings() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeFlow, setActiveFlow] = useState(null); // 'totp-setup' | 'email-setup' | 'disable'

  // TOTP setup state
  const [qrCode, setQrCode] = useState(null);
  const [manualKey, setManualKey] = useState(null);
  const [totpToken, setTotpToken] = useState('');
  const [backupCodes, setBackupCodes] = useState(null);

  // Email OTP state
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailOtp, setEmailOtp] = useState('');

  // Disable state
  const [disableToken, setDisableToken] = useState('');

  const [msg, setMsg] = useState(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const json = await apiClient.twofa.getStatus();
      if (json.success) setStatus(json);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  };

  // ── TOTP Setup ──────────────────────────────────────────────────────────

  const startTotpSetup = async () => {
    setWorking(true);
    setMsg(null);
    try {
      const res = await apiClient.twofa.totpSetup();
      if (res.success) {
        setQrCode(res.qrCodeDataUrl);
        setManualKey(res.manualEntryKey);
        setActiveFlow('totp-setup');
      } else {
        setMsg({ type: 'error', text: res.error || 'Setup failed.' });
      }
    } finally {
      setWorking(false);
    }
  };

  const confirmTotpSetup = async () => {
    if (!totpToken.trim()) return;
    setWorking(true);
    setMsg(null);
    try {
      const res = await apiClient.twofa.totpVerify(totpToken);
      if (res.success) {
        setBackupCodes(res.backupCodes);
        setActiveFlow('totp-backup');
        await loadStatus();
      } else {
        setMsg({ type: 'error', text: res.error || 'Invalid code.' });
      }
    } finally {
      setWorking(false);
    }
  };

  const disableTotp = async () => {
    if (!disableToken.trim()) return;
    setWorking(true);
    setMsg(null);
    try {
      const res = await apiClient.twofa.totpDisable(disableToken);
      if (res.success) {
        setMsg({ type: 'success', text: 'Authenticator app removed.' });
        setActiveFlow(null);
        await loadStatus();
      } else {
        setMsg({ type: 'error', text: res.error || 'Failed.' });
      }
    } finally {
      setWorking(false);
    }
  };

  // ── Email OTP Setup ─────────────────────────────────────────────────────

  const sendEmailOtp = async () => {
    setWorking(true);
    setMsg(null);
    try {
      const res = await apiClient.twofa.emailSend();
      if (res.success) {
        setEmailOtpSent(true);
        setActiveFlow('email-setup');
      } else {
        setMsg({ type: 'error', text: res.error || 'Failed to send code.' });
      }
    } finally {
      setWorking(false);
    }
  };

  const verifyEmailOtp = async () => {
    if (!emailOtp.trim()) return;
    setWorking(true);
    setMsg(null);
    try {
      const res = await apiClient.twofa.emailVerify(emailOtp);
      if (res.success) {
        setMsg({ type: 'success', text: 'Email OTP 2FA enabled.' });
        setActiveFlow(null);
        await loadStatus();
      } else {
        setMsg({ type: 'error', text: res.error || 'Invalid code.' });
      }
    } finally {
      setWorking(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400">
        <Icon name="Loader2" size={15} className="animate-spin" />
        Loading security settings…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status badge */}
      <div className="flex items-center gap-3">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
          status?.twoFaEnabled
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            : 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-400'
        }`}>
          <Icon name={status?.twoFaEnabled ? 'ShieldCheck' : 'ShieldOff'} size={13} />
          {status?.twoFaEnabled ? `2FA enabled (${status.method})` : '2FA disabled'}
        </span>
        {status?.twoFaEnabled && status?.backupCodesRemaining > 0 && (
          <span className="text-xs text-gray-500 dark:text-slate-400">
            {status.backupCodesRemaining} backup codes remaining
          </span>
        )}
      </div>

      {msg && (
        <p className={`text-sm ${msg.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>{msg.text}</p>
      )}

      {/* Active flows */}
      <AnimatePresence mode="wait">

        {/* TOTP Setup – scan QR */}
        {activeFlow === 'totp-setup' && (
          <motion.div key="totp-setup" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="space-y-4 rounded-xl border border-blue-200 dark:border-blue-800/50 bg-blue-50/50 dark:bg-blue-900/10 p-4"
          >
            <p className="text-sm font-medium text-gray-800 dark:text-slate-200">
              1. Scan this QR code with your authenticator app (e.g. Google Authenticator, Authy):
            </p>
            {qrCode && <img src={qrCode} alt="QR Code" className="w-40 h-40 rounded-lg border border-white shadow" />}
            <details className="text-xs text-gray-500 dark:text-slate-400">
              <summary className="cursor-pointer hover:text-blue-600">Can't scan? Enter manually</summary>
              <code className="block mt-2 font-mono bg-gray-100 dark:bg-slate-700 px-3 py-1.5 rounded break-all">{manualKey}</code>
            </details>
            <p className="text-sm font-medium text-gray-800 dark:text-slate-200">2. Enter the 6-digit code from your app:</p>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={totpToken}
                onChange={(e) => setTotpToken(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="w-32 text-center text-lg font-mono rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Button onClick={confirmTotpSetup} disabled={working || totpToken.length < 6} size="sm">
                {working ? 'Verifying…' : 'Activate'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setActiveFlow(null); setTotpToken(''); }}>Cancel</Button>
            </div>
          </motion.div>
        )}

        {/* TOTP – backup codes */}
        {activeFlow === 'totp-backup' && backupCodes && (
          <motion.div key="totp-backup" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="space-y-3 rounded-xl border border-green-200 dark:border-green-800/50 bg-green-50/50 dark:bg-green-900/10 p-4"
          >
            <p className="text-sm font-semibold text-green-800 dark:text-green-300 flex items-center gap-2">
              <Icon name="CheckCircle" size={15} />
              TOTP 2FA activated! Save your backup codes now.
            </p>
            <p className="text-xs text-gray-600 dark:text-slate-400">
              If you lose access to your authenticator app, use one of these one-time codes to log in.
              Each code can only be used once.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {backupCodes.map((code) => (
                <code key={code} className="font-mono text-sm bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded px-3 py-1.5 text-center">
                  {code}
                </code>
              ))}
            </div>
            <Button size="sm" onClick={() => setActiveFlow(null)}>Done – I've saved my codes</Button>
          </motion.div>
        )}

        {/* Email OTP setup */}
        {activeFlow === 'email-setup' && (
          <motion.div key="email-setup" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="space-y-3 rounded-xl border border-blue-200 dark:border-blue-800/50 bg-blue-50/50 dark:bg-blue-900/10 p-4"
          >
            <p className="text-sm text-gray-700 dark:text-slate-300">
              A 6-digit code has been sent to your email. Enter it below to enable email OTP verification.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={emailOtp}
                onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="w-32 text-center text-lg font-mono rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Button onClick={verifyEmailOtp} disabled={working || emailOtp.length < 6} size="sm">
                {working ? 'Verifying…' : 'Confirm'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setActiveFlow(null); setEmailOtp(''); }}>Cancel</Button>
            </div>
          </motion.div>
        )}

        {/* Disable TOTP */}
        {activeFlow === 'disable' && (
          <motion.div key="disable" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="space-y-3 rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50/50 dark:bg-red-900/10 p-4"
          >
            <p className="text-sm text-gray-700 dark:text-slate-300">
              Enter a current 6-digit code from your authenticator to disable TOTP.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={disableToken}
                onChange={(e) => setDisableToken(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="w-32 text-center text-lg font-mono rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <Button
                onClick={disableTotp}
                disabled={working || disableToken.length < 6}
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {working ? 'Disabling…' : 'Disable TOTP'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setActiveFlow(null); setDisableToken(''); }}>Cancel</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action buttons when no flow active */}
      {!activeFlow && (
        <div className="flex flex-wrap gap-2">
          {!status?.totpEnabled && (
            <Button
              onClick={startTotpSetup}
              disabled={working}
              size="sm"
              iconName="Smartphone"
              variant="outline"
            >
              {working ? 'Loading…' : 'Set up Authenticator App (TOTP)'}
            </Button>
          )}
          {!status?.emailOtpEnabled && (
            <Button
              onClick={sendEmailOtp}
              disabled={working}
              size="sm"
              iconName="Mail"
              variant="outline"
            >
              {working ? 'Sending…' : 'Enable Email OTP'}
            </Button>
          )}
          {status?.totpEnabled && (
            <Button
              onClick={() => setActiveFlow('disable')}
              size="sm"
              variant="outline"
              iconName="ShieldOff"
              className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400"
            >
              Remove Authenticator App
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
