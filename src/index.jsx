import React from "react";
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App";
import "./styles/tailwind.css";
import "./styles/index.css";
import * as cookieConsentService from "./services/cookieConsent.js";

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
const CONSENT_UPDATED_EVENT = cookieConsentService.CONSENT_UPDATED_EVENT || "cookie-consent-updated";
const readStoredConsent = cookieConsentService.readStoredConsent || (() => null);
let isSentryInitialized = false;

const initSentry = () => {
  if (!SENTRY_DSN || isSentryInitialized) return;
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE || 'development',
    release: import.meta.env.VITE_APP_VERSION || '1.0.0',
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
    ],
    tracesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0,
    replaysSessionSampleRate: 0.05,
    replaysOnErrorSampleRate: 1.0,
    beforeSend(event) {
      // Strip sensitive fields from error payloads
      if (event.request?.cookies) delete event.request.cookies;
      return event;
    },
  });
  isSentryInitialized = true;
};

const disableSentry = () => {
  if (!isSentryInitialized) return;
  // Stop telemetry after consent revocation.
  Sentry.close(2000).catch(() => {});
  isSentryInitialized = false;
};

const applyTelemetryConsent = (consent) => {
  if (consent?.analytics) {
    initSentry();
  } else {
    disableSentry();
  }
};

applyTelemetryConsent(readStoredConsent());

window.addEventListener(CONSENT_UPDATED_EVENT, (event) => {
  applyTelemetryConsent(event?.detail || readStoredConsent());
});

const container = document.getElementById("root");
const root = createRoot(container);

root.render(<App />);

// Register service worker for PWA capabilities
if ('serviceWorker' in navigator) {
  const isLocalhost = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
  const shouldRegisterServiceWorker = import.meta.env.PROD || isLocalhost;

  if (shouldRegisterServiceWorker) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          console.info('[SW] Registered:', reg.scope);
        })
        .catch((err) => {
          console.warn('[SW] Registration failed:', err);
        });
    });
  } else {
    // On non-local dev hosts, disable SW to avoid stale cache issues.
    window.addEventListener('load', async () => {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      } catch {
        // no-op
      }
    });
  }
}
