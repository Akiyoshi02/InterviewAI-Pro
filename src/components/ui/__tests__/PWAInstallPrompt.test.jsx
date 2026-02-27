import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import PWAInstallPrompt from '../PWAInstallPrompt.jsx';

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

function createBeforeInstallPromptEvent(outcome = 'accepted') {
  const event = new Event('beforeinstallprompt');
  event.preventDefault = vi.fn();
  event.prompt = vi.fn();
  event.userChoice = Promise.resolve({ outcome });
  return event;
}

describe('PWAInstallPrompt', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers();

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        media: '(display-mode: standalone)',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('shows install prompt after beforeinstallprompt event', async () => {
    render(<PWAInstallPrompt />);
    const promptEvent = createBeforeInstallPromptEvent();

    window.dispatchEvent(promptEvent);
    vi.advanceTimersByTime(3000);

    expect(promptEvent.preventDefault).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Install App')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Install' })).toBeTruthy();
  });

  it('calls browser install prompt when install is clicked', async () => {
    render(<PWAInstallPrompt />);
    const promptEvent = createBeforeInstallPromptEvent();

    window.dispatchEvent(promptEvent);
    vi.advanceTimersByTime(3000);
    expect(await screen.findByText('Install App')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Install' }));

    await waitFor(() => {
      expect(promptEvent.prompt).toHaveBeenCalledTimes(1);
      expect(screen.queryByText('Install App')).toBeNull();
    });
  });

  it('hides prompt for the rest of the session when dismissed', async () => {
    render(<PWAInstallPrompt />);
    window.dispatchEvent(createBeforeInstallPromptEvent());
    vi.advanceTimersByTime(3000);
    expect(await screen.findByText('Install App')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.queryByText('Install App')).toBeNull();
    expect(sessionStorage.getItem('pwa_install_dismissed_session')).toBe('1');

    window.dispatchEvent(createBeforeInstallPromptEvent());
    vi.advanceTimersByTime(3000);
    expect(screen.queryByText('Install App')).toBeNull();

    cleanup();
    render(<PWAInstallPrompt />);
    window.dispatchEvent(createBeforeInstallPromptEvent());
    vi.advanceTimersByTime(3000);

    expect(screen.queryByText('Install App')).toBeNull();
  });
});
