import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import CookieConsentBanner from '../CookieConsentBanner.jsx';

const mockSaveConsent = vi.fn();
const mockGetConsent = vi.fn();

vi.mock('../../../services/apiClient.js', () => ({
  default: {
    gdpr: {
      saveConsent: (...args) => mockSaveConsent(...args),
      getConsent: (...args) => mockGetConsent(...args),
    },
  },
}));

vi.mock('../../../contexts/AuthContext.jsx', () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock('../Button.jsx', () => ({
  default: ({ children, onClick, ...props }) => (
    <button type="button" onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('../../AppIcon.jsx', () => ({
  default: () => <span>icon</span>,
}));

vi.mock('framer-motion', () => {
  const MotionDiv = ({
    children,
    initial,
    animate,
    exit,
    transition,
    ...rest
  }) => <div {...rest}>{children}</div>;

  return {
    AnimatePresence: ({ children }) => <>{children}</>,
    motion: new Proxy({}, { get: () => MotionDiv }),
  };
});

describe('CookieConsentBanner', () => {
  beforeEach(() => {
    localStorage.clear();
    mockSaveConsent.mockReset();
    mockGetConsent.mockReset();
    mockSaveConsent.mockResolvedValue({ success: true });
    mockGetConsent.mockResolvedValue({ consent: null });
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('shows the banner for new visitors', async () => {
    render(<CookieConsentBanner />);

    expect(screen.queryByText('We use cookies')).toBeNull();

    await vi.advanceTimersByTimeAsync(1100);

    expect(screen.getByText('We use cookies')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Customize' })).toBeTruthy();
  });

  it('does not show banner when consent already exists', () => {
    localStorage.setItem(
      'cookieConsent',
      JSON.stringify({
        functional: true,
        analytics: true,
        marketing: false,
        savedAt: '2026-01-01T00:00:00.000Z',
      }),
    );

    render(<CookieConsentBanner />);
    vi.advanceTimersByTime(1500);

    expect(screen.queryByText('We use cookies')).toBeNull();
  });

  it('saves custom preferences and hides the banner', async () => {
    render(<CookieConsentBanner />);
    await vi.advanceTimersByTimeAsync(1100);

    expect(screen.getByText('We use cookies')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Customize' }));
    fireEvent.click(screen.getByLabelText(/Analytics/i));
    fireEvent.click(screen.getByRole('button', { name: 'Save Preferences' }));

    const saved = JSON.parse(localStorage.getItem('cookieConsent'));
    expect(saved.functional).toBe(true);
    expect(saved.analytics).toBe(true);
    expect(saved.marketing).toBe(false);

    expect(mockSaveConsent).toHaveBeenCalledWith({
      functional: true,
      analytics: true,
      marketing: false,
    });
    expect(screen.queryByText('We use cookies')).toBeNull();
  });
});
