import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from './Button';
import { Checkbox } from './Checkbox';
import Icon from '../AppIcon';
import apiClient from '../../services/apiClient.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import {
  DEFAULT_CONSENT,
  readStoredConsent,
  writeStoredConsent,
} from '../../services/cookieConsent.js';

export default function CookieConsentBanner() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [prefs, setPrefs] = useState(DEFAULT_CONSENT);

  useEffect(() => {
    let isMounted = true;
    let showTimer = null;

    const hydrateConsent = async () => {
      const stored = readStoredConsent();
      if (stored) {
        if (isMounted) {
          setPrefs(stored);
          setVisible(false);
        }
        return;
      }

      if (user?.id) {
        try {
          const res = await apiClient.gdpr.getConsent();
          if (res?.consent) {
            const synced = writeStoredConsent(res.consent);
            if (isMounted) {
              setPrefs(synced);
              setVisible(false);
            }
            return;
          }
        } catch {
          // Ignore sync errors and continue to local banner fallback.
        }
      }

      showTimer = window.setTimeout(() => {
        if (isMounted) setVisible(true);
      }, 1000);
    };

    hydrateConsent();

    return () => {
      isMounted = false;
      if (showTimer) window.clearTimeout(showTimer);
    };
  }, [user?.id]);

  const persist = async (finalPrefs) => {
    const saved = writeStoredConsent(finalPrefs);
    setPrefs(saved);
    setVisible(false);
    try {
      await apiClient.gdpr.saveConsent(finalPrefs);
    } catch {
      // best-effort, don't block UI
    }
  };

  const acceptAll = () => persist({ functional: true, analytics: true, marketing: true });
  const rejectAll = () => persist({ functional: true, analytics: false, marketing: false });
  const saveCustom = () => persist(prefs);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 30 }}
          className="fixed bottom-4 left-4 right-4 z-[9999] max-w-4xl mx-auto"
        >
          <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-2xl p-5">
            <div className="flex items-start gap-3 mb-3">
              <Icon name="Cookie" size={20} className="text-amber-500 mt-0.5 shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                  We use cookies
                </h3>
                <p className="text-xs text-gray-600 dark:text-slate-400 mt-0.5">
                  We use cookies to improve your experience, analyse usage and support our services.
                  You can manage your preferences below.
                </p>
              </div>
            </div>

            <AnimatePresence>
              {showDetails && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden mb-3"
                >
                  <div className="space-y-2 border-t border-gray-100 dark:border-slate-700 pt-3">
                    {[
                      { key: 'functional', label: 'Functional (required)', desc: 'Essential for the site to work.', disabled: true },
                      { key: 'analytics', label: 'Analytics', desc: 'Help us understand how visitors use the site.' },
                      { key: 'marketing', label: 'Marketing', desc: 'Personalised content and advertisements.' },
                    ].map(({ key, label, desc, disabled }) => (
                      <Checkbox
                        key={key}
                        checked={prefs[key]}
                        disabled={disabled}
                        onChange={(e) => setPrefs((p) => ({ ...p, [key]: e.target.checked }))}
                        label={<span className="text-xs font-medium text-gray-800 dark:text-slate-200">{label}</span>}
                        description={desc}
                        className={disabled ? 'opacity-60' : ''}
                        size="sm"
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex flex-wrap gap-2 items-center justify-between">
              <button
                onClick={() => setShowDetails((v) => !v)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                {showDetails ? 'Hide options' : 'Customize'}
              </button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={rejectAll}
                  className="text-xs"
                >
                  Reject all
                </Button>
                {showDetails && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={saveCustom}
                    className="text-xs"
                  >
                    Save Preferences
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={acceptAll}
                  className="text-xs bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Accept all
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
