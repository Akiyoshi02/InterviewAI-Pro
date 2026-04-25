import { describe, expect, it } from 'vitest';
import {
  buildAnalyticsDatasetPayload,
  evenlySampleAnalyticsPoints,
} from '../analyticsDatasetPayload.js';

describe('analyticsDatasetPayload', () => {
  it('samples large analytics collections and strips raw pose/face payloads', () => {
    const input = Array.from({ length: 400 }, (_, index) => ({
      timestamp: index * 100,
      frameNumber: index,
      pose: { landmarks: Array.from({ length: 10 }, () => ({ x: 1, y: 2 })) },
      face: {
        landmarks: Array.from({ length: 10 }, () => ({ x: 3, y: 4 })),
        eyeContactScore: 84,
        yaw: 6,
        pitch: 3,
        roll: 1,
        faceOrientationStatus: 'direct',
        blinkCount: 2,
        blinkRate: 14,
        avgEAR: 0.24,
        eyeAsymmetry: 0.03,
        isBlinking: false,
        gaze: {
          direction: 'center',
          status: 'direct',
          deviation: 0.08,
          horizontalOffset: 0.02,
          verticalOffset: -0.01,
          isLookingAtCamera: true,
        },
        iris: {
          left: { rawX: 0.4, rawY: 0.5, normalizedX: 0.51, normalizedY: 0.49 },
          right: { rawX: 0.6, rawY: 0.5, normalizedX: 0.5, normalizedY: 0.5 },
          symmetry: 0.02,
        },
        mouthMAR: 0.11,
        isSpeaking: true,
      },
      bodyLanguage: {
        posture: 'good',
        eyeContact: 'good',
        headPosition: 'level',
        handMovement: 'controlled',
      },
      scores: {
        posture: 82,
        attention: 74,
        bodyLanguage: 79,
        overall: 80,
      },
    }));

    const sampled = evenlySampleAnalyticsPoints(input, 120);
    expect(sampled).toHaveLength(120);
    expect(sampled[0].pose).toBeUndefined();
    expect(sampled[0].face).toBeUndefined();
    expect(sampled[0].signals).toEqual({
      poseDetected: true,
      faceDetected: true,
    });
    expect(sampled[0].faceSummary).toEqual(expect.objectContaining({
      eyeContactScore: 84,
      gaze: expect.objectContaining({
        direction: 'center',
        deviation: 0.08,
        isLookingAtCamera: true,
      }),
      iris: expect.objectContaining({
        symmetry: 0.02,
      }),
    }));
  });

  it('builds a compact dataset payload with original and stored frame counts', () => {
    const input = Array.from({ length: 10 }, (_, index) => ({
      timestamp: index * 100,
      frameNumber: index,
      bodyLanguage: { posture: 'good' },
      scores: {
        posture: 80,
        attention: 70,
        bodyLanguage: 75,
        overall: 78,
      },
    }));

    const payload = buildAnalyticsDatasetPayload({
      collectedData: input,
      interviewId: 'int-1',
      sessionDuration: 123,
      detectionInterval: 100,
    });

    expect(payload).toEqual(expect.objectContaining({
      interviewId: 'int-1',
      dataPoints: expect.any(Array),
      summary: expect.objectContaining({
        totalFrames: 10,
        storedFrames: 10,
        sessionDuration: 123,
      }),
    }));
    expect(payload.dataPoints[0]).toEqual(expect.objectContaining({
      bodyLanguage: expect.objectContaining({ posture: 'good' }),
      scores: expect.objectContaining({ overall: 78 }),
    }));
  });
});

