import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import matchers from '@testing-library/jest-dom/matchers';
import MediaPipeCalibrationPanel from '../MediaPipeCalibrationPanel.jsx';
import apiClient from '../../../../services/apiClient.js';

expect.extend(matchers);

vi.mock('../../../../services/apiClient.js', () => ({
  default: {
    admin: {
      getMediaPipeCalibration: vi.fn(),
    },
  },
}));

vi.mock('../../../../components/AppIcon', () => ({
  default: ({ name }) => <span>{name}</span>,
}));

vi.mock('../../../../components/ui/Button', () => ({
  default: ({ children, onClick, disabled }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock('../../../../components/ui/LoadingIndicator', () => ({
  default: () => <span>loading</span>,
}));

vi.mock('../../../../config/mediapipeReferenceData', () => ({
  saveCalibratedOverrides: vi.fn(() => true),
  clearCalibratedOverrides: vi.fn(),
  loadCalibratedOverrides: vi.fn(() => null),
}));

describe('MediaPipeCalibrationPanel', () => {
  beforeEach(() => {
    apiClient.admin.getMediaPipeCalibration.mockReset();
    apiClient.admin.getMediaPipeCalibration.mockResolvedValue({
      success: true,
      calibrated: {
        eyeContact: {
          gaze: {
            irisPosition: { tolerance: 0.12 },
            horizontalOffsetThreshold: 0.08,
          },
        },
      },
      comparisons: [
        {
          metric: 'eyeContact.gaze.irisPosition.tolerance',
          staticValue: 0.15,
          calibratedValue: 0.12,
          deviation: -20,
          stats: { sampleSize: 48 },
          confidence: 'high',
        },
        {
          metric: 'eyeContact.gaze.horizontalOffsetThreshold',
          staticValue: 0.12,
          calibratedValue: 0.08,
          deviation: -33.3,
          stats: { sampleSize: 48 },
          confidence: 'medium',
        },
      ],
      summary: {
        totalAnalyticsDatasets: 6,
        highScoreDatasets: 4,
        metricsCalibrated: 2,
        highConfidenceMetrics: 1,
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders advanced eye and iris calibration labels with descriptions', async () => {
    render(<MediaPipeCalibrationPanel />);

    await waitFor(() => {
      expect(screen.getByText('Gaze Center Tolerance')).toBeInTheDocument();
    });

    expect(screen.getByText('Horizontal Eye Offset Limit')).toBeInTheDocument();
    expect(screen.getByText(/Advanced eye tracking active:/i)).toBeInTheDocument();
    expect(screen.getByText('eyeContact.gaze.irisPosition.tolerance')).toBeInTheDocument();
    expect(screen.getAllByText('Eye / Iris')).toHaveLength(2);
  });
});
