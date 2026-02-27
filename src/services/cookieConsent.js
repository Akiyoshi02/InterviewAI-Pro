export const CONSENT_KEY = 'cookieConsent';
export const LEGACY_CONSENT_KEY = 'cookie_consent_v1';
export const CONSENT_UPDATED_EVENT = 'cookie-consent-updated';

export const DEFAULT_CONSENT = Object.freeze({
  functional: true,
  analytics: false,
  marketing: false,
});

const CONSENT_KEYS = [CONSENT_KEY, LEGACY_CONSENT_KEY];

const isConsentShape = (value) => (
  value
  && typeof value === 'object'
  && typeof value.functional === 'boolean'
  && typeof value.analytics === 'boolean'
  && typeof value.marketing === 'boolean'
);

export const normalizeConsent = (value = DEFAULT_CONSENT) => ({
  functional: value.functional !== false,
  analytics: Boolean(value.analytics),
  marketing: Boolean(value.marketing),
});

const parseConsent = (serialized) => {
  if (!serialized) return null;
  try {
    const parsed = JSON.parse(serialized);
    return isConsentShape(parsed) ? normalizeConsent(parsed) : null;
  } catch {
    return null;
  }
};

const safeGetLocalStorage = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeSetLocalStorage = (key, value) => {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

const safeRemoveLocalStorage = (key) => {
  try {
    localStorage.removeItem(key);
  } catch {
    // no-op
  }
};

const dispatchConsentUpdate = (consent) => {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  window.dispatchEvent(new CustomEvent(CONSENT_UPDATED_EVENT, { detail: consent || null }));
};

export const readStoredConsent = () => {
  const currentValue = safeGetLocalStorage(CONSENT_KEY);
  const legacyValue = safeGetLocalStorage(LEGACY_CONSENT_KEY);

  const currentParsed = parseConsent(currentValue);
  if (currentParsed) {
    if (!legacyValue) {
      const serialized = JSON.stringify({ ...currentParsed, savedAt: new Date().toISOString() });
      safeSetLocalStorage(LEGACY_CONSENT_KEY, serialized);
    }
    return currentParsed;
  }

  const legacyParsed = parseConsent(legacyValue);
  if (legacyParsed) {
    const serialized = JSON.stringify({ ...legacyParsed, savedAt: new Date().toISOString() });
    safeSetLocalStorage(CONSENT_KEY, serialized);
    return legacyParsed;
  }

  if (currentValue || legacyValue) {
    CONSENT_KEYS.forEach(safeRemoveLocalStorage);
  }

  return null;
};

export const writeStoredConsent = (consent) => {
  const normalized = normalizeConsent(consent);
  const payload = {
    ...normalized,
    savedAt: new Date().toISOString(),
  };
  const serialized = JSON.stringify(payload);

  safeSetLocalStorage(CONSENT_KEY, serialized);
  safeSetLocalStorage(LEGACY_CONSENT_KEY, serialized);
  dispatchConsentUpdate(payload);

  return payload;
};

export const clearStoredConsent = () => {
  CONSENT_KEYS.forEach(safeRemoveLocalStorage);
  dispatchConsentUpdate(null);
};
