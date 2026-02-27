import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CONSENT_KEY,
  LEGACY_CONSENT_KEY,
  CONSENT_UPDATED_EVENT,
  readStoredConsent,
  writeStoredConsent,
  clearStoredConsent,
} from '../cookieConsent.js';

describe('cookieConsent service', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('writes consent to both current and legacy keys', () => {
    const payload = writeStoredConsent({
      functional: true,
      analytics: true,
      marketing: false,
    });

    const current = JSON.parse(localStorage.getItem(CONSENT_KEY));
    const legacy = JSON.parse(localStorage.getItem(LEGACY_CONSENT_KEY));

    expect(payload.functional).toBe(true);
    expect(payload.analytics).toBe(true);
    expect(payload.marketing).toBe(false);
    expect(current.analytics).toBe(true);
    expect(legacy.analytics).toBe(true);
  });

  it('migrates legacy consent into the current key', () => {
    localStorage.setItem(
      LEGACY_CONSENT_KEY,
      JSON.stringify({
        functional: true,
        analytics: false,
        marketing: true,
        savedAt: '2026-01-01T00:00:00.000Z',
      }),
    );

    const read = readStoredConsent();
    const current = JSON.parse(localStorage.getItem(CONSENT_KEY));

    expect(read).toEqual({
      functional: true,
      analytics: false,
      marketing: true,
    });
    expect(current.analytics).toBe(false);
    expect(current.marketing).toBe(true);
  });

  it('backfills the legacy key when only current key exists', () => {
    localStorage.setItem(
      CONSENT_KEY,
      JSON.stringify({
        functional: true,
        analytics: true,
        marketing: false,
        savedAt: '2026-01-01T00:00:00.000Z',
      }),
    );

    const read = readStoredConsent();
    const legacy = JSON.parse(localStorage.getItem(LEGACY_CONSENT_KEY));

    expect(read).toEqual({
      functional: true,
      analytics: true,
      marketing: false,
    });
    expect(legacy.analytics).toBe(true);
    expect(legacy.marketing).toBe(false);
  });

  it('clears malformed consent values and returns null', () => {
    localStorage.setItem(CONSENT_KEY, '{broken-json');
    localStorage.setItem(LEGACY_CONSENT_KEY, '{"bad":"shape"}');

    const read = readStoredConsent();

    expect(read).toBeNull();
    expect(localStorage.getItem(CONSENT_KEY)).toBeNull();
    expect(localStorage.getItem(LEGACY_CONSENT_KEY)).toBeNull();
  });

  it('dispatches consent update events on write and clear', () => {
    const listener = vi.fn();
    window.addEventListener(CONSENT_UPDATED_EVENT, listener);

    writeStoredConsent({ functional: true, analytics: true, marketing: true });
    clearStoredConsent();

    window.removeEventListener(CONSENT_UPDATED_EVENT, listener);

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener.mock.calls[0][0].detail.analytics).toBe(true);
    expect(listener.mock.calls[1][0].detail).toBeNull();
  });
});
