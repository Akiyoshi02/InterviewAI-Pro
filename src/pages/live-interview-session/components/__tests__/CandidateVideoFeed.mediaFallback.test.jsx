import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import matchers from '@testing-library/jest-dom/matchers';
import CandidateVideoFeed from '../CandidateVideoFeed.jsx';

expect.extend(matchers);

const mockUseInterviewAnalytics = vi.fn(() => ({
  isInitialized: false,
  error: null,
  poseMetrics: null,
  metrics: null,
  isPoseReady: false,
  isFaceReady: false,
  collectedData: [],
}));

vi.mock('../../../../hooks/useInterviewAnalytics', () => ({
  default: (...args) => mockUseInterviewAnalytics(...args),
}));

vi.mock('../../../../components/AppIcon', () => ({
  default: ({ name }) => <span>{name}</span>,
}));

vi.mock('../../../../components/ui/Button', () => ({
  default: ({ children, ...props }) => <button {...props}>{children}</button>,
}));

vi.mock('../../../../components/ui/LoadingIndicator', () => ({
  default: () => <span>Loading</span>,
}));

describe('CandidateVideoFeed media fallback', () => {
  const originalMediaDevices = navigator.mediaDevices;
  const originalNavigatorWebdriver = Object.getOwnPropertyDescriptor(window.navigator, 'webdriver');
  const originalPlay = HTMLMediaElement.prototype.play;

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockUseInterviewAnalytics.mockClear();
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue();
  });

  afterEach(() => {
    cleanup();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: originalMediaDevices,
    });
    if (originalNavigatorWebdriver) {
      Object.defineProperty(window.navigator, 'webdriver', originalNavigatorWebdriver);
    } else {
      delete window.navigator.webdriver;
    }
    HTMLMediaElement.prototype.play = originalPlay;
  });

  it('shows a graceful fallback when camera and microphone are unavailable', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockRejectedValue(new Error('No media devices available')),
      },
    });

    render(<CandidateVideoFeed />);

    await waitFor(() => {
      expect(
        screen.getByText(/Camera and microphone are unavailable in this environment/i),
      ).toBeInTheDocument();
    });

    const latestOptions = mockUseInterviewAnalytics.mock.calls.at(-1)?.[1];
    expect(latestOptions.enablePose).toBe(false);
    expect(latestOptions.enableFace).toBe(false);
  });

  it('disables analytics in automation sessions even when video is available', async () => {
    Object.defineProperty(window.navigator, 'webdriver', {
      configurable: true,
      value: true,
    });

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getVideoTracks: () => [{ enabled: true }],
          getAudioTracks: () => [{ enabled: true }],
          getTracks: () => [{ stop: vi.fn() }],
        }),
      },
    });

    render(<CandidateVideoFeed />);

    await waitFor(() => {
      const latestOptions = mockUseInterviewAnalytics.mock.calls.at(-1)?.[1];
      expect(latestOptions.enablePose).toBe(false);
      expect(latestOptions.enableFace).toBe(false);
    });
  });
});
