/**
 * Recording Consent Screen
 *
 * Explicit consent for recording (audio and video) before starting an interview session.
 * Aligns with FR2: Consent and user controls for recorded text/audio/video.
 * User must actively agree before the interview UI and recording can begin.
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const RECORDING_CONSENT_VERSION = '1.0';

const RecordingConsentScreen = ({ onConsentGiven }) => {
  const [consentRecording, setConsentRecording] = useState(false);
  const [consentPrivacy, setConsentPrivacy] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canContinue = consentRecording && !isSubmitting;
  const checkboxBaseClass = 'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors';

  const handleContinue = async () => {
    if (!canContinue) return;
    setIsSubmitting(true);
    try {
      await onConsentGiven({
        recordingConsentGivenAt: new Date().toISOString(),
        recordingConsentVersion: RECORDING_CONSENT_VERSION,
        consentRecording,
        consentPrivacy,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/95 dark:bg-slate-950/98 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl dark:shadow-slate-950/50 overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400">
              <Icon name="Mic" className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                Recording consent
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Required before starting your interview
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
            This interview session will <strong>record your audio and video</strong> for:
          </p>
          <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-2 list-disc list-inside pl-1">
            <li>Speech-to-text transcription of your answers</li>
            <li>Evaluation and feedback on your responses</li>
            <li>Optional body language and presence analysis (if enabled)</li>
            <li>Session review by you and, in hiring mode, by recruiters</li>
          </ul>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            Recordings and transcripts are stored securely and handled according to our{' '}
            <Link
              to="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              Privacy Policy
            </Link>
            . You can end the session at any time.
          </p>

          {/* Required consent */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={consentRecording}
              onChange={(e) => setConsentRecording(e.target.checked)}
              className="sr-only"
              data-testid="consent-recording"
            />
            <span
              className={`${checkboxBaseClass} ${
                consentRecording
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-slate-300 bg-white text-transparent dark:border-slate-500 dark:bg-slate-800'
              }`}
              aria-hidden="true"
            >
              <Icon name="Check" size={12} className="text-current" />
            </span>
            <span className="text-sm text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100">
              <strong>I consent to this session being recorded (audio and video)</strong> and to the use of this data as described above.
            </span>
          </label>

          {/* Optional privacy acknowledgment */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={consentPrivacy}
              onChange={(e) => setConsentPrivacy(e.target.checked)}
              className="sr-only"
              data-testid="consent-privacy"
            />
            <span
              className={`${checkboxBaseClass} ${
                consentPrivacy
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-slate-300 bg-white text-transparent dark:border-slate-500 dark:bg-slate-800'
              }`}
              aria-hidden="true"
            >
              <Icon name="Check" size={12} className="text-current" />
            </span>
            <span className="text-sm text-slate-600 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300">
              I have read the{' '}
              <Link
                to="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                Privacy Policy
              </Link>
              {' '}and agree to the use of my data as described.
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <Button
            variant="default"
            size="lg"
            onClick={handleContinue}
            disabled={!canContinue}
            loading={isSubmitting}
            iconName="Check"
            fullWidth
            className="sm:w-auto"
          >
            I Agree and Continue
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default RecordingConsentScreen;
export { RECORDING_CONSENT_VERSION };
