import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '../AppIcon';
import Button from './Button';

const SESSION_DISMISSED_KEY = 'pwa_install_dismissed_session';

function isStandaloneMode() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches
    || window.navigator.standalone === true
  );
}

function isDismissedForSession() {
  try {
    return window.sessionStorage.getItem(SESSION_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

function dismissForSession() {
  try {
    window.sessionStorage.setItem(SESSION_DISMISSED_KEY, '1');
  } catch {
    // Ignore storage failures (private mode / strict browser settings).
  }
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const [installed, setInstalled] = useState(false);
  const dismissedForSessionRef = useRef(isDismissedForSession());

  useEffect(() => {
    if (isStandaloneMode() || dismissedForSessionRef.current) return undefined;

    let showTimerId = null;

    const handleBeforeInstallPrompt = (e) => {
      if (dismissedForSessionRef.current) return;
      e.preventDefault();
      setDeferredPrompt(e);
      showTimerId = window.setTimeout(() => setVisible(true), 3000);
    };

    const handleAppInstalled = () => {
      setInstalled(true);
      setVisible(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      if (showTimerId !== null) {
        window.clearTimeout(showTimerId);
      }
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstalled(true);
    }
    setVisible(false);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setVisible(false);
    setDeferredPrompt(null);
    dismissForSession();
    dismissedForSessionRef.current = true;
  };

  return (
    <AnimatePresence>
      {visible && !installed && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 30 }}
          className="fixed left-0 right-0 top-[calc(1rem+env(safe-area-inset-top))] z-[9990] mx-auto w-fit max-w-[calc(100vw-2rem)]"
        >
          <div className="rounded-2xl border border-blue-200 dark:border-blue-700/50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-2xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
                <Icon name="Download" size={18} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                  Install App
                </p>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  Add to your home screen for quick access and offline support.
                </p>
                <div className="mt-3 flex items-center justify-center gap-2">
                  <Button size="sm" onClick={handleInstall} className="text-xs">
                    Install
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleDismiss} className="text-xs text-gray-500">
                    Not now
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
