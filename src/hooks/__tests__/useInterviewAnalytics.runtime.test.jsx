import React, { useEffect, useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, act } from '@testing-library/react';
import matchers from '@testing-library/jest-dom/matchers';
import useInterviewAnalytics from '../useInterviewAnalytics.js';

expect.extend(matchers);

const mockPoseCreateFromOptions = vi.fn();
const mockFaceCreateFromOptions = vi.fn();
const mockForVisionTasks = vi.fn();

vi.mock('@mediapipe/tasks-vision', () => ({
  PoseLandmarker: {
    createFromOptions: (...args) => mockPoseCreateFromOptions(...args),
  },
  FaceLandmarker: {
    createFromOptions: (...args) => mockFaceCreateFromOptions(...args),
  },
  FilesetResolver: {
    forVisionTasks: (...args) => mockForVisionTasks(...args),
  },
}));

const AnalyticsHarness = ({ ready = false }) => {
  const videoRef = useRef(null);
  const analytics = useInterviewAnalytics(videoRef, {
    enablePose: true,
    enableFace: true,
    collectData: false,
  });

  useEffect(() => {
    if (!videoRef.current) return;
    Object.defineProperty(videoRef.current, 'readyState', {
      configurable: true,
      value: ready ? 4 : 0,
    });
    Object.defineProperty(videoRef.current, 'videoWidth', {
      configurable: true,
      value: ready ? 1280 : 0,
    });
    Object.defineProperty(videoRef.current, 'videoHeight', {
      configurable: true,
      value: ready ? 720 : 0,
    });
    Object.defineProperty(videoRef.current, 'paused', {
      configurable: true,
      value: !ready,
    });
    Object.defineProperty(videoRef.current, 'ended', {
      configurable: true,
      value: false,
    });
  }, [ready]);

  return (
    <div>
      <video ref={videoRef} />
      <span data-testid="pose-status">{analytics.initializationStatus.pose}</span>
      <span data-testid="face-status">{analytics.initializationStatus.face}</span>
    </div>
  );
};

describe('useInterviewAnalytics runtime guards', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    mockForVisionTasks.mockResolvedValue({});
    mockPoseCreateFromOptions.mockReset();
    mockFaceCreateFromOptions.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('falls back to CPU when GPU delegate creation fails', async () => {
    const poseDetector = { detectForVideo: vi.fn(() => ({ landmarks: [] })), close: vi.fn() };
    const faceDetector = { detectForVideo: vi.fn(() => ({ faceLandmarks: [] })), close: vi.fn() };

    mockPoseCreateFromOptions.mockImplementation(async (_vision, options) => {
      if (options.baseOptions.delegate === 'GPU') {
        throw new Error('GPU unavailable');
      }
      return poseDetector;
    });

    mockFaceCreateFromOptions.mockImplementation(async (_vision, options) => {
      if (options.baseOptions.delegate === 'GPU') {
        throw new Error('GPU unavailable');
      }
      return faceDetector;
    });

    render(<AnalyticsHarness ready={false} />);

    await waitFor(() => {
      expect(screen.getByTestId('pose-status')).toHaveTextContent('ready');
      expect(screen.getByTestId('face-status')).toHaveTextContent('ready');
    });

    const poseDelegates = mockPoseCreateFromOptions.mock.calls.map(([, options]) => options.baseOptions.delegate);
    const faceDelegates = mockFaceCreateFromOptions.mock.calls.map(([, options]) => options.baseOptions.delegate);

    expect(poseDelegates).toEqual(['GPU', 'CPU']);
    expect(faceDelegates).toEqual(['GPU', 'CPU']);
  });

  it('skips runtime detection until the video element is actually ready', async () => {
    const poseDetector = { detectForVideo: vi.fn(() => ({ landmarks: [] })), close: vi.fn() };
    const faceDetector = { detectForVideo: vi.fn(() => ({ faceLandmarks: [] })), close: vi.fn() };

    mockPoseCreateFromOptions.mockResolvedValue(poseDetector);
    mockFaceCreateFromOptions.mockResolvedValue(faceDetector);

    render(<AnalyticsHarness ready={false} />);

    await waitFor(() => {
      expect(screen.getByTestId('pose-status')).toHaveTextContent('ready');
      expect(screen.getByTestId('face-status')).toHaveTextContent('ready');
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
    });

    expect(poseDetector.detectForVideo).not.toHaveBeenCalled();
    expect(faceDetector.detectForVideo).not.toHaveBeenCalled();
  });
});
