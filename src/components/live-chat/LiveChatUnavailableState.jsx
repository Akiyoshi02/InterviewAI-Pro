import React from 'react';
import { Mail, PhoneCall } from 'lucide-react';
import { getSupportContactEmail, getSupportMailtoHref, SUPPORT_PHONE_DISPLAY, SUPPORT_PHONE_HREF } from '../../constants/support.js';

const LiveChatUnavailableState = ({ compact = false }) => {
  const supportContactEmail = getSupportContactEmail();

  return (
    <div className={`rounded-2xl border border-amber-200/70 bg-amber-50/80 p-4 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100 ${compact ? 'space-y-3' : 'space-y-4'}`}>
      <div className="space-y-1">
        <p className={`font-semibold ${compact ? 'text-sm' : 'text-base'}`}>Live chat is unavailable right now.</p>
        <p className={compact ? 'text-xs text-amber-800/90 dark:text-amber-100/80' : 'text-sm text-amber-800/90 dark:text-amber-100/80'}>
          Support is still available by email or phone while realtime chat is offline in this environment.
        </p>
      </div>
      <div className={`grid gap-2 ${compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
        <a
          href={getSupportMailtoHref()}
          className="inline-flex items-center gap-2 rounded-full border border-amber-300/70 bg-white/80 px-3 py-2 text-sm font-medium text-amber-900 transition hover:border-amber-400 hover:bg-white dark:border-amber-500/30 dark:bg-slate-900/30 dark:text-amber-100 dark:hover:bg-slate-900/50"
        >
          <Mail className="h-4 w-4" />
          <span>{supportContactEmail}</span>
        </a>
        <a
          href={SUPPORT_PHONE_HREF}
          className="inline-flex items-center gap-2 rounded-full border border-amber-300/70 bg-white/80 px-3 py-2 text-sm font-medium text-amber-900 transition hover:border-amber-400 hover:bg-white dark:border-amber-500/30 dark:bg-slate-900/30 dark:text-amber-100 dark:hover:bg-slate-900/50"
        >
          <PhoneCall className="h-4 w-4" />
          <span>{SUPPORT_PHONE_DISPLAY}</span>
        </a>
      </div>
    </div>
  );
};

export default LiveChatUnavailableState;
