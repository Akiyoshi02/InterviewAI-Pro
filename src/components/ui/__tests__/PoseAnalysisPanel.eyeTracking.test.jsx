import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import matchers from '@testing-library/jest-dom/matchers';
import PoseAnalysisPanel from '../PoseAnalysisPanel.jsx';

expect.extend(matchers);

describe('PoseAnalysisPanel advanced eye tracking', () => {
  it('renders real-time eye and iris metrics when available', () => {
    render(
      <PoseAnalysisPanel
        poseMetrics={{
          posture: 'good',
          postureScore: 88,
          headPosition: 'centered',
          eyeContact: 'good',
          eyeContactScore: 91,
          gazeDirection: 'down-right',
          gazeStatus: 'slight',
          gazeDeviation: 0.05,
          gazeHorizontalOffset: 0.04,
          gazeVerticalOffset: -0.02,
          eyeAsymmetry: 0.03,
          irisSymmetry: 0.02,
          isLookingAtCamera: true,
          blinkRate: 18,
          faceOrientationStatus: 'direct',
          confidence: 86,
          slouching: false,
          fidgeting: false,
          lastUpdated: Date.now(),
        }}
      />,
    );

    expect(screen.getByText('Advanced Eye Tracking')).toBeInTheDocument();
    expect(screen.getByText('Horizontal Offset')).toBeInTheDocument();
    expect(screen.getByText('+4.0%')).toBeInTheDocument();
    expect(screen.getByText('-2.0%')).toBeInTheDocument();
    expect(screen.getByText('3.0%')).toBeInTheDocument();
    expect(screen.getByText('2.0%')).toBeInTheDocument();
    expect(screen.getByText('Aligned')).toBeInTheDocument();
    expect(screen.getByText('down right')).toBeInTheDocument();
    expect(screen.getByText('Gaze deviation 5.0%')).toBeInTheDocument();
    expect(screen.getByText('Blink rate 18/min')).toBeInTheDocument();
  });
});
